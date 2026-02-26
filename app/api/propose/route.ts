import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ProposeReq = {
  dealId: string;
  sellerToken?: string; // el token de /deal/[token]
};

function assertEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

async function callOpenAI({
  apiKey,
  model,
  input,
}: {
  apiKey: string;
  model: string;
  input: any;
}) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      // Pedimos salida de texto (pero en JSON)
      input,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      json?.error?.message ||
      json?.message ||
      `OpenAI error (${res.status})`;
    throw new Error(msg);
  }

  // Responses API suele exponer output_text
  const outputText: string =
    json?.output_text ||
    json?.output?.[0]?.content?.[0]?.text ||
    "";

  if (!outputText) throw new Error("OpenAI returned empty output_text");
  return outputText;
}

export async function POST(req: Request) {
  try {
    const { dealId, sellerToken } = (await req.json()) as ProposeReq;

    if (!dealId) {
      return NextResponse.json({ error: "dealId is required" }, { status: 400 });
    }

    const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRole = assertEnv("SUPABASE_SERVICE_ROLE_KEY");
    const openaiKey = assertEnv("OPENAI_API_KEY");

    // Admin client (bypassa RLS) para que el server pueda leer/escribir seguro
    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    });

    // 1) Validar sellerToken (recomendado)
    if (sellerToken) {
      const { data: part, error: partErr } = await admin
        .from("deal_participants")
        .select("deal_id, role")
        .eq("token", sellerToken)
        .maybeSingle();

      if (partErr) throw partErr;

      if (!part || part.role !== "seller" || part.deal_id !== dealId) {
        return NextResponse.json(
          { error: "Invalid sellerToken for this deal" },
          { status: 403 }
        );
      }
    }

    // 2) Cargar deal + terms
    const { data: deal, error: dealErr } = await admin
      .from("deals")
      .select(
        "id,status,product_title,product_description,product_price_public,product_image_url"
      )
      .eq("id", dealId)
      .single();
    if (dealErr) throw dealErr;

    const { data: terms, error: termsErr } = await admin
      .from("deal_terms")
      .select(
        "deal_id,seller_initial,seller_min,seller_min_current,seller_urgency,buyer_max,buyer_initial_offer,buyer_urgency"
      )
      .eq("deal_id", dealId)
      .maybeSingle();
    if (termsErr) throw termsErr;

    if (!terms) {
      return NextResponse.json(
        { error: "deal_terms not found for dealId" },
        { status: 404 }
      );
    }

    const sellerMin = Number(terms.seller_min ?? 0);
    const sellerMinCurrent = Number(terms.seller_min_current ?? sellerMin);
    const sellerInitial = Number(terms.seller_initial ?? 0);

    const buyerMax = Number(terms.buyer_max ?? 0);
    const buyerInitial = Number(terms.buyer_initial_offer ?? 0);

    // Si el buyer todavía no llenó términos, no hay con qué negociar
    if (!buyerMax || !buyerInitial) {
      return NextResponse.json(
        { error: "Buyer terms are missing (buyer_max / buyer_initial_offer)" },
        { status: 400 }
      );
    }

    // 3) Heurística base (si el modelo se cae, igual devolvemos algo)
    // Si no hay cruce, sugerimos contra-oferta en el mínimo del vendedor.
    const hasOverlap = buyerMax >= sellerMinCurrent;
    const mid = (buyerMax + sellerMinCurrent) / 2;
    const suggested = hasOverlap
      ? Math.round(mid) // redondeo simple
      : Math.round(sellerMinCurrent);

    const offerFloor = hasOverlap ? sellerMinCurrent : sellerMinCurrent;
    const offerCeil = hasOverlap ? buyerMax : sellerMinCurrent;

    const offerCandidate = clamp(suggested, offerFloor, offerCeil);

    // 4) Llamada a OpenAI (devuelve JSON)
    const model = "gpt-5.1-mini"; // buen balance costo/latencia
    const system = `
Eres un negociador experto. Tu objetivo es proponer un acuerdo que maximice la probabilidad de cierre y deje a ambas partes "conformes".
Devuelve SIEMPRE un JSON válido con esta forma:

{
  "offer_price": number,
  "rationale": string,
  "seller_message": string,
  "buyer_message": string
}

Reglas:
- offer_price debe estar entre seller_min_current y buyer_max cuando exista cruce.
- Si buyer_max < seller_min_current, offer_price debe ser seller_min_current (explica que no hay cruce y por qué).
- Mensajes cortos, convincentes, sin revelar información interna (no digas "buyer_max" ni "seller_min").
- Usa moneda "$" en los mensajes.
`.trim();

    const user = {
      deal: {
        title: deal.product_title,
        description: deal.product_description,
        public_price: deal.product_price_public,
      },
      terms: {
        seller_initial: sellerInitial,
        seller_min: sellerMin,
        seller_min_current: sellerMinCurrent,
        seller_urgency: terms.seller_urgency,
        buyer_max: buyerMax,
        buyer_initial_offer: buyerInitial,
        buyer_urgency: terms.buyer_urgency,
      },
      hint: {
        heuristic_offer_price: offerCandidate,
      },
    };

    const outputText = await callOpenAI({
      apiKey: openaiKey,
      model,
      input: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) },
      ],
    });

    let proposal: {
      offer_price: number;
      rationale: string;
      seller_message: string;
      buyer_message: string;
    };

    try {
      proposal = JSON.parse(outputText);
    } catch {
      // Fallback si el modelo devolvió texto raro
      proposal = {
        offer_price: offerCandidate,
        rationale:
          "Propuesta heurística: punto medio entre el mínimo actual del vendedor y el máximo del comprador (o mínimo actual si no hay cruce).",
        seller_message: `Propongo cerrar en $${offerCandidate}. Es un punto equilibrado que aumenta la probabilidad de venta sin regalar margen.`,
        buyer_message: `Podemos cerrar en $${offerCandidate}. Es un trato justo considerando el precio publicado y el estado del producto.`,
      };
    }

    // Normalizar offer_price dentro de rango seguro
    if (hasOverlap) {
      proposal.offer_price = clamp(
        Number(proposal.offer_price),
        sellerMinCurrent,
        buyerMax
      );
    } else {
      proposal.offer_price = sellerMinCurrent;
    }

    // 5) (Opcional) Guardar en offers/messages si existen columnas compatibles
    // Si tus columnas no coinciden, esto no debería romper el endpoint.
    try {
      await admin.from("offers").insert({
        deal_id: dealId,
        // Si tu tabla tiene otros nombres, cámbialos aquí:
        amount: proposal.offer_price,
        side: "ai",
        summary: proposal.rationale,
        status: "proposed",
      } as any);
    } catch {
      // ignore
    }

    try {
      await admin.from("messages").insert({
        deal_id: dealId,
        role: "ai",
        content: `Propuesta: $${proposal.offer_price}\n\n${proposal.rationale}`,
      } as any);
    } catch {
      // ignore
    }

    return NextResponse.json({
      ok: true,
      dealId,
      proposal,
      meta: {
        hasOverlap,
        sellerMinCurrent,
        buyerMax,
        heuristicOffer: offerCandidate,
      },
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
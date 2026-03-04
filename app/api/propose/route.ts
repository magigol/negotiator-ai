import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function assertEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
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

  const outputText: string =
    json?.output_text ||
    json?.output?.[0]?.content?.[0]?.text ||
    "";

  if (!outputText) throw new Error("OpenAI returned empty output_text");
  return outputText;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // acepta camelCase o snake_case
    const dealId: string | undefined = body.dealId ?? body.deal_id;
    const proposedPriceRaw = body.proposedPrice ?? body.proposed_price; // <- para tienda
    const sellerToken: string | undefined = body.sellerToken ?? body.seller_token; // <- para vendedor/IA

    if (!dealId) {
      return NextResponse.json({ error: "dealId is required" }, { status: 400 });
    }
    if (!isUuid(dealId)) {
      return NextResponse.json({ error: "Invalid dealId" }, { status: 400 });
    }

    const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRole = assertEnv("SUPABASE_SERVICE_ROLE_KEY");

    // Admin client (bypassa RLS) para escribir
    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    });

    // 1) Cargar deal (siempre)
    const { data: deal, error: dealErr } = await admin
      .from("deals")
      .select("id,status,product_title,product_description,product_price_public,product_image_url")
      .eq("id", dealId)
      .maybeSingle();

    if (dealErr) throw dealErr;
    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }
    if (deal.status !== "active") {
      return NextResponse.json({ error: "Deal is not active" }, { status: 400 });
    }

    // =========================
    // MODO A) TIENDA (buyer propone precio)
    // Si viene proposedPrice => guardamos offer y message
    // =========================
    if (proposedPriceRaw !== undefined && proposedPriceRaw !== null && proposedPriceRaw !== "") {
      const proposedPrice = Number(proposedPriceRaw);

      if (!Number.isFinite(proposedPrice) || proposedPrice <= 0) {
        return NextResponse.json({ error: "proposedPrice must be a positive number" }, { status: 400 });
      }

      // Insert en offers (según tu schema real: proposed_price, rationale, etc.)
      const { error: offerErr } = await admin.from("offers").insert({
        deal_id: dealId,
        proposed_price: proposedPrice,
        rationale: "Oferta del comprador desde la tienda",
        buyer_status: "submitted", // puedes cambiarlo a lo que uses
      } as any);

      if (offerErr) throw offerErr;

      // Insert en messages (según tu schema: sender_role)
      const { error: msgErr } = await admin.from("messages").insert({
        deal_id: dealId,
        sender_role: "buyer",
        content: `Oferta del comprador: $${proposedPrice}`,
      } as any);

      if (msgErr) throw msgErr;

      return NextResponse.json({
        ok: true,
        mode: "buyer_offer",
        dealId,
        proposed_price: proposedPrice,
      });
    }

    // =========================
    // MODO B) VENDEDOR/IA (tu flujo actual)
    // =========================
    // Validar sellerToken (si viene)
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

    const openaiKey = assertEnv("OPENAI_API_KEY");

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

    if (!buyerMax || !buyerInitial) {
      return NextResponse.json(
        { error: "Buyer terms are missing (buyer_max / buyer_initial_offer)" },
        { status: 400 }
      );
    }

    const hasOverlap = buyerMax >= sellerMinCurrent;
    const mid = (buyerMax + sellerMinCurrent) / 2;
    const suggested = hasOverlap ? Math.round(mid) : Math.round(sellerMinCurrent);

    const offerFloor = sellerMinCurrent;
    const offerCeil = hasOverlap ? buyerMax : sellerMinCurrent;

    const offerCandidate = clamp(suggested, offerFloor, offerCeil);

    const model = "gpt-5.1-mini";
    const system = `
Eres un negociador experto. Devuelve SIEMPRE un JSON válido:

{
  "offer_price": number,
  "rationale": string,
  "seller_message": string,
  "buyer_message": string
}

Reglas:
- offer_price entre seller_min_current y buyer_max cuando exista cruce.
- Si buyer_max < seller_min_current, offer_price debe ser seller_min_current.
- Mensajes cortos y convincentes, sin revelar variables internas.
- Usa "$" en los mensajes.
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
      hint: { heuristic_offer_price: offerCandidate },
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
      proposal = {
        offer_price: offerCandidate,
        rationale:
          "Propuesta heurística: punto medio entre el mínimo actual del vendedor y el máximo del comprador (o mínimo actual si no hay cruce).",
        seller_message: `Propongo cerrar en $${offerCandidate}.`,
        buyer_message: `Podemos cerrar en $${offerCandidate}.`,
      };
    }

    proposal.offer_price = hasOverlap
      ? clamp(Number(proposal.offer_price), sellerMinCurrent, buyerMax)
      : sellerMinCurrent;

    // Guardar AI offer en offers (con tu schema real)
    try {
      await admin.from("offers").insert({
        deal_id: dealId,
        proposed_price: proposal.offer_price,
        rationale: proposal.rationale,
        seller_status: "ai_proposed",
      } as any);
    } catch {
      // ignore
    }

    // Guardar message (schema real)
    try {
      await admin.from("messages").insert({
        deal_id: dealId,
        sender_role: "ai",
        content: `Propuesta IA: $${proposal.offer_price}\n\n${proposal.rationale}`,
      } as any);
    } catch {
      // ignore
    }

    return NextResponse.json({
      ok: true,
      mode: "ai_proposal",
      dealId,
      proposal,
      meta: { hasOverlap, sellerMinCurrent, buyerMax, heuristicOffer: offerCandidate },
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
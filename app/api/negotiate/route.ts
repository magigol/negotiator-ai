import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type NegotiateReq = {
  dealId?: string;
  deal_id?: string;
  proposedPrice?: number;
  proposed_price?: number;
  buyerUserId?: string;
  buyer_user_id?: string;
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

  if (!outputText) {
    throw new Error("OpenAI returned empty output_text");
  }

  return outputText;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as NegotiateReq;

    const dealId = body.dealId ?? body.deal_id;
    const proposedPriceRaw = body.proposedPrice ?? body.proposed_price;
    const buyerUserId = body.buyerUserId ?? body.buyer_user_id;

    if (!dealId) {
      return NextResponse.json(
        { error: "dealId is required" },
        { status: 400 }
      );
    }

    const proposedPrice = Number(proposedPriceRaw);

    if (!Number.isFinite(proposedPrice) || proposedPrice <= 0) {
      return NextResponse.json(
        { error: "proposedPrice must be a positive number" },
        { status: 400 }
      );
    }

    if (!buyerUserId) {
      return NextResponse.json(
        { error: "buyerUserId is required" },
        { status: 400 }
      );
    }

    const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRole = assertEnv("SUPABASE_SERVICE_ROLE_KEY");
    const openaiKey = assertEnv("OPENAI_API_KEY");

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    });

    // 1) Traer deal
    const { data: deal, error: dealErr } = await admin
      .from("deals")
      .select(
        "id,status,owner_user_id,product_title,product_description,product_price_public,product_image_url"
      )
      .eq("id", dealId)
      .maybeSingle();

    if (dealErr) throw dealErr;

    if (!deal) {
      return NextResponse.json(
        { error: "Deal not found" },
        { status: 404 }
      );
    }

    if (deal.status === "closed") {
      return NextResponse.json(
        { error: "This product is already sold" },
        { status: 400 }
      );
    }

    // 2) Evitar ofertar por tu propio producto
    if (deal.owner_user_id && deal.owner_user_id === buyerUserId) {
      return NextResponse.json(
        { error: "No puedes ofertar por tu propio producto." },
        { status: 400 }
      );
    }

    // 3) Traer terms
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
        { error: "deal_terms not found for this deal" },
        { status: 404 }
      );
    }

    const sellerMin = Number(terms.seller_min ?? 0);
    const sellerMinCurrent = Number(terms.seller_min_current ?? sellerMin);
    const sellerInitial = Number(terms.seller_initial ?? 0);

    // Nota:
    // Esto mantiene compatibilidad con tu modelo actual.
    // Más adelante conviene mover buyer_max y buyer_initial_offer
    // a una tabla por comprador, no global del deal.
    const buyerInitial =
      terms.buyer_initial_offer === null || terms.buyer_initial_offer === undefined
        ? proposedPrice
        : Number(terms.buyer_initial_offer);

    const buyerMax =
      terms.buyer_max === null || terms.buyer_max === undefined
        ? proposedPrice
        : Math.max(Number(terms.buyer_max), proposedPrice);

    // 4) Guardar oferta del comprador
    const { data: insertedOffer, error: offerErr } = await admin
      .from("offers")
      .insert({
        deal_id: dealId,
        buyer_user_id: buyerUserId,
        proposed_price: proposedPrice,
        rationale: "Oferta enviada por comprador",
        buyer_status: "submitted",
        seller_status: "pending",
        buyer_decision: "pending",
        seller_decision: "pending",
      } as any)
      .select("id,deal_id,proposed_price,created_at")
      .maybeSingle();

    if (offerErr) throw offerErr;

    // 5) Registrar mensaje del comprador
    const { error: buyerMsgErr } = await admin.from("messages").insert({
      deal_id: dealId,
      sender_role: "buyer",
      sender_user_id: buyerUserId,
      content: `Oferta del comprador: $${proposedPrice}`,
    } as any);

    if (buyerMsgErr) {
      // No frenamos todo el flujo por esto
      console.error("buyer message insert failed:", buyerMsgErr);
    }

    // 6) Actualizar estado del deal
    const { error: updateDealErr } = await admin
      .from("deals")
      .update({ status: "negotiating" })
      .eq("id", dealId);

    if (updateDealErr) throw updateDealErr;

    // 7) Mantener compatibilidad con IA actual
    const { error: updateTermsErr } = await admin
      .from("deal_terms")
      .update({
        buyer_initial_offer: buyerInitial,
        buyer_max: buyerMax,
      } as any)
      .eq("deal_id", dealId);

    if (updateTermsErr) {
      console.error("deal_terms update failed:", updateTermsErr);
    }

    // 8) Heurística base
    const hasOverlap = buyerMax >= sellerMinCurrent;
    const midpoint = (buyerMax + sellerMinCurrent) / 2;

    const suggested = hasOverlap
      ? Math.round(midpoint)
      : Math.round(sellerMinCurrent);

    const offerFloor = sellerMinCurrent;
    const offerCeil = hasOverlap ? buyerMax : sellerMinCurrent;

    const offerCandidate = clamp(suggested, offerFloor, offerCeil);

    // 9) Llamada a OpenAI para contraoferta
    const model = "gpt-5.1-mini";

    const system = `
Eres un negociador experto para marketplace.
Debes responder SIEMPRE con JSON válido con esta forma:

{
  "offer_price": number,
  "rationale": string,
  "buyer_message": string
}

Reglas:
- offer_price debe estar entre seller_min_current y buyer_max cuando exista cruce.
- Si buyer_max < seller_min_current, offer_price debe ser seller_min_current.
- buyer_message debe ser breve, claro y convincente.
- No reveles variables internas como buyer_max o seller_min_current.
- Usa moneda "$".
`.trim();

    const userInput = {
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
      new_offer: {
        proposed_price: proposedPrice,
      },
      hint: {
        heuristic_offer_price: offerCandidate,
      },
    };

    let proposal: {
      offer_price: number;
      rationale: string;
      buyer_message: string;
    };

    try {
      const outputText = await callOpenAI({
        apiKey: openaiKey,
        model,
        input: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(userInput) },
        ],
      });

      proposal = JSON.parse(outputText);
    } catch (e) {
      proposal = {
        offer_price: offerCandidate,
        rationale:
          "Contraoferta calculada por heurística según el punto medio entre la oferta del comprador y el mínimo actual del vendedor.",
        buyer_message: `Podemos avanzar con una contraoferta de $${offerCandidate}.`,
      };
    }

    // Normalizar precio final
    if (hasOverlap) {
      proposal.offer_price = clamp(
        Number(proposal.offer_price),
        sellerMinCurrent,
        buyerMax
      );
    } else {
      proposal.offer_price = sellerMinCurrent;
    }

    // 10) Guardar contraoferta IA en messages
    const { error: aiMsgErr } = await admin.from("messages").insert({
      deal_id: dealId,
      sender_role: "ai",
      content: `COUNTER_OFFER:${proposal.offer_price}\n${proposal.buyer_message}`,
    } as any);

    if (aiMsgErr) {
      console.error("ai counteroffer message insert failed:", aiMsgErr);
    }

    // 11) También guardamos un mensaje explicativo
    const { error: aiExplainErr } = await admin.from("messages").insert({
      deal_id: dealId,
      sender_role: "ai",
      content: `Razonamiento IA: ${proposal.rationale}`,
    } as any);

    if (aiExplainErr) {
      console.error("ai rationale message insert failed:", aiExplainErr);
    }

    return NextResponse.json({
      ok: true,
      dealId,
      offer: insertedOffer ?? null,
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
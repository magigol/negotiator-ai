import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  input,
}: {
  apiKey: string;
  input: any;
}) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.1-mini",
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

  return json?.output_text || json?.output?.[0]?.content?.[0]?.text || "";
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const dealId: string | undefined = body.dealId ?? body.deal_id;
    const proposedPriceRaw = body.proposedPrice ?? body.proposed_price;

    if (!dealId) {
      return NextResponse.json({ error: "dealId is required" }, { status: 400 });
    }

    if (proposedPriceRaw === undefined || proposedPriceRaw === null) {
      return NextResponse.json(
        { error: "proposedPrice is required" },
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

    const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRole = assertEnv("SUPABASE_SERVICE_ROLE_KEY");
    const openaiKey = assertEnv("OPENAI_API_KEY");

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    });

    // 1) Deal
    const { data: deal, error: dealErr } = await admin
      .from("deals")
      .select("id,status,product_title,product_description,product_price_public")
      .eq("id", dealId)
      .maybeSingle();

    if (dealErr) throw dealErr;
    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (deal.status === "closed") {
      return NextResponse.json(
        { error: "Deal is already closed" },
        { status: 400 }
      );
    }

    // 2) Terms
    const { data: terms, error: termsErr } = await admin
      .from("deal_terms")
      .select(
        "deal_id,seller_min,seller_min_current,seller_urgency,buyer_max,buyer_initial_offer,buyer_urgency"
      )
      .eq("deal_id", dealId)
      .maybeSingle();

    if (termsErr) throw termsErr;
    if (!terms) {
      return NextResponse.json(
        { error: "deal_terms not found" },
        { status: 404 }
      );
    }

    const sellerMin = Number(terms.seller_min ?? 0);
    const sellerMinCurrent = Number(terms.seller_min_current ?? sellerMin);

    // 3) Última oferta previa para hacer la negociación más natural
    const { data: lastOfferRow } = await admin
      .from("offers")
      .select("proposed_price, created_at")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastOffer = Number(lastOfferRow?.proposed_price ?? 0);

    // 4) Guardar la nueva oferta del comprador
    const { error: insertOfferErr } = await admin.from("offers").insert({
      deal_id: dealId,
      proposed_price: proposedPrice,
      rationale: "Oferta enviada por comprador",
      buyer_status: "submitted",
      seller_status: "pending",
    } as any);

    if (insertOfferErr) throw insertOfferErr;

    // 5) Guardar mensaje del comprador
    await admin.from("messages").insert({
      deal_id: dealId,
      sender_role: "buyer",
      content: `El comprador propone ${proposedPrice}.`,
    } as any);

    // 6) Calcular contraoferta base
    // estrategia:
    // - si la oferta supera el mínimo actual, el punto medio
    // - si está por debajo, acercarse al mínimo
    // - si ya había otra oferta, la IA se mueve menos bruscamente
    let counterPrice = proposedPrice;

    if (proposedPrice >= sellerMinCurrent) {
      counterPrice = Math.round((proposedPrice + sellerMinCurrent) / 2);
    } else {
      counterPrice = Math.round((proposedPrice + sellerMinCurrent * 2) / 3);
    }

    if (lastOffer > 0) {
      counterPrice = Math.round((counterPrice + lastOffer) / 2);
    }

    counterPrice = clamp(
      counterPrice,
      Math.min(proposedPrice, sellerMinCurrent),
      Math.max(proposedPrice, sellerMinCurrent)
    );

    // 7) Mensaje IA
    let aiMessage = `Podemos continuar la negociación con una contraoferta de $${counterPrice}.`;

    try {
      const output = await callOpenAI({
        apiKey: openaiKey,
        input: [
          {
            role: "system",
            content:
              "Eres un negociador experto. Responde con una sola frase corta, natural y convincente en español proponiendo una contraoferta.",
          },
          {
            role: "user",
            content: JSON.stringify({
              product: deal.product_title,
              public_price: deal.product_price_public,
              buyer_offer: proposedPrice,
              last_offer: lastOffer || null,
              seller_min_current: sellerMinCurrent,
              suggested_counteroffer: counterPrice,
            }),
          },
        ],
      });

      if (output && output.trim()) {
        aiMessage = output.trim();
      }
    } catch {
      // fallback silencioso
    }

    // 8) Guardar mensaje IA
    await admin.from("messages").insert({
      deal_id: dealId,
      sender_role: "ai",
      content: `Contraoferta sugerida: $${counterPrice}. ${aiMessage}`,
    } as any);

    // 9) Marcar deal en negociación
    if (deal.status === "active") {
      await admin.from("deals").update({ status: "negotiating" }).eq("id", dealId);
    }

    return NextResponse.json({
      ok: true,
      dealId,
      buyerOffer: proposedPrice,
      counterOffer: counterPrice,
      aiMessage,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
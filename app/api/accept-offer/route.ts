import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function assertEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const dealId: string | undefined = body.dealId ?? body.deal_id;
    const offerId: string | undefined = body.offerId ?? body.offer_id;

    if (!dealId) {
      return NextResponse.json({ error: "dealId is required" }, { status: 400 });
    }

    if (!offerId) {
      return NextResponse.json({ error: "offerId is required" }, { status: 400 });
    }

    const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRole = assertEnv("SUPABASE_SERVICE_ROLE_KEY");

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    });

    const { data: deal, error: dealErr } = await admin
      .from("deals")
      .select("id,status")
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

    const { data: offer, error: offerErr } = await admin
      .from("offers")
      .select("id,deal_id,buyer_user_id,proposed_price")
      .eq("id", offerId)
      .eq("deal_id", dealId)
      .maybeSingle();

    if (offerErr) throw offerErr;

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    if (!offer.buyer_user_id) {
      return NextResponse.json(
        { error: "The selected offer has no buyer_user_id" },
        { status: 400 }
      );
    }

    if (
      offer.proposed_price === null ||
      offer.proposed_price === undefined ||
      !Number.isFinite(Number(offer.proposed_price))
    ) {
      return NextResponse.json(
        { error: "The selected offer has invalid proposed_price" },
        { status: 400 }
      );
    }

    const acceptedPrice = Number(offer.proposed_price);

    const { error: closeErr } = await admin
      .from("deals")
      .update({
        status: "closed",
        final_price: acceptedPrice,
        buyer_user_id: offer.buyer_user_id,
      } as any)
      .eq("id", dealId);

    if (closeErr) throw closeErr;

    const { error: acceptedOfferErr } = await admin
      .from("offers")
      .update({
        seller_decision: "accepted",
        seller_status: "accepted",
        buyer_status: "accepted",
      } as any)
      .eq("id", offerId);

    if (acceptedOfferErr) throw acceptedOfferErr;

    await admin
      .from("offers")
      .update({
        seller_decision: "rejected",
        seller_status: "rejected",
      } as any)
      .eq("deal_id", dealId)
      .neq("id", offerId)
      .is("seller_decision", null);

    await admin.from("messages").insert([
      {
        deal_id: dealId,
        sender_role: "seller",
        sender_user_id: null,
        content: `El vendedor aceptó la oferta de $${acceptedPrice}.`,
      } as any,
      {
        deal_id: dealId,
        sender_role: "ai",
        sender_user_id: null,
        content: `Trato cerrado en $${acceptedPrice}.`,
      } as any,
      {
        deal_id: dealId,
        sender_role: "buyer",
        sender_user_id: offer.buyer_user_id,
        content: `Tu oferta fue aceptada por $${acceptedPrice}.`,
      } as any,
    ]);

    return NextResponse.json({
      ok: true,
      dealId,
      offerId,
      acceptedPrice,
      buyerUserId: offer.buyer_user_id,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
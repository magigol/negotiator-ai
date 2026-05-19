/*
 * File: app/api/reject-offer/route.ts
 * Purpose: Archivo de código personalizado
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Función auxiliar: assertEnv.
function assertEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

type Body = {
  dealId?: string;
  offerId?: string;
};

export async function POST(req: Request) {
  // Ruta para marcar una oferta como rechazada por el vendedor.
  try {
    const body = (await req.json()) as Body;

    const dealId = body.dealId?.trim();
    const offerId = body.offerId?.trim();

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

    const { data: offer, error: offerErr } = await admin
      .from("offers")
      .select("id, deal_id, proposed_price, buyer_user_id")
      .eq("id", offerId)
      .eq("deal_id", dealId)
      .maybeSingle();

    if (offerErr) throw offerErr;

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    // Marcar esta oferta específica como rechazada por el vendedor.
    const { error: updateErr } = await admin
      .from("offers")
      .update({
        seller_decision: "rejected",
        seller_status: "rejected",
        buyer_status: "rejected",
      } as any)
      .eq("id", offerId);

    if (updateErr) throw updateErr;

    await admin.from("messages").insert([
      {
        deal_id: dealId,
        sender_role: "seller",
        sender_user_id: null,
        content: `El vendedor rechazó la oferta de $${Number(
          offer.proposed_price ?? 0
        ).toLocaleString("es-CL")}.`,
      } as any,
    ]);

    return NextResponse.json({
      ok: true,
      dealId,
      offerId,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
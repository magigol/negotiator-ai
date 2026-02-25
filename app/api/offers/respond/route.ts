import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

const supabaseAdmin = createClient(
  mustEnv("NEXT_PUBLIC_SUPABASE_URL"),
  mustEnv("SUPABASE_SERVICE_ROLE_KEY")
);

export async function POST(req: Request) {
  try {
    const { dealId, offerId, actorRole, action } = await req.json();

    if (!dealId || !offerId || !actorRole || !action) {
      return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
    }
    if (!["buyer", "seller"].includes(actorRole)) {
      return NextResponse.json({ error: "actorRole inválido" }, { status: 400 });
    }
    if (!["accept", "reject"].includes(action)) {
      return NextResponse.json({ error: "action inválida" }, { status: 400 });
    }

    // leer oferta
    const { data: offer, error: oErr } = await supabaseAdmin
      .from("offers")
      .select("*")
      .eq("id", offerId)
      .eq("deal_id", dealId)
      .single();

    if (oErr || !offer) {
      return NextResponse.json({ error: "Oferta no encontrada" }, { status: 404 });
    }

    // actualizamos campos según quién respondió
    const patch: any = {};
    if (actorRole === "buyer") patch.buyer_status = action;
    if (actorRole === "seller") patch.seller_status = action;

    const { error: upErr } = await supabaseAdmin
      .from("offers")
      .update(patch)
      .eq("id", offerId);

    if (upErr) throw new Error(upErr.message);

    // re-leer oferta para ver si quedó aceptada/rechazada por ambos
    const { data: updated } = await supabaseAdmin
      .from("offers")
      .select("*")
      .eq("id", offerId)
      .single();

    const buyerStatus = updated?.buyer_status;
    const sellerStatus = updated?.seller_status;

    // publicar mensaje de estado
    await supabaseAdmin.from("messages").insert({
      deal_id: dealId,
      sender_role: "mediator",
      content:
        action === "accept"
          ? `✅ ${actorRole} aceptó la propuesta.`
          : `❌ ${actorRole} rechazó la propuesta.`,
    });

    // si ambos aceptan => cerrar
    if (buyerStatus === "accept" && sellerStatus === "accept") {
      await supabaseAdmin.from("deals").update({ status: "accepted" }).eq("id", dealId);
      await supabaseAdmin.from("messages").insert({
        deal_id: dealId,
        sender_role: "mediator",
        content: "🎉 Trato cerrado: ambos aceptaron la propuesta.",
      });
    }

    // si alguno rechaza => dejarlo activo pero registrar, o cerrar como rejected
    if (buyerStatus === "reject" || sellerStatus === "reject") {
      await supabaseAdmin.from("deals").update({ status: "active" }).eq("id", dealId);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("RESPOND ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
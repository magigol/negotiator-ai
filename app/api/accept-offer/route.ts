/*
 * File: app/api/accept-offer/route.ts
 * Purpose: Archivo de código personalizado
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Helper para asegurar que todas las variables de entorno necesarias existan.
 * Si falta alguna, lanza un error inmediato.
 */
// Función auxiliar: assertEnv.
function assertEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function POST(req: Request) {
  // Endpoint POST que acepta una oferta de un trato existente.
  // Esta función usa la clave de servicio de Supabase para poder
  // modificar el estado del trato y las ofertas de manera segura.
  try {
    // Parse del cuerpo JSON de la petición.
    const body = await req.json().catch(() => ({}));

    // Aceptamos tanto camelCase como snake_case en los datos entrantes.
    const dealId: string | undefined = body.dealId ?? body.deal_id;
    const offerId: string | undefined = body.offerId ?? body.offer_id;

    // Validamos que el cliente haya enviado los identificadores necesarios.
    if (!dealId) {
      return NextResponse.json({ error: "dealId is required" }, { status: 400 });
    }

    if (!offerId) {
      return NextResponse.json({ error: "offerId is required" }, { status: 400 });
    }

    // Cargamos las credenciales de Supabase desde las variables de entorno.
    const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRole = assertEnv("SUPABASE_SERVICE_ROLE_KEY");

    // Creamos un cliente admin para realizar operaciones con permiso completo.
    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    });

    // Consultamos el trato y verificamos su existencia y estado.
    const { data: deal, error: dealErr } = await admin
      .from("deals")
      .select("id,status")
      .eq("id", dealId)
      .maybeSingle();

    if (dealErr) throw dealErr;

    if (!deal) {
      // Si el deal no existe, devolvemos un 404.
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (deal.status === "closed") {
      // No se puede aceptar una oferta si el trato ya está cerrado.
      return NextResponse.json(
        { error: "Deal is already closed" },
        { status: 400 }
      );
    }

    // Obtenemos la oferta específica que se va a aceptar.
    const { data: offer, error: offerErr } = await admin
      .from("offers")
      .select("id,deal_id,buyer_user_id,proposed_price")
      .eq("id", offerId)
      .eq("deal_id", dealId)
      .maybeSingle();

    if (offerErr) throw offerErr;

    if (!offer) {
      // La oferta solicitada no se encontró dentro del trato.
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    // La oferta debe pertenecer a un comprador registrado.
    if (!offer.buyer_user_id) {
      return NextResponse.json(
        { error: "The selected offer has no buyer_user_id" },
        { status: 400 }
      );
    }

    // Validamos que la oferta tenga un precio de propuesta numérico válido.
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

    // Cerramos el trato con la oferta aceptada y registramos el comprador final.
    const { error: closeErr } = await admin
      .from("deals")
      .update({
        status: "closed",
        final_price: acceptedPrice,
        buyer_user_id: offer.buyer_user_id,
      } as any)
      .eq("id", dealId);

    if (closeErr) throw closeErr;

    // Marcamos la oferta aceptada como decisión del vendedor.
    const { error: acceptedOfferErr } = await admin
      .from("offers")
      .update({
        seller_decision: "accepted",
        seller_status: "accepted",
        buyer_status: "accepted",
      } as any)
      .eq("id", offerId);

    if (acceptedOfferErr) throw acceptedOfferErr;

    // Rechazamos automáticamente otras ofertas del mismo trato que aún no tenían decisión.
    await admin
      .from("offers")
      .update({
        seller_decision: "rejected",
        seller_status: "rejected",
      } as any)
      .eq("deal_id", dealId)
      .neq("id", offerId)
      .is("seller_decision", null);

    // Añadimos mensajes al historial del trato para que el vendedor, la IA y el comprador tengan registro.
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
    // En caso de error inesperado, lo registramos y devolvemos un 500.
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
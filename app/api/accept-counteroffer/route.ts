/*
 * File: app/api/accept-counteroffer/route.ts
 * Purpose: Archivo de código personalizado
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Helper para asegurar que las variables de entorno necesarias estén presentes.
 * Usa esta misma función en varias rutas API para validar configuración.
 */
function assertEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function POST(req: Request) {
  // Endpoint POST que procesa la aceptación de una contraoferta por parte del comprador.
  try {
    // Parse del cuerpo JSON de la petición.
    const body = await req.json().catch(() => ({}));

    const dealId: string | undefined = body.dealId ?? body.deal_id;
    const acceptedPriceRaw = body.acceptedPrice ?? body.accepted_price;

    if (!dealId) {
      return NextResponse.json({ error: "dealId is required" }, { status: 400 });
    }

    const acceptedPrice = Number(acceptedPriceRaw);
    if (!Number.isFinite(acceptedPrice) || acceptedPrice <= 0) {
      return NextResponse.json(
        { error: "acceptedPrice must be a positive number" },
        { status: 400 }
      );
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
      return NextResponse.json({ error: "Deal is already closed" }, { status: 400 });
    }

    // cerrar el deal
    const { error: closeErr } = await admin
      .from("deals")
      .update({ status: "closed" })
      .eq("id", dealId);

    if (closeErr) throw closeErr;

    // marcar ofertas pendientes como resueltas
    await admin
      .from("offers")
      .update({
        buyer_decision: "accepted",
        seller_decision: "accepted",
        buyer_status: "accepted",
        seller_status: "accepted",
      } as any)
      .eq("deal_id", dealId)
      .is("seller_decision", null);

    // registrar mensaje final
    await admin.from("messages").insert({
      deal_id: dealId,
      sender_role: "buyer",
      content: `El comprador aceptó la contraoferta de $${acceptedPrice}.`,
    } as any);

    await admin.from("messages").insert({
      deal_id: dealId,
      sender_role: "ai",
      content: `Trato cerrado en $${acceptedPrice}.`,
    } as any);

    return NextResponse.json({
      ok: true,
      dealId,
      acceptedPrice,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
/*
 * File: app/api/seller/update-min/route.ts
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

// Función auxiliar: mustEnv.
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
    const { dealId, newMin } = await req.json();

    // Verificar que el cuerpo de la petición incluya el ID del trato y el nuevo mínimo.
    if (!dealId || newMin === undefined || newMin === null) {
      return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
    }

    const min = Number(newMin);
    if (!Number.isFinite(min) || min <= 0) {
      return NextResponse.json({ error: "newMin inválido" }, { status: 400 });
    }

    // Actualiza el mínimo actual del vendedor
    const { error: upErr } = await supabaseAdmin
      .from("deal_terms")
      .update({ seller_min_current: min })
      .eq("deal_id", dealId);

    if (upErr) throw new Error(upErr.message);

    // Vuelve a activar la negociación si estaba pendiente
    await supabaseAdmin.from("deals").update({ status: "active" }).eq("id", dealId);

    // Mensaje para el buyer (IA)
    await supabaseAdmin.from("messages").insert({
      deal_id: dealId,
      sender_role: "mediator",
      content: `🔧 El vendedor ajustó su mínimo. Puedes hacer una nueva oferta para que la IA continúe negociando.`,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("UPDATE MIN ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
/*
 * File: app/api/reactivate-product/route.ts
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
};

export async function POST(req: Request) {
  // Ruta para reactivar un producto que fue archivado y aún no está cerrado.
  try {
    const body = (await req.json()) as Body;
    const dealId = body.dealId?.trim();

    // Normaliza la entrada y asegura que se reciba el ID del trato.
    if (!dealId) {
      return NextResponse.json(
        { error: "dealId is required" },
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
      return NextResponse.json(
        { error: "Deal not found" },
        { status: 404 }
      );
    }

    if (deal.status === "closed") {
      return NextResponse.json(
        { error: "No puedes reactivar un producto cerrado." },
        { status: 400 }
      );
    }

    const { error: updateErr } = await admin
      .from("deals")
      .update({
        status: "active",
      })
      .eq("id", dealId);

    if (updateErr) throw updateErr;

    await admin.from("messages").insert({
      deal_id: dealId,
      sender_role: "system",
      content: "Producto reactivado por el vendedor.",
    } as any);

    return NextResponse.json({
      ok: true,
      dealId,
      status: "active",
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
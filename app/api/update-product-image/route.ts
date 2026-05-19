/*
 * File: app/api/update-product-image/route.ts
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
  imageUrl?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    // Normalizamos la entrada y validamos los valores esperados.
    const dealId = body.dealId?.trim();
    const imageUrl = body.imageUrl?.trim();

    if (!dealId) {
      return NextResponse.json({ error: "dealId is required" }, { status: 400 });
    }

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    }

    const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRole = assertEnv("SUPABASE_SERVICE_ROLE_KEY");

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    });

    const { data: deal, error: dealErr } = await admin
      .from("deals")
      .select("id")
      .eq("id", dealId)
      .maybeSingle();

    if (dealErr) throw dealErr;

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // Actualizar la URL de la imagen del producto en el registro del trato.
    const { error: updateErr } = await admin
      .from("deals")
      .update({
        product_image_url: imageUrl,
      })
      .eq("id", dealId);

    if (updateErr) throw updateErr;

    return NextResponse.json({
      ok: true,
      dealId,
      imageUrl,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
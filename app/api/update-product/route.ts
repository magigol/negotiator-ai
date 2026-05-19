/*
 * File: app/api/update-product/route.ts
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
  product_title?: string;
  product_description?: string | null;
  product_price_public?: number | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    // Normalizar y validar los campos de actualización del producto.
    const dealId = body.dealId?.trim();
    const product_title = body.product_title?.trim();
    const product_description = body.product_description?.trim() ?? "";
    const product_price_public = Number(body.product_price_public ?? 0);

    if (!dealId) {
      return NextResponse.json({ error: "dealId is required" }, { status: 400 });
    }

    if (!product_title) {
      return NextResponse.json(
        { error: "product_title is required" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(product_price_public) || product_price_public <= 0) {
      return NextResponse.json(
        { error: "product_price_public must be a positive number" },
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
      .select("id")
      .eq("id", dealId)
      .maybeSingle();

    if (dealErr) throw dealErr;

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // Guardar los cambios de título, descripción y precio en el trato.
    const { error: updateErr } = await admin
      .from("deals")
      .update({
        product_title,
        product_description,
        product_price_public,
      })
      .eq("id", dealId);

    if (updateErr) throw updateErr;

    return NextResponse.json({
      ok: true,
      dealId,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
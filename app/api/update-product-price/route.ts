import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function assertEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

type Body = {
  dealId?: string;
  publicPrice?: number;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const dealId = body.dealId?.trim();
    const publicPrice = Number(body.publicPrice ?? 0);

    if (!dealId) {
      return NextResponse.json({ error: "dealId is required" }, { status: 400 });
    }

    if (!Number.isFinite(publicPrice) || publicPrice <= 0) {
      return NextResponse.json(
        { error: "publicPrice must be a positive number" },
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

    const { error: updateErr } = await admin
      .from("deals")
      .update({
        product_price_public: publicPrice,
      })
      .eq("id", dealId);

    if (updateErr) throw updateErr;

    return NextResponse.json({
      ok: true,
      dealId,
      publicPrice,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
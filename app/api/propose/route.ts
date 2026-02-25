import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Urgency = "low" | "medium" | "high";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

const supabaseAdmin = createClient(
  mustEnv("NEXT_PUBLIC_SUPABASE_URL"),
  mustEnv("SUPABASE_SERVICE_ROLE_KEY") // server-only
);

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function urgencyWeight(u?: Urgency) {
  if (u === "high") return 0.7;
  if (u === "low") return 0.3;
  return 0.5;
}

async function callOpenAI(system: string, user: string) {
  const apiKey = mustEnv("OPENAI_API_KEY");

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`OpenAI error (${r.status}): ${txt}`);
  }

  const data = await r.json();
  return data?.choices?.[0]?.message?.content ?? "{}";
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const dealId = body?.dealId;

    if (!dealId) {
      return NextResponse.json({ error: "dealId requerido" }, { status: 400 });
    }

    // 1) Leer deal (para status actual)
    const { data: deal, error: dErr } = await supabaseAdmin
      .from("deals")
      .select("id,status")
      .eq("id", dealId)
      .single();

    if (dErr || !deal) {
      return NextResponse.json({ error: "Deal no encontrado" }, { status: 404 });
    }

    // Si ya está esperando aprobación, no generes más propuestas
    if (deal.status === "pending_seller") {
      return NextResponse.json({
        ok: true,
        pending_seller: true,
        message: "Ya existe una propuesta esperando aprobación del vendedor.",
      });
    }

    // 2) Obtener términos
    const { data: terms, error: tErr } = await supabaseAdmin
      .from("deal_terms")
      .select("*")
      .eq("deal_id", dealId)
      .single();

    if (tErr || !terms) {
      return NextResponse.json(
        { error: "No se encontraron términos en deal_terms", detail: tErr?.message },
        { status: 400 }
      );
    }

    const sellerMin = Number(terms.seller_min_current ?? terms.seller_min);
    const sellerInitial = Number(terms.seller_initial);
    const buyerMax = Number(terms.buyer_max);
    const buyerOffer = Number(terms.buyer_initial_offer);

    if (![sellerMin, sellerInitial, buyerMax, buyerOffer].every(Number.isFinite)) {
      return NextResponse.json(
        {
          error: "Faltan números válidos en deal_terms",
          detail: {
            seller_min: terms.seller_min,
            seller_initial: terms.seller_initial,
            buyer_max: terms.buyer_max,
            buyer_initial_offer: terms.buyer_initial_offer,
          },
        },
        { status: 400 }
      );
    }

    // 3) Cargar últimos mensajes
    const { data: msgs, error: mErr } = await supabaseAdmin
      .from("messages")
      .select("sender_role, content, created_at")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (mErr) {
      return NextResponse.json({ error: "Error leyendo mensajes", detail: mErr.message }, { status: 500 });
    }

    const history =
      (msgs ?? [])
        .reverse()
        .map((m) => `${m.sender_role}: ${m.content}`)
        .join("\n") || "(sin mensajes aún)";

    // 4) Calcular propuesta numérica (reglas duras)
    const hasZone = buyerMax >= sellerMin;

    let proposed: number;

    if (hasZone) {
      const bw = urgencyWeight(terms.buyer_urgency);
      const sw = urgencyWeight(terms.seller_urgency);

      const min = sellerMin;
      const max = buyerMax;

      const mid = (min + max) / 2;
      const skew = (bw - sw) * (max - min) * 0.25;

      proposed = clamp(mid + skew, min, max);
      proposed = clamp(proposed * 0.7 + buyerOffer * 0.3, min, max);
      proposed = Math.round(proposed);
    } else {
      // solo informativo
      proposed = Math.round((buyerMax + sellerMin) / 2);
    }

    // 5) Generar texto mediador (pero NO inventa el precio)
    const system = `Eres un mediador neutral entre comprador y vendedor.
Objetivo: ayudar a llegar a un acuerdo justo y rápido.
Reglas:
- NO inventes un precio. El precio lo entrega el sistema.
- Escribe corto, claro y respetuoso.
- Si hay zona de acuerdo: presenta la propuesta y explica por qué es razonable.
- Si NO hay zona de acuerdo: explica el gap y propone 1 alternativa no monetaria (entrega, garantía, forma de pago, etc.).
- Devuelve SOLO JSON.`;

    const user = `Datos:
seller_initial: ${sellerInitial}
seller_min: ${sellerMin}
buyer_max: ${buyerMax}
buyer_initial_offer: ${buyerOffer}
hay_zona_de_acuerdo: ${hasZone}
precio_propuesto_por_sistema: ${proposed}

Historial:
${history}

Devuelve SOLO este JSON:
{
  "message": "texto breve para el comprador",
  "rationale": "razón breve y racional",
  "non_price_option": "una alternativa no monetaria concreta"
}`;

    const content = await callOpenAI(system, user);

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {
        message: String(content),
        rationale: "Propuesta calculada dentro de límites.",
        non_price_option: "",
      };
    }

    // 6) Persistir y publicar
    if (hasZone) {
      // Validación dura
      if (!(proposed >= sellerMin && proposed <= buyerMax)) {
        throw new Error("Propuesta fuera de límites (inconsistencia interna)");
      }

      // Guardar oferta (con campos opcionales buyer_status/seller_status si existen)
      // Si tu tabla offers NO tiene buyer_status/seller_status, no pasa nada si los quitas.
      const { error: oErr } = await supabaseAdmin.from("offers").insert({
        deal_id: dealId,
        proposed_price: proposed,
        rationale: parsed?.rationale || null,
        buyer_status: null,
        seller_status: null,
      } as any);

      if (oErr) throw new Error(`Supabase offers insert error: ${oErr.message}`);

      // Cambiar estado a pending_seller (aprobación requerida)
      const { error: updErr } = await supabaseAdmin
        .from("deals")
        .update({ status: "pending_seller" })
        .eq("id", dealId);

      if (updErr) throw new Error(`Supabase deals update error: ${updErr.message}`);

      // Mensaje al comprador (IA)
      const msg = `${parsed?.message ?? ""}

📌 Propuesta: ${proposed}
🔎 Extra: ${parsed?.non_price_option ?? ""}

⏳ Estoy consultando al vendedor para la aprobación final.`.trim();

      const { error: insErr } = await supabaseAdmin.from("messages").insert({
        deal_id: dealId,
        sender_role: "mediator",
        content: msg,
      });

      if (insErr) throw new Error(`Supabase messages insert error: ${insErr.message}`);

      return NextResponse.json({ ok: true, pending_seller: true, proposed_price: proposed });
    } else {
      // No hay zona de acuerdo -> seguimos activos
      const msg = `${parsed?.message ?? "Con los límites actuales no hay zona de acuerdo."}

📌 Rango no cruza: comprador hasta ${buyerMax}, vendedor mínimo ${sellerMin}.
🔎 Alternativa: ${parsed?.non_price_option ?? ""}`.trim();

      const { error: insErr } = await supabaseAdmin.from("messages").insert({
        deal_id: dealId,
        sender_role: "mediator",
        content: msg,
      });

      if (insErr) throw new Error(`Supabase messages insert error: ${insErr.message}`);

      // Asegurar que sigue active (por si estaba en otro estado)
      await supabaseAdmin.from("deals").update({ status: "active" }).eq("id", dealId);

      return NextResponse.json({ ok: true, no_zone: true });
    }
  } catch (e: any) {
    console.error("PROPOSE ERROR:", e);
    return NextResponse.json(
      { error: e?.message ?? String(e), stack: e?.stack ?? null },
      { status: 500 }
    );
  }
}
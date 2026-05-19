/*
 * File: app/api/sales-advisor/route.ts
 * Purpose: Archivo de código personalizado
 */

import { NextResponse } from "next/server";

// Función auxiliar: assertEnv.
function assertEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

type DealRow = {
  id: string;
  status: string;
  created_at: string;
  final_price?: number | null;
  product_title: string | null;
  product_price_public: number | null;
  product_description?: string | null;
};

type Body = {
  deals: DealRow[];
  ticketPromedio: number;
};

export async function POST(req: Request) {
  try {
    const openaiKey = assertEnv("OPENAI_API_KEY");
    const body = (await req.json()) as Body;

    const deals = Array.isArray(body.deals) ? body.deals : [];
    const ticketPromedio = Number(body.ticketPromedio ?? 0);

    const reducedDeals = deals.map((d) => ({
      id: d.id,
      title: d.product_title ?? "Sin título",
      status: d.status,
      created_at: d.created_at,
      public_price: Number(d.product_price_public ?? 0),
      final_price: Number(d.final_price ?? 0),
      has_description: !!(d.product_description && d.product_description.trim()),
      description_length: d.product_description?.trim().length ?? 0,
    }));

    const systemPrompt = `
Eres un asesor de ventas para un marketplace con negociación asistida por IA.

Debes devolver SOLO JSON válido con esta estructura exacta:

{
  "summary": [
    {
      "title": "string",
      "message": "string",
      "tone": "good" | "warning" | "info"
    }
  ],
  "actions": [
    {
      "productId": "string",
      "productTitle": "string",
      "action": "subir_precio" | "bajar_precio" | "mejorar_descripcion" | "mejorar_foto" | "mantener_estrategia" | "revisar_negociacion",
      "reason": "string",
      "priority": "alta" | "media" | "baja"
    }
  ]
}

Reglas:
- summary: máximo 4 items.
- actions: máximo 5 items.
- Sé concreto, útil y accionable.
- Usa solo la información entregada.
- Si un producto lleva mucho tiempo activo o negociando, puedes sugerir revisar estrategia.
- Si un producto cerrado terminó muy por debajo del precio publicado, puedes sugerir revisar precio o negociación.
- Si un producto no tiene descripción o la descripción parece débil por longitud, puedes sugerir mejorar descripción.
- Responde en español.
`.trim();

    const userPrompt = JSON.stringify({
      ticketPromedio,
      deals: reducedDeals,
    });

    // Enviamos los datos al modelo de OpenAI para obtener recomendaciones comerciales.
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.1-mini",
        temperature: 0.3,
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(
        json?.error?.message || json?.message || `OpenAI error (${res.status})`
      );
    }

    const outputText: string =
      json?.output_text || json?.output?.[0]?.content?.[0]?.text || "";

    if (!outputText) {
      throw new Error("OpenAI returned empty output_text");
    }

    let parsed: {
      summary: { title: string; message: string; tone: "good" | "warning" | "info" }[];
      actions: {
        productId: string;
        productTitle: string;
        action:
          | "subir_precio"
          | "bajar_precio"
          | "mejorar_descripcion"
          | "mejorar_foto"
          | "mantener_estrategia"
          | "revisar_negociacion";
        reason: string;
        priority: "alta" | "media" | "baja";
      }[];
    };

    try {
      parsed = JSON.parse(outputText);
    } catch {
      parsed = {
        summary: [
          {
            title: "Análisis no estructurado",
            message:
              "La IA respondió en un formato no esperado. Intenta nuevamente con más datos de ventas.",
            tone: "info",
          },
        ],
        actions: [],
      };
    }

    return NextResponse.json({
      ok: true,
      summary: parsed.summary ?? [],
      actions: parsed.actions ?? [],
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
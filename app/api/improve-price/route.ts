/*
 * File: app/api/improve-price/route.ts
 * Purpose: Archivo de código personalizado
 */

import { NextResponse } from "next/server";

/**
 * Valida que exista una variable de entorno requerida.
 */
// Función auxiliar: assertEnv.
function assertEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

type Body = {
  title?: string;
  description?: string | null;
  publicPrice?: number | null;
  finalPrice?: number | null;
  action?: "subir_precio" | "bajar_precio" | "mantener_estrategia" | null;
};

export async function POST(req: Request) {
  // Ruta que sugiere un precio objetivo usando OpenAI.
  try {
    const openaiKey = assertEnv("OPENAI_API_KEY");
    const body = (await req.json()) as Body;

    const title = body.title?.trim();
    const description = body.description?.trim() ?? "";
    const publicPrice = Number(body.publicPrice ?? 0);
    const finalPrice = Number(body.finalPrice ?? 0);
    const action = body.action ?? null;

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    if (!Number.isFinite(publicPrice) || publicPrice <= 0) {
      return NextResponse.json(
        { error: "publicPrice must be a positive number" },
        { status: 400 }
      );
    }

    const systemPrompt = `
Eres un asesor comercial para un marketplace.
Debes sugerir un nuevo precio publicado para un producto.

Devuelve SOLO JSON válido con esta estructura:

{
  "suggestedPrice": number,
  "reason": "string",
  "tips": ["string"]
}

Reglas:
- Escribe en español.
- suggestedPrice debe ser un número entero positivo.
- Si la acción es "subir_precio", el precio sugerido debe ser igual o mayor al precio actual.
- Si la acción es "bajar_precio", el precio sugerido debe ser igual o menor al precio actual.
- Si no hay suficiente información, mantén un ajuste moderado.
- No inventes características del producto.
- Máximo 4 tips.
`.trim();

    const userPrompt = JSON.stringify({
      title,
      description,
      publicPrice,
      finalPrice,
      action,
    });

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
      suggestedPrice: number;
      reason: string;
      tips: string[];
    };

    try {
      parsed = JSON.parse(outputText);
    } catch {
      const fallbackPrice =
        action === "subir_precio"
          ? Math.round(publicPrice * 1.08)
          : action === "bajar_precio"
          ? Math.round(publicPrice * 0.92)
          : publicPrice;

      parsed = {
        suggestedPrice: fallbackPrice,
        reason: "La IA no pudo estructurar la respuesta correctamente. Se generó un ajuste base.",
        tips: ["Revisa si el nuevo precio se alinea con tus cierres recientes."],
      };
    }

    let suggestedPrice = Math.round(Number(parsed.suggestedPrice ?? publicPrice));
    if (!Number.isFinite(suggestedPrice) || suggestedPrice <= 0) {
      suggestedPrice = publicPrice;
    }

    if (action === "subir_precio" && suggestedPrice < publicPrice) {
      suggestedPrice = publicPrice;
    }

    if (action === "bajar_precio" && suggestedPrice > publicPrice) {
      suggestedPrice = publicPrice;
    }

    return NextResponse.json({
      ok: true,
      suggestedPrice,
      reason: parsed.reason ?? "",
      tips: parsed.tips ?? [],
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
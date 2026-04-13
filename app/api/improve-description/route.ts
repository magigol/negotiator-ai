import { NextResponse } from "next/server";

function assertEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

type Body = {
  title?: string;
  description?: string | null;
  publicPrice?: number | null;
};

export async function POST(req: Request) {
  try {
    const openaiKey = assertEnv("OPENAI_API_KEY");
    const body = (await req.json()) as Body;

    const title = body.title?.trim();
    const description = body.description?.trim() ?? "";
    const publicPrice = Number(body.publicPrice ?? 0);

    if (!title) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    const systemPrompt = `
Eres un experto en redacción para publicaciones de marketplace.
Tu tarea es mejorar descripciones de productos para hacerlas más claras, confiables y atractivas.

Devuelve SOLO JSON válido con esta estructura:

{
  "improvedDescription": "string",
  "tips": [
    "string"
  ]
}

Reglas:
- Escribe en español.
- La descripción debe sonar natural y útil.
- No inventes características que no fueron entregadas.
- Si la información es poca, organiza bien lo que sí existe.
- Puedes mejorar estructura, claridad y tono comercial.
- Máximo 4 tips.
`.trim();

    const userPrompt = JSON.stringify({
      title,
      description,
      publicPrice,
    });

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.1-mini",
        temperature: 0.4,
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
      improvedDescription: string;
      tips: string[];
    };

    try {
      parsed = JSON.parse(outputText);
    } catch {
      parsed = {
        improvedDescription: description || `Publicación de ${title}.`,
        tips: ["La IA no pudo estructurar la respuesta correctamente."],
      };
    }

    return NextResponse.json({
      ok: true,
      improvedDescription: parsed.improvedDescription ?? "",
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
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useParams } from "next/navigation";

type Deal = {
  id: string;
  status: string;
  product_title: string | null;
  product_description: string | null;
  product_price_public: number | null;
  product_image_url: string | null;
};

type DealTerms = {
  seller_min_current: number | null;
  seller_urgency: string | null;
  buyer_urgency: string | null;
};

type Offer = {
  id: string;
  proposed_price: number | null;
  rationale: string | null;
  seller_decision: string | null;
  created_at: string | null;
};

type Message = {
  id: string;
  sender_role: string | null;
  content: string | null;
  created_at: string | null;
};

function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `$${Number(n).toLocaleString("es-CL")}`;
}

function getOfferRank(price: number | null, min: number | null) {
  if (!price || !min) return { label: "Sin evaluar", color: "#555" };

  const ratio = price / min;

  if (ratio >= 1.08) return { label: "🔥 Excelente", color: "#22c55e" };
  if (ratio >= 1.0) return { label: "🟢 Buena", color: "#3b82f6" };
  if (ratio >= 0.92) return { label: "🟡 Media", color: "#eab308" };

  return { label: "🔴 Baja", color: "#ef4444" };
}

function getCloseProbability(price: number | null, min: number | null) {
  if (!price || !min) return 0;

  const ratio = price / min;

  if (ratio >= 1.1) return 85;
  if (ratio >= 1.0) return 70;
  if (ratio >= 0.95) return 50;
  if (ratio >= 0.9) return 30;

  return 15;
}

function getAIRecommendation(best: number | null, min: number | null) {
  if (!best || !min) {
    return {
      action: "Esperar",
      message: "Aún no hay ofertas suficientes.",
      color: "rgba(255,255,255,.12)",
    };
  }

  const ratio = best / min;

  if (ratio >= 1.05) {
    return {
      action: "Aceptar",
      message: "La oferta supera el mínimo esperado.",
      color: "rgba(34,197,94,.22)",
    };
  }

  if (ratio >= 0.95) {
    return {
      action: "Considerar",
      message: "La oferta está cerca del mínimo.",
      color: "rgba(234,179,8,.22)",
    };
  }

  return {
    action: "Rechazar",
    message: "La oferta está muy lejos del mínimo.",
    color: "rgba(239,68,68,.22)",
  };
}

export default function DealSellerPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const dealId = params?.id;

  const [deal, setDeal] = useState<Deal | null>(null);
  const [terms, setTerms] = useState<DealTerms | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  async function loadData() {
    const { data: dealData } = await supabase
      .from("deals")
      .select("*")
      .eq("id", dealId)
      .single();

    setDeal(dealData);

    const { data: termsData } = await supabase
      .from("deal_terms")
      .select("*")
      .eq("deal_id", dealId)
      .single();

    setTerms(termsData);

    const { data: offersData } = await supabase
      .from("offers")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false });

    setOffers(offersData ?? []);

    const { data: messagesData } = await supabase
      .from("messages")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: true });

    setMessages(messagesData ?? []);
  }

  useEffect(() => {
    loadData();
  }, []);

  const bestOffer = useMemo(() => {
    return [...offers]
      .filter((o) => o.proposed_price)
      .sort((a, b) => (b.proposed_price ?? 0) - (a.proposed_price ?? 0))[0];
  }, [offers]);

  const pendingOffers = offers.filter((o) => !o.seller_decision);
  const displayedOffers = showHistory ? offers : pendingOffers;

  const aiRecommendation = getAIRecommendation(
    bestOffer?.proposed_price ?? null,
    terms?.seller_min_current ?? null
  );

  const closingMessage = useMemo(() => {
    return [...messages]
      .reverse()
      .find(
        (m) =>
          m.content?.includes("Trato cerrado en $") ||
          m.content?.includes("aceptó la contraoferta")
      );
  }, [messages]);

  const finalClosedPrice = useMemo(() => {
    if (!closingMessage?.content) return null;

    const match = closingMessage.content.match(/\$(\d[\d.]*)/);
    if (!match) return null;

    const normalized = match[1].replace(/\./g, "");
    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : null;
  }, [closingMessage]);

  async function decideOffer(id: string, decision: "accept" | "reject") {
    await supabase
      .from("offers")
      .update({
        seller_decision: decision,
      })
      .eq("id", id);

    if (decision === "accept") {
      await supabase.from("deals").update({ status: "closed" }).eq("id", dealId);
    }

    loadData();
  }

  if (!deal) return <main className="container">Cargando...</main>;

  return (
    <main className="container">
      <h1 className="h1">{deal.product_title}</h1>

      <div className="card">
        <img
          src={deal.product_image_url ?? ""}
          style={{ width: "100%", borderRadius: 12 }}
        />

        <div style={{ fontSize: 28, fontWeight: 900 }}>
          {money(deal.product_price_public)}
        </div>

        <div>{deal.product_description}</div>
      </div>

      {/* NUEVO: bloque de trato cerrado */}
      {deal.status === "closed" && (
        <div
          className="card"
          style={{
            marginTop: 12,
            border: "1px solid rgba(34,197,94,.35)",
            background: "rgba(34,197,94,.10)",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 22 }}>
            ✅ Trato cerrado
          </div>

          <div style={{ marginTop: 8, fontSize: 18 }}>
            Precio final: <b>{money(finalClosedPrice)}</b>
          </div>

          {closingMessage?.content ? (
            <div className="small" style={{ marginTop: 10, opacity: 0.9 }}>
              {closingMessage.content}
            </div>
          ) : (
            <div className="small" style={{ marginTop: 10, opacity: 0.9 }}>
              El comprador aceptó la negociación y el producto fue vendido.
            </div>
          )}
        </div>
      )}

      {bestOffer && (
        <div className="card">
          <h3>Mejor oferta</h3>

          <div style={{ fontSize: 24, fontWeight: 800 }}>
            {money(bestOffer.proposed_price)}
          </div>
        </div>
      )}

      <div className="card">
        <h3>🤖 Recomendación IA</h3>

        <div
          style={{
            padding: 12,
            borderRadius: 10,
            background: aiRecommendation.color,
          }}
        >
          <strong>{aiRecommendation.action}</strong>
          <div>{aiRecommendation.message}</div>
        </div>
      </div>

      <div className="card">
        <h3>{showHistory ? "Historial de ofertas" : "Ofertas pendientes"}</h3>

        <button className="btnGhost" onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? "Ver pendientes" : "Ver historial"}
        </button>

        {displayedOffers.length === 0 ? (
          <div style={{ marginTop: 12 }}>No hay ofertas para mostrar.</div>
        ) : (
          displayedOffers.map((o) => {
            const rank = getOfferRank(
              o.proposed_price,
              terms?.seller_min_current ?? null
            );

            const probability = getCloseProbability(
              o.proposed_price,
              terms?.seller_min_current ?? null
            );

            return (
              <div key={o.id} className="card">
                <div style={{ fontWeight: 800 }}>
                  {money(o.proposed_price)}
                </div>

                <div>{o.rationale}</div>

                <div
                  style={{
                    background: rank.color,
                    padding: 4,
                    borderRadius: 6,
                    display: "inline-block",
                    marginTop: 8,
                  }}
                >
                  {rank.label}
                </div>

                <div style={{ marginTop: 8 }}>
                  Probabilidad cierre: {probability}%
                </div>

                {!o.seller_decision && deal.status !== "closed" && (
                  <div style={{ marginTop: 10 }}>
                    <button
                      className="btn"
                      onClick={() => decideOffer(o.id, "accept")}
                    >
                      Aceptar
                    </button>

                    <button
                      className="btnGhost"
                      onClick={() => decideOffer(o.id, "reject")}
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="card">
        <h3>Mensajes de negociación</h3>

        {messages.length === 0 ? (
          <div>Aún no hay mensajes.</div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              style={{
                padding: 10,
                borderRadius: 10,
                background: "rgba(255,255,255,.05)",
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {m.sender_role}
              </div>

              <div>{m.content}</div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <button className="btnGhost" onClick={() => router.push("/dashboard")}>
          Volver al dashboard
        </button>
      </div>
    </main>
  );
}
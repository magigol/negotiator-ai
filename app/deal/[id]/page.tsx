"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useParams } from "next/navigation";

type Deal = {
  id: string;
  status: string;
  created_at: string;
  product_title: string | null;
  product_description: string | null;
  product_price_public: number | null;
  product_image_url: string | null;
  owner_user_id: string | null;
};

type DealTerms = {
  deal_id: string;
  seller_initial: number | null;
  seller_min: number | null;
  seller_min_current: number | null;
  seller_urgency: string | null;
  buyer_max: number | null;
  buyer_initial_offer: number | null;
  buyer_urgency: string | null;
  updated_at: string | null;
};

type Offer = {
  id: string;
  deal_id: string;
  proposed_price: number | null;
  rationale: string | null;
  seller_decision: string | null;
  buyer_decision: string | null;
  buyer_status: string | null;
  seller_status: string | null;
  created_at: string | null;
};

type Message = {
  id: string;
  deal_id: string;
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

function getAIRecommendation(bestOffer: number | null, sellerMinCurrent: number | null) {
  if (!bestOffer || !sellerMinCurrent) {
    return {
      action: "⏳ Esperar",
      message: "Aún no hay suficientes ofertas para recomendar una acción.",
      bg: "rgba(255,255,255,.08)",
      border: "1px solid rgba(255,255,255,.12)",
    };
  }

  const ratio = bestOffer / sellerMinCurrent;

  if (ratio >= 1.05) {
    return {
      action: "✅ Aceptar",
      message:
        "La mejor oferta supera cómodamente tu mínimo actual. La IA recomienda aceptar porque hay alta probabilidad de cierre.",
      bg: "rgba(34,197,94,.14)",
      border: "1px solid rgba(34,197,94,.28)",
    };
  }

  if (ratio >= 0.97) {
    return {
      action: "🟡 Considerar",
      message:
        "La mejor oferta está muy cerca de tu mínimo actual. La IA recomienda considerar aceptar o intentar una contraoferta pequeña.",
      bg: "rgba(234,179,8,.14)",
      border: "1px solid rgba(234,179,8,.28)",
    };
  }

  if (ratio >= 0.9) {
    return {
      action: "⏳ Esperar",
      message:
        "La mejor oferta aún está algo por debajo de tu mínimo actual. La IA recomienda esperar o seguir negociando.",
      bg: "rgba(59,130,246,.14)",
      border: "1px solid rgba(59,130,246,.28)",
    };
  }

  return {
    action: "❌ Rechazar",
    message:
      "La mejor oferta está demasiado lejos de tu mínimo actual. La IA recomienda rechazar o mantener la negociación abierta.",
    bg: "rgba(239,68,68,.14)",
    border: "1px solid rgba(239,68,68,.28)",
  };
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

export default function DealSellerPage() {
  const router = useRouter();
  const params = useParams<{ id: string | string[] }>();
  const dealIdRaw = params?.id;
  const dealId = Array.isArray(dealIdRaw) ? dealIdRaw[0] : dealIdRaw;

  const [deal, setDeal] = useState<Deal | null>(null);
  const [terms, setTerms] = useState<DealTerms | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actingOfferId, setActingOfferId] = useState<string | null>(null);

  async function loadData() {
    setErrorMsg(null);

    if (!dealId || typeof dealId !== "string" || !isUuid(dealId)) {
      setErrorMsg("ID inválido.");
      setLoading(false);
      return;
    }

    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      router.push("/login");
      return;
    }

    const { data: dealData, error: dealErr } = await supabase
      .from("deals")
      .select(
        "id,status,created_at,product_title,product_description,product_price_public,product_image_url,owner_user_id"
      )
      .eq("id", dealId)
      .maybeSingle();

    if (dealErr || !dealData) {
      setErrorMsg(dealErr?.message ?? "No se encontró el deal.");
      setLoading(false);
      return;
    }

    if (dealData.owner_user_id && dealData.owner_user_id !== auth.user.id) {
      setErrorMsg("No tienes permiso para ver este deal.");
      setLoading(false);
      return;
    }

    setDeal(dealData as Deal);

    const { data: termsData } = await supabase
      .from("deal_terms")
      .select(
        "deal_id,seller_initial,seller_min,seller_min_current,seller_urgency,buyer_max,buyer_initial_offer,buyer_urgency,updated_at"
      )
      .eq("deal_id", dealId)
      .maybeSingle();

    setTerms((termsData ?? null) as DealTerms | null);

    const { data: offersData } = await supabase
      .from("offers")
      .select(
        "id,deal_id,proposed_price,rationale,seller_decision,buyer_decision,buyer_status,seller_status,created_at"
      )
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false });

    setOffers((offersData ?? []) as Offer[]);

    const { data: messagesData } = await supabase
      .from("messages")
      .select("id,deal_id,sender_role,content,created_at")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: true });

    setMessages((messagesData ?? []) as Message[]);
    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (!mounted) return;
      setLoading(true);
      await loadData();
    }

    init();

    if (!dealId || typeof dealId !== "string") return;

    const channel = supabase
      .channel(`deal-seller-${dealId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deals", filter: `id=eq.${dealId}` },
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "offers", filter: `deal_id=eq.${dealId}` },
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `deal_id=eq.${dealId}` },
        () => loadData()
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [dealId]);

  const bestOffer = useMemo(() => {
    return [...offers]
      .filter((o) => typeof o.proposed_price === "number")
      .sort((a, b) => Number(b.proposed_price) - Number(a.proposed_price))[0];
  }, [offers]);

  const pendingOffers = useMemo(() => {
    return offers.filter((o) => {
      const sellerDecision = o.seller_decision ?? o.seller_status ?? "pending";
      return sellerDecision === "pending" || sellerDecision === null;
    });
  }, [offers]);

  const displayedOffers = useMemo(() => {
    return showHistory ? offers : pendingOffers;
  }, [showHistory, offers, pendingOffers]);

  const aiRecommendation = useMemo(() => {
    return getAIRecommendation(
      bestOffer?.proposed_price ?? null,
      terms?.seller_min_current ?? null
    );
  }, [bestOffer, terms]);

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
    if (!dealId) return;

    setActingOfferId(id);
    setActionMsg(null);

    try {
      const { error } = await supabase
        .from("offers")
        .update({
          seller_decision: decision,
          seller_status: decision,
        })
        .eq("id", id);

      if (error) throw error;

      if (decision === "accept") {
        await supabase.from("deals").update({ status: "closed" }).eq("id", dealId);
      }

      setActionMsg(
        decision === "accept"
          ? "✅ Oferta aceptada."
          : "🟠 Oferta rechazada."
      );

      await loadData();
    } catch (e: any) {
      setActionMsg(`❌ ${e?.message ?? "No se pudo actualizar la oferta."}`);
    } finally {
      setActingOfferId(null);
    }
  }

  if (loading) {
    return <main className="container">Cargando…</main>;
  }

  if (errorMsg) {
    return (
      <main className="container">
        <div className="header">
          <div>
            <h1 className="h1">Deal (vendedor)</h1>
            <div className="sub">{errorMsg}</div>
          </div>
          <div className="btnRow">
            <button className="btnGhost" onClick={() => router.push("/dashboard")}>
              Volver
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!deal) return null;

  return (
    <main className="container">
      <div className="header">
        <div>
          <h1 className="h1">Deal (vendedor)</h1>
          <div className="sub">ID: {deal.id}</div>
        </div>
        <div className="btnRow">
          <button className="btnGhost" onClick={() => router.push("/dashboard")}>
            Volver al dashboard
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="productCard">
          {deal.product_image_url ? (
            <img
              className="productImg"
              src={deal.product_image_url}
              alt={deal.product_title ?? "Producto"}
            />
          ) : (
            <div className="productImg" />
          )}

          <div style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>
                {deal.product_title ?? "(sin título)"}
              </div>
              <span className="badge">{deal.status}</span>
            </div>

            <div className="small" style={{ marginTop: 6 }}>
              {new Date(deal.created_at).toLocaleString()} · {money(deal.product_price_public)}
            </div>

            {deal.product_description ? (
              <div className="small" style={{ marginTop: 10, opacity: 0.9 }}>
                {deal.product_description}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {deal.status === "closed" && (
        <div
          className="card"
          style={{
            marginTop: 12,
            border: "1px solid rgba(34,197,94,.35)",
            background: "rgba(34,197,94,.10)",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 22 }}>✅ Trato cerrado</div>
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

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Términos del deal</div>

        {!terms ? (
          <div className="muted">No se encontraron términos para este deal.</div>
        ) : (
          <div className="grid" style={{ gap: 10 }}>
            <div className="row">
              <div className="muted">seller_initial</div>
              <div>{money(terms.seller_initial)}</div>
            </div>
            <div className="row">
              <div className="muted">seller_min</div>
              <div>{money(terms.seller_min)}</div>
            </div>
            <div className="row">
              <div className="muted">seller_min_current</div>
              <div>{money(terms.seller_min_current)}</div>
            </div>
            <div className="row">
              <div className="muted">seller_urgency</div>
              <div>{terms.seller_urgency ?? "—"}</div>
            </div>

            <hr style={{ opacity: 0.15 }} />

            <div className="row">
              <div className="muted">buyer_max</div>
              <div>{money(terms.buyer_max)}</div>
            </div>
            <div className="row">
              <div className="muted">buyer_initial_offer</div>
              <div>{money(terms.buyer_initial_offer)}</div>
            </div>
            <div className="row">
              <div className="muted">buyer_urgency</div>
              <div>{terms.buyer_urgency ?? "—"}</div>
            </div>

            <div className="small" style={{ marginTop: 10, opacity: 0.7 }}>
              updated_at: {terms.updated_at ? new Date(terms.updated_at).toLocaleString() : "—"}
            </div>
          </div>
        )}
      </div>

      {bestOffer && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>Mejor oferta actual</h3>
          <div style={{ fontSize: 24, fontWeight: 800 }}>
            {money(bestOffer.proposed_price)}
          </div>
          {bestOffer.rationale ? (
            <div className="small" style={{ marginTop: 6, opacity: 0.85 }}>
              {bestOffer.rationale}
            </div>
          ) : null}
        </div>
      )}

      <div
        className="card"
        style={{
          marginTop: 12,
          background: aiRecommendation.bg,
          border: aiRecommendation.border,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 8 }}>
          🤖 Recomendación IA
        </div>

        <div style={{ fontSize: 22, fontWeight: 900 }}>
          {aiRecommendation.action}
        </div>

        <div className="small" style={{ marginTop: 8, opacity: 0.92, lineHeight: 1.6 }}>
          {aiRecommendation.message}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ margin: 0 }}>
            {showHistory ? "Historial de ofertas" : "Ofertas pendientes"}
          </h3>

          <button className="btnGhost" onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? "Ver pendientes" : "Ver historial"}
          </button>
        </div>

        {actionMsg ? (
          <div className="small" style={{ marginTop: 10, opacity: 0.9 }}>
            {actionMsg}
          </div>
        ) : null}

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {displayedOffers.length === 0 ? (
            <div className="muted">
              {showHistory
                ? "No hay ofertas registradas para este deal."
                : "No hay ofertas pendientes."}
            </div>
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
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 18 }}>
                        {money(o.proposed_price)}
                      </div>

                      {o.rationale ? (
                        <div className="small" style={{ marginTop: 6, opacity: 0.9 }}>
                          {o.rationale}
                        </div>
                      ) : null}

                      <div
                        style={{
                          marginTop: 8,
                          display: "inline-block",
                          padding: "6px 10px",
                          borderRadius: 10,
                          background: rank.color,
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        {rank.label}
                      </div>

                      <div className="small" style={{ marginTop: 8 }}>
                        Probabilidad cierre: {probability}%
                      </div>

                      <div className="small" style={{ marginTop: 8, opacity: 0.7 }}>
                        {o.created_at ? new Date(o.created_at).toLocaleString() : "—"}
                      </div>
                    </div>

                    {!o.seller_decision && deal.status !== "closed" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <button
                          className="btn"
                          disabled={actingOfferId === o.id}
                          onClick={() => decideOffer(o.id, "accept")}
                        >
                          {actingOfferId === o.id ? "…" : "Aceptar"}
                        </button>

                        <button
                          className="btnGhost"
                          disabled={actingOfferId === o.id}
                          onClick={() => decideOffer(o.id, "reject")}
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
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
    </main>
  );
}
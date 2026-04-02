"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type DealRow = {
  id: string;
  status: string;
  created_at: string;
  product_title: string | null;
  product_description: string | null;
  product_price_public: number | null;
  product_image_url: string | null;
};

type OfferRow = {
  id: string;
  deal_id: string;
  proposed_price: number | null;
  rationale: string | null;
  created_at: string | null;
};

type MessageRow = {
  id: string;
  deal_id: string;
  sender_role: string | null;
  content: string | null;
  created_at: string | null;
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `$${Number(n).toLocaleString("es-CL")}`;
}

export default function ShopItemPage() {
  const router = useRouter();
  const params = useParams<{ id: string | string[] }>();

  const dealIdRaw = params?.id;
  const dealId = Array.isArray(dealIdRaw) ? dealIdRaw[0] : dealIdRaw;

  const [loading, setLoading] = useState(true);
  const [deal, setDeal] = useState<DealRow | null>(null);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [offer, setOffer] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [acceptingCounter, setAcceptingCounter] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);

  const offerNumber = useMemo(() => Number(offer), [offer]);

  const bestOffer = useMemo(() => {
    return [...offers]
      .filter((o) => typeof o.proposed_price === "number")
      .sort((a, b) => Number(b.proposed_price) - Number(a.proposed_price))[0];
  }, [offers]);

  const latestCounterOffer = useMemo(() => {
    const aiMessages = [...messages]
      .filter(
        (m) => m.sender_role === "ai" && m.content?.startsWith("COUNTER_OFFER:")
      )
      .sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });

    const latest = aiMessages[0];
    if (!latest?.content) return null;

    const match = latest.content.match(/^COUNTER_OFFER:(\d+)/);
    if (!match) return null;

    return {
      price: Number(match[1]),
      fullContent: latest.content,
      text: latest.content.replace(/^COUNTER_OFFER:\d+\n?/, "").trim(),
    };
  }, [messages]);

  const demandBadge = useMemo(() => {
    if (offers.length >= 3) {
      return {
        label: "🔥 Alta demanda",
        bg: "rgba(239,68,68,.18)",
      };
    }

    if (offers.length >= 1) {
      return {
        label: "🟡 Interés moderado",
        bg: "rgba(234,179,8,.18)",
      };
    }

    return {
      label: "🟢 Sin ofertas aún",
      bg: "rgba(34,197,94,.18)",
    };
  }, [offers.length]);

  const statusBadge = useMemo(() => {
    if (!deal) {
      return {
        label: "—",
        bg: "rgba(255,255,255,.12)",
        border: "1px solid rgba(255,255,255,.12)",
        glow: "0 0 0 rgba(0,0,0,0)",
        dot: "#fff",
        animated: false,
      };
    }

    if (deal.status === "closed") {
      return {
        label: "✅ Vendido",
        bg: "rgba(34,197,94,.18)",
        border: "1px solid rgba(34,197,94,.28)",
        glow: "0 0 0 rgba(0,0,0,0)",
        dot: "#22c55e",
        animated: false,
      };
    }

    if (deal.status === "negotiating") {
      return {
        label: "⏳ En negociación",
        bg: "rgba(234,179,8,.16)",
        border: "1px solid rgba(234,179,8,.34)",
        glow: "0 0 18px rgba(234,179,8,.14)",
        dot: "#eab308",
        animated: true,
      };
    }

    return {
      label: "🟢 Disponible",
      bg: "rgba(59,130,246,.16)",
      border: "1px solid rgba(59,130,246,.30)",
      glow: "0 0 0 rgba(0,0,0,0)",
      dot: "#3b82f6",
      animated: false,
    };
  }, [deal]);

  async function reloadEverything(currentDealId: string) {
    const { data: updatedDeal } = await supabase
      .from("deals")
      .select(
        "id,status,created_at,product_title,product_description,product_price_public,product_image_url"
      )
      .eq("id", currentDealId)
      .maybeSingle();

    if (updatedDeal) {
      setDeal(updatedDeal as DealRow);
    }

    const { data: offersData } = await supabase
      .from("offers")
      .select("id,deal_id,proposed_price,rationale,created_at")
      .eq("deal_id", currentDealId)
      .order("created_at", { ascending: false });

    setOffers((offersData ?? []) as OfferRow[]);

    const { data: messagesData } = await supabase
      .from("messages")
      .select("id,deal_id,sender_role,content,created_at")
      .eq("deal_id", currentDealId)
      .order("created_at", { ascending: true });

    setMessages((messagesData ?? []) as MessageRow[]);
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      setLoading(true);
      setErrorMsg(null);

      if (!dealId || typeof dealId !== "string" || !isUuid(dealId)) {
        setErrorMsg("ID inválido.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("deals")
        .select(
          "id,status,created_at,product_title,product_description,product_price_public,product_image_url"
        )
        .eq("id", dealId)
        .maybeSingle();

      if (error || !data) {
        setErrorMsg(error?.message ?? "Producto no encontrado.");
        setLoading(false);
        return;
      }

      await reloadEverything(dealId);

      if (mounted) setLoading(false);
    }

    init();

    if (!dealId || typeof dealId !== "string") return;

    const channel = supabase
      .channel(`shop-item-${dealId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deals",
          filter: `id=eq.${dealId}`,
        },
        () => {
          reloadEverything(dealId);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "offers",
          filter: `deal_id=eq.${dealId}`,
        },
        () => {
          reloadEverything(dealId);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `deal_id=eq.${dealId}`,
        },
        () => {
          reloadEverything(dealId);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [dealId]);

  async function proposePrice() {
    if (!deal) return;

    if (deal.status === "closed") {
      setToast("Este producto ya fue vendido.");
      return;
    }

    if (!Number.isFinite(offerNumber) || offerNumber <= 0) {
      setToast("Ingresa un precio válido.");
      return;
    }

    setSending(true);
    setToast(null);

    try {
      const res = await fetch("/api/negotiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dealId: deal.id,
          proposedPrice: offerNumber,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error ?? "No se pudo enviar la propuesta.");
      }

      setToast("✅ Propuesta enviada.");
      setOffer("");
      setShowOfferModal(false);

      await reloadEverything(deal.id);
    } catch (e: any) {
      setToast(`❌ ${e?.message ?? "Error inesperado."}`);
    } finally {
      setSending(false);
    }
  }

  async function acceptCounterOffer() {
    if (!deal || !latestCounterOffer) return;

    setAcceptingCounter(true);
    setToast(null);

    try {
      const res = await fetch("/api/accept-counteroffer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dealId: deal.id,
          acceptedPrice: latestCounterOffer.price,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error ?? "No se pudo aceptar la contraoferta.");
      }

      setToast(`✅ Contraoferta aceptada en ${money(latestCounterOffer.price)}.`);
      await reloadEverything(deal.id);
    } catch (e: any) {
      setToast(`❌ ${e?.message ?? "Error inesperado."}`);
    } finally {
      setAcceptingCounter(false);
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
            <h1 className="h1">Producto</h1>
            <div className="sub">{errorMsg}</div>
          </div>
          <div className="btnRow">
            <button className="btnGhost" onClick={() => router.push("/shop")}>
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
          <h1 className="h1">Detalle del producto</h1>
          <div className="sub">ID: {deal.id}</div>
        </div>
        <div className="btnRow">
          <button className="btnGhost" onClick={() => router.push("/shop")}>
            Volver a la tienda
          </button>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "minmax(280px, 420px) 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        <div>
          {deal.product_image_url ? (
            <img
              src={deal.product_image_url}
              alt={deal.product_title ?? "Producto"}
              style={{
                width: "100%",
                height: 420,
                objectFit: "cover",
                borderRadius: 18,
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: 420,
                borderRadius: 18,
                background: "rgba(255,255,255,.06)",
              }}
            />
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 28,
                  lineHeight: 1.15,
                }}
              >
                {deal.product_title ?? "(sin título)"}
              </div>

              <div className="small" style={{ marginTop: 8, opacity: 0.75 }}>
                Publicado: {new Date(deal.created_at).toLocaleDateString("es-CL")}
              </div>
            </div>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 999,
                background: statusBadge.bg,
                border: statusBadge.border,
                boxShadow: statusBadge.glow,
                fontWeight: 800,
                fontSize: 14,
                height: "fit-content",
              }}
            >
              <span
                className={statusBadge.animated ? "statusDotPulse" : ""}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: statusBadge.dot,
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              {statusBadge.label}
            </span>
          </div>

          <div
            style={{
              fontSize: 34,
              fontWeight: 900,
              marginTop: 6,
            }}
          >
            {money(deal.product_price_public)}
          </div>

          {deal.status === "closed" && (
            <div
              style={{
                padding: 14,
                borderRadius: 14,
                background: "rgba(34,197,94,.12)",
                fontWeight: 700,
                marginTop: 4,
              }}
            >
              Este producto ya fue vendido.
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 4,
            }}
          >
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                background: demandBadge.bg,
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {demandBadge.label}
            </div>

            <div
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                background: "rgba(255,255,255,.08)",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {offers.length} oferta{offers.length !== 1 ? "s" : ""}
            </div>
          </div>

          {bestOffer ? (
            <div
              style={{
                padding: 14,
                borderRadius: 16,
                background: "rgba(34,197,94,.10)",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Mejor oferta actual</div>
              <div style={{ fontSize: 26, fontWeight: 900 }}>
                {money(bestOffer.proposed_price)}
              </div>
              {bestOffer.rationale ? (
                <div className="small" style={{ marginTop: 6, opacity: 0.85 }}>
                  {bestOffer.rationale}
                </div>
              ) : null}
            </div>
          ) : null}

          {latestCounterOffer && deal.status !== "closed" ? (
            <div
              style={{
                padding: 14,
                borderRadius: 16,
                background: "rgba(59,130,246,.10)",
                border: "1px solid rgba(59,130,246,.20)",
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 6 }}>
                🤖 Contraoferta del vendedor / IA
              </div>

              <div style={{ fontSize: 26, fontWeight: 900 }}>
                {money(latestCounterOffer.price)}
              </div>

              {latestCounterOffer.text ? (
                <div className="small" style={{ marginTop: 6, opacity: 0.9, lineHeight: 1.6 }}>
                  {latestCounterOffer.text}
                </div>
              ) : null}

              <div className="btnRow" style={{ marginTop: 12 }}>
                <button
                  className="btn"
                  disabled={acceptingCounter}
                  onClick={acceptCounterOffer}
                >
                  {acceptingCounter ? "Aceptando…" : "Aceptar contraoferta"}
                </button>
              </div>
            </div>
          ) : null}

          <div
            style={{
              padding: 14,
              borderRadius: 16,
              background: "rgba(255,255,255,.04)",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Descripción</div>
            <div className="small" style={{ opacity: 0.9, lineHeight: 1.6 }}>
              {deal.product_description ?? "Sin descripción."}
            </div>
          </div>

          <div
            style={{
              padding: 14,
              borderRadius: 16,
              background: "rgba(255,255,255,.04)",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Negociación</div>
            <div className="small" style={{ opacity: 0.85, marginBottom: 12 }}>
              {deal.status === "closed"
                ? "La negociación está cerrada porque el producto ya fue vendido."
                : "Puedes enviar una propuesta de precio al vendedor. La IA responderá con una contraoferta automática."}
            </div>

            <div className="btnRow">
              <button
                className="btn"
                disabled={deal.status === "closed"}
                onClick={() => setShowOfferModal(true)}
              >
                {deal.status === "closed" ? "Producto vendido" : "Proponer precio"}
              </button>
            </div>

            {toast ? (
              <div className="small" style={{ marginTop: 10, opacity: 0.9 }}>
                {toast}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Historial de negociación</div>

        {messages.length === 0 ? (
          <div className="muted">Aún no hay mensajes.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {messages.map((m) => {
              const cleanContent =
                m.sender_role === "ai"
                  ? (m.content ?? "").replace(/^COUNTER_OFFER:\d+\n?/, "")
                  : m.content ?? "";

              return (
                <div
                  key={m.id}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    background:
                      m.sender_role === "ai"
                        ? "rgba(59,130,246,.12)"
                        : "rgba(255,255,255,.05)",
                  }}
                >
                  <div className="small" style={{ opacity: 0.7 }}>
                    {m.sender_role ?? "unknown"} ·{" "}
                    {m.created_at ? new Date(m.created_at).toLocaleString() : "—"}
                  </div>
                  <div style={{ marginTop: 6 }}>{cleanContent}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showOfferModal && deal.status !== "closed" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => {
            if (!sending) setShowOfferModal(false);
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 520,
              padding: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 900, fontSize: 22 }}>Proponer precio</div>
            <div className="small" style={{ marginTop: 6, opacity: 0.8 }}>
              Producto: {deal.product_title ?? "(sin título)"}
            </div>

            <div style={{ marginTop: 18 }}>
              <label className="small">Tu oferta</label>
              <input
                className="input"
                type="number"
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                placeholder="Ej: 35000"
                inputMode="numeric"
                style={{ marginTop: 8 }}
              />
            </div>

            <div
              style={{
                marginTop: 18,
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <button
                className="btnGhost"
                disabled={sending}
                onClick={() => setShowOfferModal(false)}
              >
                Cancelar
              </button>

              <button className="btn" disabled={sending} onClick={proposePrice}>
                {sending ? "Enviando…" : "Enviar propuesta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
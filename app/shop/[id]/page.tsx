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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [offer, setOffer] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);

  const offerNumber = useMemo(() => Number(offer), [offer]);

  const bestOffer = useMemo(() => {
    return [...offers]
      .filter((o) => typeof o.proposed_price === "number")
      .sort((a, b) => Number(b.proposed_price) - Number(a.proposed_price))[0];
  }, [offers]);

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
      };
    }

    if (deal.status === "closed") {
      return {
        label: "✅ Vendido",
        bg: "rgba(34,197,94,.22)",
      };
    }

    if (deal.status === "negotiating") {
      return {
        label: "⏳ En negociación",
        bg: "rgba(234,179,8,.22)",
      };
    }

    return {
      label: "🟢 Disponible",
      bg: "rgba(59,130,246,.22)",
    };
  }, [deal]);

  async function reloadOffers(currentDealId: string) {
    const { data: offersData } = await supabase
      .from("offers")
      .select("id,deal_id,proposed_price,rationale,created_at")
      .eq("deal_id", currentDealId)
      .order("created_at", { ascending: false });

    setOffers((offersData ?? []) as OfferRow[]);
  }

  useEffect(() => {
    (async () => {
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

      setDeal(data as DealRow);

      const { data: offersData } = await supabase
        .from("offers")
        .select("id,deal_id,proposed_price,rationale,created_at")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false });

      setOffers((offersData ?? []) as OfferRow[]);
      setLoading(false);
    })();
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
      const res = await fetch("/api/propose", {
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

      await reloadOffers(deal.id);
    } catch (e: any) {
      setToast(`❌ ${e?.message ?? "Error inesperado."}`);
    } finally {
      setSending(false);
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
                padding: "8px 12px",
                borderRadius: 999,
                background: statusBadge.bg,
                fontWeight: 800,
                fontSize: 14,
                height: "fit-content",
              }}
            >
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
                : "Puedes enviar una propuesta de precio al vendedor."}
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
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useParams } from "next/navigation";

type DealRow = {
  id: string;
  status: string;
  created_at: string;
  product_title: string | null;
  product_description: string | null;
  product_price_public: number | null;
  product_image_url: string | null;
  owner_user_id: string | null;
};

type DealTermsRow = {
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

type OfferRow = {
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

function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `$${Number(n).toLocaleString("es-CL")}`;
}

function getOfferRank(
  proposedPrice: number | null | undefined,
  sellerMinCurrent: number | null | undefined
) {
  if (!proposedPrice || !sellerMinCurrent) {
    return { label: "Sin evaluar", color: "rgba(255,255,255,.18)" };
  }

  const ratio = proposedPrice / sellerMinCurrent;

  if (ratio >= 1.08) {
    return { label: "🔥 Excelente", color: "rgba(34,197,94,.22)" };
  }

  if (ratio >= 1.0) {
    return { label: "🟢 Buena", color: "rgba(59,130,246,.22)" };
  }

  if (ratio >= 0.92) {
    return { label: "🟡 Media", color: "rgba(234,179,8,.22)" };
  }

  return { label: "🔴 Baja", color: "rgba(239,68,68,.22)" };
}

function getCloseProbability({
  proposedPrice,
  sellerMinCurrent,
  sellerUrgency,
  buyerUrgency,
}: {
  proposedPrice: number | null | undefined;
  sellerMinCurrent: number | null | undefined;
  sellerUrgency: string | null | undefined;
  buyerUrgency: string | null | undefined;
}) {
  if (!proposedPrice || !sellerMinCurrent) return 0;

  let score = 0;
  const ratio = proposedPrice / sellerMinCurrent;

  if (ratio >= 1.1) score += 55;
  else if (ratio >= 1.0) score += 40;
  else if (ratio >= 0.95) score += 25;
  else score += 10;

  if (sellerUrgency === "high") score += 15;
  else if (sellerUrgency === "medium") score += 8;

  if (buyerUrgency === "high") score += 15;
  else if (buyerUrgency === "medium") score += 8;

  return Math.min(score, 95);
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

  const [loading, setLoading] = useState(true);
  const [deal, setDeal] = useState<DealRow | null>(null);
  const [terms, setTerms] = useState<DealTermsRow | null>(null);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actingOfferId, setActingOfferId] = useState<string | null>(null);

  const bestOffer = useMemo(() => {
    return [...offers]
      .filter((o) => typeof o.proposed_price === "number")
      .sort((a, b) => Number(b.proposed_price) - Number(a.proposed_price))[0];
  }, [offers]);

  async function loadAll() {
    setLoading(true);
    setErrorMsg(null);
    setActionMsg(null);

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

    setDeal(dealData as DealRow);

    const { data: termsData } = await supabase
      .from("deal_terms")
      .select(
        "deal_id,seller_initial,seller_min,seller_min_current,seller_urgency,buyer_max,buyer_initial_offer,buyer_urgency,updated_at"
      )
      .eq("deal_id", dealId)
      .maybeSingle();

    setTerms((termsData ?? null) as DealTermsRow | null);

    const { data: offersData, error: offersErr } = await supabase
      .from("offers")
      .select(
        "id,deal_id,proposed_price,rationale,seller_decision,buyer_decision,buyer_status,seller_status,created_at"
      )
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false });

    if (offersErr) {
      setOffers([]);
    } else {
      setOffers((offersData ?? []) as OfferRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!dealId) return;
    loadAll();
  }, [dealId]);

  async function decideOffer(offerId: string, decision: "accept" | "reject") {
    if (!dealId) return;

    setActingOfferId(offerId);
    setActionMsg(null);

    try {
      const patch: Partial<OfferRow> = {
        seller_decision: decision,
        seller_status: decision,
      };

      const { error } = await supabase.from("offers").update(patch).eq("id", offerId);
      if (error) throw error;

      if (decision === "accept") {
        await supabase.from("deals").update({ status: "closed" }).eq("id", dealId);
      }

      setActionMsg(
        decision === "accept" ? "✅ Oferta aceptada y deal cerrado." : "🟠 Oferta rechazada."
      );

      await loadAll();
    } catch (e: any) {
      setActionMsg(`❌ ${e?.message ?? "No se pudo actualizar la oferta."}`);
    } finally {
      setActingOfferId(null);
    }
  }

  if (loading) return <main className="container">Cargando…</main>;

  if (errorMsg) {
    return (
      <main className="container">
        <h1 className="h1">Deal (vendedor)</h1>
        <div className="sub">{errorMsg}</div>
        <div style={{ marginTop: 16 }}>
          <button className="btnGhost" onClick={() => router.push("/dashboard")}>
            Volver
          </button>
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
            Volver
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="productCard">
          {deal.product_image_url ? (
            <img className="productImg" src={deal.product_image_url} alt={deal.product_title ?? "Producto"} />
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

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Términos del deal</div>
        {!terms ? (
          <div className="muted">No se encontraron términos (deal_terms no tiene fila).</div>
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

      {bestOffer ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Mejor oferta actual</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>
            {money(bestOffer.proposed_price)}
          </div>
          <div className="small" style={{ marginTop: 6, opacity: 0.85 }}>
            {bestOffer.rationale ?? "Sin justificación"}
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ fontWeight: 800 }}>Ofertas recibidas</div>
          {bestOffer?.proposed_price ? (
            <div className="small" style={{ opacity: 0.85 }}>
              Mejor oferta: <b>{money(bestOffer.proposed_price)}</b>
            </div>
          ) : null}
        </div>

        {actionMsg ? (
          <div className="small" style={{ marginTop: 10, opacity: 0.9 }}>
            {actionMsg}
          </div>
        ) : null}

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {offers.length === 0 ? (
            <div className="muted">Aún no hay ofertas para este deal.</div>
          ) : (
            offers.map((o) => {
              const pending =
                !o.seller_decision || o.seller_decision === "pending" || o.seller_status === "pending";

              const rank = getOfferRank(o.proposed_price, terms?.seller_min_current);

              const closeProbability = getCloseProbability({
                proposedPrice: o.proposed_price,
                sellerMinCurrent: terms?.seller_min_current,
                sellerUrgency: terms?.seller_urgency,
                buyerUrgency: terms?.buyer_urgency,
              });

              return (
                <div key={o.id} className="card" style={{ padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>
                        Oferta: {money(o.proposed_price)}
                      </div>

                      <div
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: rank.color,
                          fontSize: 12,
                          fontWeight: 800,
                          marginTop: 8,
                          display: "inline-block",
                        }}
                      >
                        {rank.label}
                      </div>

                      {o.rationale ? (
                        <div className="small" style={{ marginTop: 8, opacity: 0.9 }}>
                          {o.rationale}
                        </div>
                      ) : null}

                      <div style={{ marginTop: 10 }}>
                        <div className="small" style={{ marginBottom: 4, opacity: 0.85 }}>
                          Probabilidad de cierre: <b>{closeProbability}%</b>
                        </div>
                        <div
                          style={{
                            width: 180,
                            height: 8,
                            borderRadius: 999,
                            background: "rgba(255,255,255,.08)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${closeProbability}%`,
                              height: "100%",
                              background: "rgba(34,197,94,.85)",
                            }}
                          />
                        </div>
                      </div>

                      <div className="small" style={{ marginTop: 8, opacity: 0.7 }}>
                        {o.created_at ? new Date(o.created_at).toLocaleString() : "—"} · Offer ID: {o.id}
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                      <span className="badge">
                        seller: {o.seller_decision ?? o.seller_status ?? "pending"}
                      </span>
                      <span className="badge" style={{ opacity: 0.8 }}>
                        buyer: {o.buyer_decision ?? o.buyer_status ?? "—"}
                      </span>

                      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                        <button
                          className="btn"
                          disabled={!pending || actingOfferId === o.id}
                          onClick={() => decideOffer(o.id, "accept")}
                        >
                          {actingOfferId === o.id ? "…" : "Aceptar"}
                        </button>
                        <button
                          className="btnGhost"
                          disabled={!pending || actingOfferId === o.id}
                          onClick={() => decideOffer(o.id, "reject")}
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
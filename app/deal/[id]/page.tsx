"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

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

export default function DealSellerPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const dealId = params?.id;

  const [loading, setLoading] = useState(true);
  const [deal, setDeal] = useState<DealRow | null>(null);
  const [terms, setTerms] = useState<DealTermsRow | null>(null);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actingOfferId, setActingOfferId] = useState<string | null>(null);

  const bestOffer = useMemo(() => {
    // “mejor” = mayor precio
    return [...offers]
      .filter((o) => typeof o.proposed_price === "number")
      .sort((a, b) => Number(b.proposed_price) - Number(a.proposed_price))[0];
  }, [offers]);

  async function loadAll() {
    setLoading(true);
    setErrorMsg(null);
    setActionMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      router.push("/login");
      return;
    }

    // 1) Deal
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

    // Solo dueño
    if (dealData.owner_user_id && dealData.owner_user_id !== auth.user.id) {
      setErrorMsg("No tienes permiso para ver este deal.");
      setLoading(false);
      return;
    }

    setDeal(dealData as DealRow);

    // 2) Terms (puede no existir si falló al crear)
    const { data: termsData } = await supabase
      .from("deal_terms")
      .select(
        "deal_id,seller_initial,seller_min,seller_min_current,seller_urgency,buyer_max,buyer_initial_offer,buyer_urgency,updated_at"
      )
      .eq("deal_id", dealId)
      .maybeSingle();

    setTerms((termsData ?? null) as DealTermsRow | null);

    // 3) Offers
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  async function decideOffer(offerId: string, decision: "accept" | "reject") {
    setActingOfferId(offerId);
    setActionMsg(null);

    try {
      // Ajusta esto a como quieras registrar estado.
      // En tu tabla ya existe seller_decision y seller_status.
      const patch: Partial<OfferRow> = {
        seller_decision: decision,
        seller_status: decision,
      };

      const { error } = await supabase.from("offers").update(patch).eq("id", offerId);
      if (error) throw error;

      setActionMsg(decision === "accept" ? "✅ Oferta aceptada." : "🟠 Oferta rechazada.");
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

      {/* Producto */}
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

      {/* Terms (vendedor) */}
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

      {/* Offers */}
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
              return (
                <div key={o.id} className="card" style={{ padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>
                        Oferta: {money(o.proposed_price)}
                      </div>
                      <div className="small" style={{ marginTop: 4, opacity: 0.8 }}>
                        {o.created_at ? new Date(o.created_at).toLocaleString() : "—"} · Offer ID: {o.id}
                      </div>
                      {o.rationale ? (
                        <div className="small" style={{ marginTop: 8, opacity: 0.9 }}>
                          {o.rationale}
                        </div>
                      ) : null}
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
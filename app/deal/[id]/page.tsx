"use client";

import { useEffect, useState } from "react";
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

export default function DealPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const dealId = params?.id; // <- ahora sí

  const [loading, setLoading] = useState(true);
  const [deal, setDeal] = useState<DealRow | null>(null);
  const [terms, setTerms] = useState<DealTermsRow | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrorMsg(null);

      // ✅ evita query con undefined
      if (!dealId) {
        setErrorMsg("No llegó el ID del deal en la URL.");
        setLoading(false);
        return;
      }

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

      // Solo dueño (si quieres)
      if (dealData.owner_user_id && dealData.owner_user_id !== auth.user.id) {
        setErrorMsg("No tienes permiso para ver este deal.");
        setLoading(false);
        return;
      }

      setDeal(dealData as DealRow);

      // 2) Terms
      const { data: termsData, error: termsErr } = await supabase
        .from("deal_terms")
        .select(
          "deal_id,seller_initial,seller_min,seller_min_current,seller_urgency,buyer_max,buyer_initial_offer,buyer_urgency,updated_at"
        )
        .eq("deal_id", dealId)
        .maybeSingle();

      if (termsErr) setTerms(null);
      else setTerms((termsData ?? null) as DealTermsRow | null);

      setLoading(false);
    })();
  }, [dealId, router]);

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
            <img className="productImg" src={deal.product_image_url} alt="img" />
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
              {new Date(deal.created_at).toLocaleString()} · ${deal.product_price_public ?? "—"}
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
          <div className="muted">No se encontraron términos para este deal.</div>
        ) : (
          <div className="grid" style={{ gap: 10 }}>
            <div className="row">
              <div className="muted">seller_initial</div>
              <div>${terms.seller_initial ?? "—"}</div>
            </div>
            <div className="row">
              <div className="muted">seller_min</div>
              <div>${terms.seller_min ?? "—"}</div>
            </div>
            <div className="row">
              <div className="muted">seller_min_current</div>
              <div>${terms.seller_min_current ?? "—"}</div>
            </div>
            <div className="row">
              <div className="muted">seller_urgency</div>
              <div>{terms.seller_urgency ?? "—"}</div>
            </div>

            <hr style={{ opacity: 0.15 }} />

            <div className="row">
              <div className="muted">buyer_max</div>
              <div>${terms.buyer_max ?? "—"}</div>
            </div>
            <div className="row">
              <div className="muted">buyer_initial_offer</div>
              <div>${terms.buyer_initial_offer ?? "—"}</div>
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
    </main>
  );
}
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export default function ShopItemPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const dealId = params?.id; // <- importante

  const [loading, setLoading] = useState(true);
  const [deal, setDeal] = useState<DealRow | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [offer, setOffer] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const offerNumber = useMemo(() => Number(offer), [offer]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrorMsg(null);

      if (!dealId || !isUuid(dealId)) {
        setErrorMsg("ID inválido.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("deals")
        .select("id,status,created_at,product_title,product_description,product_price_public,product_image_url")
        .eq("id", dealId)
        .maybeSingle();

      if (error || !data) {
        setErrorMsg(error?.message ?? "Producto no encontrado.");
        setLoading(false);
        return;
      }

      if (data.status !== "active") {
        setErrorMsg("Este producto ya no está disponible.");
        setLoading(false);
        return;
      }

      setDeal(data as DealRow);
      setLoading(false);
    })();
  }, [dealId]);

  async function proposePrice() {
    if (!deal) return;

    if (!Number.isFinite(offerNumber) || offerNumber <= 0) {
      setToast("Ingresa un precio válido.");
      return;
    }

    setSending(true);
    setToast(null);

    try {
      const res = await fetch("/api/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deal_id: deal.id,
          proposed_price: offerNumber,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "No se pudo enviar la propuesta.");

      setToast("✅ Propuesta enviada.");
      setOffer("");
    } catch (e: any) {
      setToast(`❌ ${e.message ?? "Error"}`);
    } finally {
      setSending(false);
    }
  }

  if (loading) return <main className="container">Cargando…</main>;

  if (errorMsg) {
    return (
      <main className="container">
        <h1 className="h1">Producto</h1>
        <div className="sub">{errorMsg}</div>
        <div style={{ marginTop: 16 }}>
          <button className="btnGhost" onClick={() => router.push("/shop")}>
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
          <h1 className="h1">Producto</h1>
          <div className="sub">ID: {deal.id}</div>
        </div>
        <div className="btnRow">
          <button className="btnGhost" onClick={() => router.push("/shop")}>
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
              <div style={{ fontWeight: 800, fontSize: 20 }}>{deal.product_title ?? "(sin título)"}</div>
              <span className="badge">{deal.status}</span>
            </div>

            <div className="small" style={{ marginTop: 6 }}>
              ${deal.product_price_public ?? "—"} · {new Date(deal.created_at).toLocaleString()}
            </div>

            {deal.product_description ? (
              <div className="small" style={{ marginTop: 10, opacity: 0.9 }}>
                {deal.product_description}
              </div>
            ) : null}

            <div style={{ marginTop: 18, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input
                className="input"
                style={{ maxWidth: 220 }}
                placeholder="Tu oferta (ej: 35000)"
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                inputMode="numeric"
              />
              <button className="btn" disabled={sending} onClick={proposePrice}>
                {sending ? "Enviando…" : "Proponer precio"}
              </button>
              {toast ? <span className="small" style={{ opacity: 0.85 }}>{toast}</span> : null}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
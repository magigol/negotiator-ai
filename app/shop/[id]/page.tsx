"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type DealRow = {
  id: string;
  status: string | null;
  created_at: string;
  product_title: string | null;
  product_description: string | null;
  product_price_public: number | null;
  product_image_url: string | null;
};

export default function ShopProductPage({ params }: { params: { id?: string } }) {
  const router = useRouter();

  // ✅ Evita "undefined"
  const dealId = useMemo(() => (params?.id ? String(params.id) : ""), [params]);

  const [loading, setLoading] = useState(true);
  const [deal, setDeal] = useState<DealRow | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal oferta
  const [showOffer, setShowOffer] = useState(false);
  const [price, setPrice] = useState<number>(0);
  const [rationale, setRationale] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrorMsg(null);

      if (!dealId) {
        setErrorMsg("ID inválido.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("deals")
        .select("id,status,created_at,product_title,product_description,product_price_public,product_image_url")
        .eq("id", dealId)
        // si quieres que en tienda solo se vea lo "active", descomenta:
        // .eq("status", "active")
        .maybeSingle();

      if (error || !data) {
        setErrorMsg(error?.message ?? "Producto no encontrado.");
        setDeal(null);
        setLoading(false);
        return;
      }

      setDeal(data as DealRow);
      setLoading(false);
    })();
  }, [dealId]);

  async function submitOffer() {
    setToast(null);

    // Requiere login para proponer
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      router.push("/login");
      return;
    }

    if (!dealId) {
      setToast("No se encontró el id del producto.");
      return;
    }

    if (!price || price <= 0) {
      setToast("Ingresa un precio válido.");
      return;
    }

    setSending(true);

    const { error } = await supabase.from("offers").insert({
      deal_id: dealId,
      proposed_price: price,
      rationale: rationale.trim() || null,
      // Si tu tabla exige defaults y no los tiene, agrega aquí:
      // buyer_status: "pending",
      // seller_status: "pending",
    });

    setSending(false);

    if (error) {
      setToast(error.message);
      return;
    }

    setToast("✅ Oferta enviada");
    setShowOffer(false);
    setPrice(0);
    setRationale("");
  }

  if (loading) {
    return <main className="container">Cargando…</main>;
  }

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
            <img className="productImg" src={deal.product_image_url} alt="img" />
          ) : (
            <div className="productImg" />
          )}

          <div style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>
                {deal.product_title ?? "(sin título)"}
              </div>
              <span className="badge">{deal.status ?? "—"}</span>
            </div>

            <div className="small" style={{ marginTop: 6 }}>
              ${deal.product_price_public ?? "—"} · {new Date(deal.created_at).toLocaleDateString()}
            </div>

            {deal.product_description ? (
              <div className="small" style={{ marginTop: 10, opacity: 0.9 }}>
                {deal.product_description}
              </div>
            ) : null}

            <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
              <button className="btnPrimary" onClick={() => setShowOffer(true)}>
                Proponer precio
              </button>
            </div>

            {toast && (
              <div className="small" style={{ marginTop: 12, opacity: 0.9 }}>
                {toast}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showOffer && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onClick={() => !sending && setShowOffer(false)}
        >
          <div className="card" style={{ width: "100%", maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Proponer precio</div>
            <div className="small" style={{ marginTop: 6, opacity: 0.85 }}>
              Oferta para: {deal.product_title ?? "Producto"}
            </div>

            <div style={{ marginTop: 14 }}>
              <label className="small">Tu precio</label>
              <input
                className="input"
                type="number"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                placeholder="Ej: 30000"
                min={0}
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <label className="small">Mensaje (opcional)</label>
              <textarea
                className="textarea"
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="Ej: puedo retirar hoy, pago al contado..."
                rows={4}
              />
            </div>

            {toast && (
              <div className="small" style={{ marginTop: 12 }}>
                {toast}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="btnGhost" onClick={() => setShowOffer(false)} disabled={sending}>
                Cancelar
              </button>

              <button className="btnPrimary" onClick={submitOffer} disabled={sending}>
                {sending ? "Enviando…" : "Enviar oferta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
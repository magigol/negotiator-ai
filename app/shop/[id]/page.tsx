"use client";

import { useEffect, useState } from "react";
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
};

export default function ShopDealPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [deal, setDeal] = useState<DealRow | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from("deals")
        .select("id,status,created_at,product_title,product_description,product_price_public,product_image_url")
        .eq("id", id)
        .maybeSingle();

      if (error || !data) {
        setErrorMsg(error?.message ?? "No se encontró el producto.");
      } else {
        setDeal(data as DealRow);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <main className="container">Cargando…</main>;

  if (errorMsg) {
    return (
      <main className="container">
        <h1 className="h1">Producto</h1>
        <div className="sub">{errorMsg}</div>
        <div style={{ marginTop: 16 }}>
          <button className="btnGhost" onClick={() => router.push("/shop")}>Volver</button>
        </div>
      </main>
    );
  }

  if (!deal) return null;

  return (
    <main className="container">
      <div className="header">
        <div>
          <h1 className="h1">{deal.product_title ?? "Producto"}</h1>
          <div className="sub">${deal.product_price_public ?? "—"} · {new Date(deal.created_at).toLocaleString()}</div>
        </div>
        <div className="btnRow">
          <button className="btnGhost" onClick={() => router.push("/shop")}>Volver</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="productCard">
          {deal.product_image_url ? (
            <img className="productImg" src={deal.product_image_url} alt={deal.product_title ?? "producto"} />
          ) : (
            <div className="productImg" />
          )}
          <div style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span className="badge">{deal.status}</span>
            </div>

            {deal.product_description ? (
              <div className="small" style={{ marginTop: 10, opacity: 0.9 }}>
                {deal.product_description}
              </div>
            ) : (
              <div className="muted" style={{ marginTop: 10 }}>Sin descripción.</div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
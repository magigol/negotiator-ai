"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

export default function ShopProductPage() {
  const params = useParams();
  const router = useRouter();

  const dealId = params?.id as string;

  const [deal, setDeal] = useState<DealRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) return;

    (async () => {
      const { data, error } = await supabase
        .from("deals")
        .select(
          "id,status,created_at,product_title,product_description,product_price_public,product_image_url"
        )
        .eq("id", dealId)
        .maybeSingle();

      if (error || !data) {
        setErrorMsg(error?.message ?? "Producto no encontrado.");
      } else {
        setDeal(data as DealRow);
      }

      setLoading(false);
    })();
  }, [dealId]);

  if (loading) return <main className="container">Cargando…</main>;

  if (errorMsg) {
    return (
      <main className="container">
        <h1 className="h1">Producto</h1>
        <div className="sub">{errorMsg}</div>
        <button className="btnGhost" onClick={() => router.push("/shop")}>
          Volver
        </button>
      </main>
    );
  }

  if (!deal) return null;

  return (
    <main className="container">
      <div className="header">
        <h1 className="h1">{deal.product_title}</h1>
      </div>

      <div className="card">
        {deal.product_image_url && (
          <img
            src={deal.product_image_url}
            className="productImg"
            alt="producto"
          />
        )}

        <div className="small">
          ${deal.product_price_public} ·{" "}
          {new Date(deal.created_at).toLocaleDateString()}
        </div>

        <div style={{ marginTop: 12 }}>
          {deal.product_description}
        </div>
      </div>
    </main>
  );
}
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type DealRow = {
  id: string;
  status: string;
  created_at: string;
  product_title: string | null;
  product_price_public: number | null;
  product_image_url: string | null;
  product_description: string | null;
};

export default function ShopPage() {
  const [items, setItems] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // IMPORTANTE: para tienda pública, tu RLS debe permitir SELECT a anon/authenticated
      const { data, error } = await supabase
        .from("deals")
        .select("id,status,created_at,product_title,product_price_public,product_image_url,product_description")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!error) setItems((data ?? []) as DealRow[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <main className="container">Cargando…</main>;

  return (
    <main className="container">
      <div className="header">
        <div>
          <h1 className="h1">Tienda</h1>
          <div className="sub">Publicaciones activas</div>
        </div>
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        {items.map((d) => (
          <Link key={d.id} href={`/shop/${d.id}`} className="card" style={{ textDecoration: "none" }}>
            <div className="productCard">
              {d.product_image_url ? (
                <img className="productImg" src={d.product_image_url} alt={d.product_title ?? "producto"} />
              ) : (
                <div className="productImg" />
              )}

              <div style={{ width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontWeight: 800 }}>{d.product_title ?? "(sin título)"}</div>
                  <span className="badge">{d.status}</span>
                </div>

                <div className="small" style={{ marginTop: 6 }}>
                  ${d.product_price_public ?? "—"} · {new Date(d.created_at).toLocaleDateString()}
                </div>

                {d.product_description ? (
                  <div className="small" style={{ marginTop: 8, opacity: 0.85 }}>
                    {d.product_description}
                  </div>
                ) : null}
              </div>
            </div>
          </Link>
        ))}

        {items.length === 0 && <div className="muted">Aún no hay publicaciones activas.</div>}
      </div>
    </main>
  );
}
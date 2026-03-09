"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `$${Number(n).toLocaleString("es-CL")}`;
}

export default function ShopPage() {
  const [items, setItems] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("deals")
        .select(
          "id,status,created_at,product_title,product_description,product_price_public,product_image_url"
        )
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (!error) {
        setItems((data ?? []) as DealRow[]);
      }

      setLoading(false);
    })();
  }, []);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return items;

    return items.filter((item) => {
      const title = item.product_title?.toLowerCase() ?? "";
      const desc = item.product_description?.toLowerCase() ?? "";
      return title.includes(q) || desc.includes(q);
    });
  }, [items, query]);

  if (loading) {
    return <main className="container">Cargando tienda…</main>;
  }

  return (
    <main className="container">
      <div className="header">
        <div>
          <h1 className="h1">Tienda</h1>
          <div className="sub">Explora productos publicados y negocia precios.</div>
        </div>

        <div className="btnRow">
          <Link className="btnGhost" href="/">
            Inicio
          </Link>
          <Link className="btnGhost" href="/create">
            Publicar
          </Link>
        </div>
      </div>

      {/* buscador */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input
            className="input"
            type="text"
            placeholder="Buscar por nombre o descripción..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, minWidth: 240 }}
          />

          <div className="small" style={{ opacity: 0.8 }}>
            {filteredItems.length} producto{filteredItems.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* grid marketplace */}
      {filteredItems.length === 0 ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="muted">No hay productos que coincidan con tu búsqueda.</div>
        </div>
      ) : (
        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {filteredItems.map((d) => (
            <Link
              key={d.id}
              href={`/shop/${d.id}`}
              className="card"
              style={{
                textDecoration: "none",
                color: "inherit",
                display: "block",
                transition: "transform .15s ease, box-shadow .15s ease",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {d.product_image_url ? (
                  <img
                    src={d.product_image_url}
                    alt={d.product_title ?? "producto"}
                    style={{
                      width: "100%",
                      height: 220,
                      objectFit: "cover",
                      borderRadius: 16,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: 220,
                      borderRadius: 16,
                      background: "rgba(255,255,255,.06)",
                    }}
                  />
                )}

                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 18,
                      lineHeight: 1.2,
                    }}
                  >
                    {d.product_title ?? "(sin título)"}
                  </div>

                  <span className="badge">{d.status}</span>
                </div>

                <div style={{ fontSize: 24, fontWeight: 900 }}>
                  {money(d.product_price_public)}
                </div>

                {d.product_description ? (
                  <div className="small" style={{ opacity: 0.85 }}>
                    {d.product_description.length > 110
                      ? `${d.product_description.slice(0, 110)}...`
                      : d.product_description}
                  </div>
                ) : null}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 6,
                  }}
                >
                  <div className="small" style={{ opacity: 0.7 }}>
                    {new Date(d.created_at).toLocaleDateString("es-CL")}
                  </div>

                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: 12,
                      background: "rgba(255,255,255,.08)",
                      fontWeight: 700,
                    }}
                  >
                    Ver producto
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
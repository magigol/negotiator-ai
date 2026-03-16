"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Deal = {
  id: string;
  status: string;
  created_at: string;
  product_title: string | null;
  product_description: string | null;
  product_price_public: number | null;
  product_image_url: string | null;
};

type Offer = {
  deal_id: string;
  proposed_price: number | null;
};

function money(n: number | null | undefined) {
  if (!n) return "—";
  return `$${Number(n).toLocaleString("es-CL")}`;
}

export default function ShopPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "all" | "available" | "negotiating" | "closed"
  >("all");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: dealsData } = await supabase
      .from("deals")
      .select(
        "id,status,created_at,product_title,product_description,product_price_public,product_image_url"
      )
      .in("status", ["active", "negotiating", "closed"])
      .order("created_at", { ascending: false });

    const { data: offersData } = await supabase
      .from("offers")
      .select("deal_id,proposed_price");

    setDeals((dealsData ?? []) as Deal[]);
    setOffers((offersData ?? []) as Offer[]);
  }

  const offerStats = useMemo(() => {
    const map = new Map<string, { count: number; best: number | null }>();

    for (const o of offers) {
      const s = map.get(o.deal_id) ?? { count: 0, best: null };

      s.count++;

      if (
        typeof o.proposed_price === "number" &&
        (s.best === null || o.proposed_price > s.best)
      ) {
        s.best = o.proposed_price;
      }

      map.set(o.deal_id, s);
    }

    return map;
  }, [offers]);

  const filteredDeals = useMemo(() => {
    let list = deals;

    if (filter === "available") {
      list = list.filter((d) => d.status === "active");
    }

    if (filter === "negotiating") {
      list = list.filter((d) => d.status === "negotiating");
    }

    if (filter === "closed") {
      list = list.filter((d) => d.status === "closed");
    }

    if (search.trim()) {
      const s = search.toLowerCase();

      list = list.filter(
        (d) =>
          d.product_title?.toLowerCase().includes(s) ||
          d.product_description?.toLowerCase().includes(s)
      );
    }

    return list;
  }, [deals, search, filter]);

  return (
    <main className="container">
      <div className="header">
        <div>
          <h1 className="h1">Tienda</h1>
          <div className="sub">
            Explora productos publicados y negocia precios.
          </div>
        </div>

        <div className="btnRow">
          <Link className="btnGhost" href="/">
            Inicio
          </Link>
          <Link className="btn" href="/create">
            Publicar
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            className="input"
            placeholder="Buscar por nombre o descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />

          <div className="small">{filteredDeals.length} productos</div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="btnGhost" onClick={() => setFilter("all")}>
            Todos
          </button>

          <button className="btnGhost" onClick={() => setFilter("available")}>
            Disponibles
          </button>

          <button className="btnGhost" onClick={() => setFilter("negotiating")}>
            En negociación
          </button>

          <button className="btnGhost" onClick={() => setFilter("closed")}>
            Vendidos
          </button>
        </div>
      </div>

      {filteredDeals.length === 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          No hay productos que coincidan con tu búsqueda.
        </div>
      ) : (
        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
            gap: 16,
          }}
        >
          {filteredDeals.map((d) => {
            const stats = offerStats.get(d.id) ?? {
              count: 0,
              best: null,
            };

            return (
              <div key={d.id} className="card">
                {d.product_image_url ? (
                  <img
                    src={d.product_image_url}
                    style={{
                      width: "100%",
                      height: 200,
                      objectFit: "cover",
                      borderRadius: 12,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: 200,
                      borderRadius: 12,
                      background: "rgba(255,255,255,.06)",
                    }}
                  />
                )}

                <div style={{ marginTop: 10, fontWeight: 800 }}>
                  {d.product_title}
                </div>

                <div style={{ fontSize: 22, fontWeight: 900 }}>
                  {money(d.product_price_public)}
                </div>

                <div style={{ marginTop: 6 }}>
                  {d.status === "active" && (
                    <span className="badge">🟢 Disponible</span>
                  )}

                  {d.status === "negotiating" && (
                    <span className="badge">🟡 En negociación</span>
                  )}

                  {d.status === "closed" && (
                    <span className="badge">🔴 Vendido</span>
                  )}
                </div>

                <div className="small" style={{ marginTop: 6 }}>
                  {stats.count} ofertas
                </div>

                <Link
                  href={`/shop/${d.id}`}
                  className="btnGhost"
                  style={{ marginTop: 10 }}
                >
                  Ver producto
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
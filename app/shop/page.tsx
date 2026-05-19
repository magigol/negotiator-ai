"use client";

/*
 * File: app/shop/page.tsx
 * Purpose: Archivo de código personalizado

 */


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

type OfferRow = {
  id: string;
  deal_id: string;
  proposed_price: number | null;
  created_at: string | null;
};

type StatusFilter = "all" | "active" | "negotiating" | "closed";

// Helper de utilidad para transformaciones de datos y renderizado.
function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `$${Number(n).toLocaleString("es-CL")}`;
}

// Función auxiliar: getDemandBadge.
function getDemandBadge(offerCount: number) {
  if (offerCount >= 3) {
    return {
      label: "🔥 Alta demanda",
      bg: "rgba(239,68,68,.18)",
    };
  }

  if (offerCount >= 1) {
    return {
      label: "🟡 Interés moderado",
      bg: "rgba(234,179,8,.18)",
    };
  }

  return {
    label: "🟢 Sin ofertas",
    bg: "rgba(34,197,94,.18)",
  };
}

// Función auxiliar: getStatusBadge.
function getStatusBadge(status: string) {
  if (status === "closed") {
    return {
      label: "✅ Vendido",
      bg: "rgba(34,197,94,.18)",
      border: "1px solid rgba(34,197,94,.28)",
      glow: "0 0 0 rgba(0,0,0,0)",
      dot: "#22c55e",
      animated: false,
    };
  }

  if (status === "negotiating") {
    return {
      label: "⏳ En negociación",
      bg: "rgba(234,179,8,.16)",
      border: "1px solid rgba(234,179,8,.34)",
      glow: "0 0 18px rgba(234,179,8,.14)",
      dot: "#eab308",
      animated: true,
    };
  }

  return {
    label: "🟢 Disponible",
    bg: "rgba(59,130,246,.16)",
    border: "1px solid rgba(59,130,246,.30)",
    glow: "0 0 0 rgba(0,0,0,0)",
    dot: "#3b82f6",
    animated: false,
  };
}

// Página/Componente exportado: ShopPage.
export default function ShopPage() {
  const [items, setItems] = useState<DealRow[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
// Estado local de React para datos de UI y formularios.
  const [loading, setLoading] = useState(true);
// Estado local de React para datos de UI y formularios.
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

// Efecto de React que se ejecuta cuando cambian las dependencias.
  useEffect(() => {
    (async () => {
      // Carga inicial de productos y ofertas para mostrar la tienda.
      setLoading(true);

      const { data: dealsData, error: dealsErr } = await supabase
        .from("deals")
        .select(
          "id,status,created_at,product_title,product_description,product_price_public,product_image_url"
        )
        .in("status", ["active", "negotiating", "closed"])
        .order("created_at", { ascending: false });

      if (!dealsErr) {
        setItems((dealsData ?? []) as DealRow[]);
      }

      const { data: offersData, error: offersErr } = await supabase
        .from("offers")
        .select("id,deal_id,proposed_price,created_at")
        .order("created_at", { ascending: false });

      if (!offersErr) {
        setOffers((offersData ?? []) as OfferRow[]);
      }

      setLoading(false);
    })();
  }, []);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    // Filtrar productos por búsqueda y por estado seleccionado.
    return items.filter((item) => {
      const title = item.product_title?.toLowerCase() ?? "";
      const desc = item.product_description?.toLowerCase() ?? "";

      const matchesQuery = !q || title.includes(q) || desc.includes(q);
      const matchesStatus =
        statusFilter === "all" ? true : item.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [items, query, statusFilter]);

  const offerStatsByDeal = useMemo(() => {
    // Agrupa ofertas por deal para mostrar demanda y mejor oferta.
    const stats = new Map<
      string,
      {
        count: number;
        bestOffer: number | null;
      }
    >();

    for (const o of offers) {
      if (!o.deal_id) continue;

      const current = stats.get(o.deal_id) ?? {
        count: 0,
        bestOffer: null,
      };

      current.count += 1;

      if (
        typeof o.proposed_price === "number" &&
        (current.bestOffer === null || o.proposed_price > current.bestOffer)
      ) {
        current.bestOffer = o.proposed_price;
      }

      stats.set(o.deal_id, current);
    }

    return stats;
  }, [offers]);

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

      <div className="card" style={{ marginTop: 12 }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
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

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 12,
          }}
        >
          <button
            className={statusFilter === "all" ? "btn" : "btnGhost"}
            onClick={() => setStatusFilter("all")}
          >
            Todos
          </button>

          <button
            className={statusFilter === "active" ? "btn" : "btnGhost"}
            onClick={() => setStatusFilter("active")}
          >
            Disponibles
          </button>

          <button
            className={statusFilter === "negotiating" ? "btn" : "btnGhost"}
            onClick={() => setStatusFilter("negotiating")}
          >
            En negociación
          </button>

          <button
            className={statusFilter === "closed" ? "btn" : "btnGhost"}
            onClick={() => setStatusFilter("closed")}
          >
            Vendidos
          </button>
        </div>
      </div>

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
          {filteredItems.map((d) => {
            const stats = offerStatsByDeal.get(d.id) ?? {
              count: 0,
              bestOffer: null,
            };

            const demand = getDemandBadge(stats.count);
            const statusBadge = getStatusBadge(d.status);

            return (
              <Link
                key={d.id}
                href={`/shop/${d.id}`}
                className="card"
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  display: "block",
                  transition: "transform .15s ease, box-shadow .15s ease",
                  border:
                    d.status === "negotiating"
                      ? "1px solid rgba(234,179,8,.22)"
                      : undefined,
                  boxShadow:
                    d.status === "negotiating"
                      ? "0 0 22px rgba(234,179,8,.06)"
                      : undefined,
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

                  <div style={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>
                    {d.product_title ?? "(sin título)"}
                  </div>

                  <div style={{ fontSize: 24, fontWeight: 900 }}>
                    {money(d.product_price_public)}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "7px 12px",
                        borderRadius: 999,
                        background: statusBadge.bg,
                        border: statusBadge.border,
                        boxShadow: statusBadge.glow,
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      <span
                        className={statusBadge.animated ? "statusDotPulse" : ""}
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: statusBadge.dot,
                          display: "inline-block",
                          flexShrink: 0,
                        }}
                      />
                      {statusBadge.label}
                    </div>

                    <div
                      style={{
                        padding: "7px 10px",
                        borderRadius: 999,
                        background: demand.bg,
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {demand.label}
                    </div>

                    <div
                      style={{
                        padding: "7px 10px",
                        borderRadius: 999,
                        background: "rgba(255,255,255,.08)",
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {stats.count} oferta{stats.count !== 1 ? "s" : ""}
                    </div>
                  </div>

                  {stats.bestOffer !== null ? (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        background: "rgba(34,197,94,.10)",
                      }}
                    >
                      <div className="small" style={{ opacity: 0.8, marginBottom: 4 }}>
                        Mejor oferta actual
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 20 }}>
                        {money(stats.bestOffer)}
                      </div>
                    </div>
                  ) : null}

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
            );
          })}
        </div>
      )}
    </main>
  );
}
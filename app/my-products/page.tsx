"use client";

/*
 * File: app/my-products/page.tsx
 * Purpose: Archivo de código personalizado

 */


import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type DealRow = {
  id: string;
  status: string;
  created_at: string;
  owner_user_id: string | null;
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

type StatusFilter = "all" | "active" | "negotiating" | "closed" | "archived";

// Helper de utilidad para transformaciones de datos y renderizado.
function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `$${Number(n).toLocaleString("es-CL")}`;
}

// Función auxiliar: getStatusBadge.
function getStatusBadge(status: string) {
  if (status === "closed") {
    return {
      label: "✅ Vendido",
      bg: "rgba(34,197,94,.18)",
      border: "1px solid rgba(34,197,94,.28)",
    };
  }

  if (status === "negotiating") {
    return {
      label: "⏳ En negociación",
      bg: "rgba(234,179,8,.16)",
      border: "1px solid rgba(234,179,8,.34)",
    };
  }

  if (status === "archived") {
    return {
      label: "🗂️ Archivado",
      bg: "rgba(148,163,184,.16)",
      border: "1px solid rgba(148,163,184,.30)",
    };
  }

  return {
    label: "🟢 Disponible",
    bg: "rgba(59,130,246,.16)",
    border: "1px solid rgba(59,130,246,.30)",
  };
}

// Página/Componente exportado: MyProductsPage.
export default function MyProductsPage() {
  const router = useRouter();

// Estado local de React para datos de UI y formularios.
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
// Estado local de React para datos de UI y formularios.
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [items, setItems] = useState<DealRow[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);

  async function loadData() {
    // Carga los productos del usuario y las ofertas asociadas.
    setErrorMsg(null);

    const { data: auth, error: authErr } = await supabase.auth.getUser();

    if (authErr) {
      setErrorMsg(authErr.message);
      setLoading(false);
      return;
    }

    if (!auth?.user?.id) {
      router.push(`/login?next=${encodeURIComponent("/my-products")}`);
      return;
    }

    const userId = auth.user.id;

    const { data: dealsData, error: dealsErr } = await supabase
      .from("deals")
      .select(
        "id,status,created_at,owner_user_id,product_title,product_description,product_price_public,product_image_url"
      )
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false });

    if (dealsErr) {
      setErrorMsg(dealsErr.message);
      setLoading(false);
      return;
    }

    const dealIds = (dealsData ?? []).map((d) => d.id);

    let offersData: OfferRow[] = [];

    if (dealIds.length > 0) {
      const { data: fetchedOffers, error: offersErr } = await supabase
        .from("offers")
        .select("id,deal_id,proposed_price,created_at")
        .in("deal_id", dealIds)
        .order("created_at", { ascending: false });

      if (offersErr) {
        setErrorMsg(offersErr.message);
        setLoading(false);
        return;
      }

      offersData = (fetchedOffers ?? []) as OfferRow[];
    }

    setItems((dealsData ?? []) as DealRow[]);
    setOffers(offersData);
    setLoading(false);
  }

// Efecto de React que se ejecuta cuando cambian las dependencias.
  useEffect(() => {
    let mounted = true;

    async function init() {
      // Inicializa la página y establece un canal en tiempo real.
      if (!mounted) return;
      setLoading(true);
      await loadData();
    }

    init();

    const channel = supabase
      .channel("my-products-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deals" },
        () => {
          loadData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "offers" },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const offerStatsByDeal = useMemo(() => {
    // Genera métricas de oferta por producto para mostrar demanda y mejor oferta.
    const map = new Map<
      string,
      {
        count: number;
        bestOffer: number | null;
      }
    >();

    for (const o of offers) {
      const current = map.get(o.deal_id) ?? {
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

      map.set(o.deal_id, current);
    }

    return map;
  }, [offers]);

  const filteredItems = useMemo(() => {
    // Aplicar filtro de búsqueda y filtro por estado en los productos del vendedor.
    const q = query.trim().toLowerCase();

    return items.filter((item) => {
      const title = item.product_title?.toLowerCase() ?? "";
      const desc = item.product_description?.toLowerCase() ?? "";

      const matchesQuery = !q || title.includes(q) || desc.includes(q);
      const matchesStatus =
        statusFilter === "all" ? true : item.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [items, query, statusFilter]);

  if (loading) {
    return <main className="container">Cargando tus productos…</main>;
  }

  if (errorMsg) {
    return (
      <main className="container">
        <div className="header">
          <div>
            <h1 className="h1">Mis productos</h1>
            <div className="sub">{errorMsg}</div>
          </div>
          <div className="btnRow">
            <button className="btnGhost" onClick={() => router.push("/dashboard")}>
              Volver
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="header">
        <div>
          <h1 className="h1">Mis productos</h1>
          <div className="sub">
            Gestiona tus publicaciones, revisa ofertas y administra el estado de cada producto.
          </div>
        </div>

        <div className="btnRow">
          <Link className="btnGhost" href="/dashboard">
            Dashboard
          </Link>
          <Link className="btn" href="/create">
            Publicar nuevo
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

          <button
            className={statusFilter === "archived" ? "btn" : "btnGhost"}
            onClick={() => setStatusFilter("archived")}
          >
            Archivados
          </button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="muted">No tienes productos que coincidan con el filtro.</div>
        </div>
      ) : (
        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
            gap: 16,
          }}
        >
          {filteredItems.map((item) => {
            const stats = offerStatsByDeal.get(item.id) ?? {
              count: 0,
              bestOffer: null,
            };

            const statusBadge = getStatusBadge(item.status);

            return (
              <div
                key={item.id}
                className="card"
                style={{
                  border:
                    item.status === "negotiating"
                      ? "1px solid rgba(234,179,8,.22)"
                      : item.status === "archived"
                      ? "1px solid rgba(148,163,184,.22)"
                      : undefined,
                  boxShadow:
                    item.status === "negotiating"
                      ? "0 0 22px rgba(234,179,8,.06)"
                      : undefined,
                  opacity: item.status === "archived" ? 0.88 : 1,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {item.product_image_url ? (
                    <img
                      src={item.product_image_url}
                      alt={item.product_title ?? "producto"}
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
                    {item.product_title ?? "(sin título)"}
                  </div>

                  <div style={{ fontSize: 24, fontWeight: 900 }}>
                    {money(item.product_price_public)}
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
                        padding: "7px 10px",
                        borderRadius: 999,
                        background: statusBadge.bg,
                        border: statusBadge.border,
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {statusBadge.label}
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

                  {item.product_description ? (
                    <div className="small" style={{ opacity: 0.85 }}>
                      {item.product_description.length > 110
                        ? `${item.product_description.slice(0, 110)}...`
                        : item.product_description}
                    </div>
                  ) : null}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                      marginTop: 6,
                    }}
                  >
                    <div className="small" style={{ opacity: 0.7 }}>
                      {new Date(item.created_at).toLocaleDateString("es-CL")}
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Link className="btnGhost" href={`/deal/${item.id}`}>
                        Ver deal
                      </Link>

                      <Link
                        className="btnGhost"
                        href={`/my-products/${item.id}/edit`}
                      >
                        {item.status === "archived" ? "Reactivar" : "Editar"}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
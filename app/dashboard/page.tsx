"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import DashboardCharts from "@/components/DashboardCharts";
import SalesAdvisor from "@/components/SalesAdvisor";

type DealRow = {
  id: string;
  status: string;
  created_at: string;
  owner_user_id: string | null;
  buyer_user_id?: string | null;
  final_price?: number | null;
  product_title: string | null;
  product_description: string | null;
  product_price_public: number | null;
  product_image_url: string | null;
};

type OfferRow = {
  id: string;
  deal_id: string;
  buyer_user_id: string | null;
  proposed_price: number | null;
  created_at: string | null;
};

type MonthlyPoint = {
  name: string;
  value: number;
};

type ProductPoint = {
  name: string;
  value: number;
};

function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `$${Number(n).toLocaleString("es-CL")}`;
}

function statCard(title: string, value: string | number, sub?: string) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="small" style={{ opacity: 0.75 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 900 }}>{value}</div>
      {sub && <div className="small">{sub}</div>}
    </div>
  );
}

function buildLastSixMonthsLabels() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("es-CL", {
    month: "short",
    year: "2-digit",
  });

  const labels: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(formatter.format(d));
  }
  return labels;
}

function buildMonthlySeriesFromDeals(deals: DealRow[]): MonthlyPoint[] {
  const labels = buildLastSixMonthsLabels();
  const formatter = new Intl.DateTimeFormat("es-CL", {
    month: "short",
    year: "2-digit",
  });

  const map = new Map<string, number>();
  labels.forEach((label) => map.set(label, 0));

  for (const deal of deals) {
    if (!deal.created_at) continue;
    if (!deal.final_price) continue;

    const date = new Date(deal.created_at);
    const key = formatter.format(new Date(date.getFullYear(), date.getMonth(), 1));

    if (map.has(key)) {
      map.set(key, (map.get(key) ?? 0) + Number(deal.final_price ?? 0));
    }
  }

  return labels.map((label) => ({
    name: label,
    value: map.get(label) ?? 0,
  }));
}

function buildMonthlySeriesFromOffers(offers: OfferRow[]): MonthlyPoint[] {
  const labels = buildLastSixMonthsLabels();
  const formatter = new Intl.DateTimeFormat("es-CL", {
    month: "short",
    year: "2-digit",
  });

  const map = new Map<string, number>();
  labels.forEach((label) => map.set(label, 0));

  for (const offer of offers) {
    if (!offer.created_at) continue;

    const date = new Date(offer.created_at);
    const key = formatter.format(new Date(date.getFullYear(), date.getMonth(), 1));

    if (map.has(key)) {
      map.set(key, (map.get(key) ?? 0) + 1);
    }
  }

  return labels.map((label) => ({
    name: label,
    value: map.get(label) ?? 0,
  }));
}

function buildTopProductsByRevenue(deals: DealRow[]): ProductPoint[] {
  return deals
    .filter((d) => d.status === "closed" && Number(d.final_price ?? 0) > 0)
    .map((d) => ({
      name:
        (d.product_title ?? "Sin título").length > 18
          ? `${(d.product_title ?? "Sin título").slice(0, 18)}...`
          : (d.product_title ?? "Sin título"),
      value: Number(d.final_price ?? 0),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [ownedDeals, setOwnedDeals] = useState<DealRow[]>([]);
  const [buyerOffers, setBuyerOffers] = useState<OfferRow[]>([]);
  const [wonDeals, setWonDeals] = useState<DealRow[]>([]);

  async function loadData() {
    setErrorMsg(null);

    const { data: auth } = await supabase.auth.getUser();

    if (!auth?.user?.id) {
      router.push(`/login?next=${encodeURIComponent("/dashboard")}`);
      return;
    }

    const userId = auth.user.id;

    const { data: ownedDealsData, error: ownedDealsErr } = await supabase
      .from("deals")
      .select(
        "id,status,created_at,owner_user_id,buyer_user_id,final_price,product_title,product_description,product_price_public,product_image_url"
      )
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false });

    if (ownedDealsErr) {
      setErrorMsg(ownedDealsErr.message);
      setLoading(false);
      return;
    }

    const { data: buyerOffersData, error: buyerOffersErr } = await supabase
      .from("offers")
      .select("id,deal_id,buyer_user_id,proposed_price,created_at")
      .eq("buyer_user_id", userId)
      .order("created_at", { ascending: false });

    if (buyerOffersErr) {
      setErrorMsg(buyerOffersErr.message);
      setLoading(false);
      return;
    }

    const { data: wonDealsData, error: wonDealsErr } = await supabase
      .from("deals")
      .select(
        "id,status,created_at,owner_user_id,buyer_user_id,final_price,product_title,product_description,product_price_public,product_image_url"
      )
      .eq("buyer_user_id", userId)
      .eq("status", "closed")
      .order("created_at", { ascending: false });

    if (wonDealsErr) {
      setErrorMsg(wonDealsErr.message);
      setLoading(false);
      return;
    }

    setOwnedDeals((ownedDealsData ?? []) as DealRow[]);
    setBuyerOffers((buyerOffersData ?? []) as OfferRow[]);
    setWonDeals((wonDealsData ?? []) as DealRow[]);
    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (!mounted) return;
      setLoading(true);
      await loadData();
    }

    init();

    const channel = supabase
      .channel("dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "deals" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "offers" }, loadData)
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const stats = useMemo(() => {
    const published = ownedDeals.length;
    const active = ownedDeals.filter((d) => d.status === "active").length;
    const negotiating = ownedDeals.filter((d) => d.status === "negotiating").length;
    const sold = ownedDeals.filter((d) => d.status === "closed").length;

    const revenue = ownedDeals
      .filter((d) => d.status === "closed")
      .reduce((acc, d) => acc + Number(d.final_price ?? 0), 0);

    const offersMade = buyerOffers.length;
    const wins = wonDeals.length;

    const spent = wonDeals.reduce(
      (acc, d) => acc + Number(d.final_price ?? 0),
      0
    );

    const ticketPromedio = sold > 0 ? revenue / sold : 0;

    return {
      published,
      active,
      negotiating,
      sold,
      revenue,
      offersMade,
      wins,
      spent,
      ticketPromedio,
    };
  }, [ownedDeals, buyerOffers, wonDeals]);

  const revenueByMonth = useMemo(() => {
    const soldDeals = ownedDeals.filter((d) => d.status === "closed");
    return buildMonthlySeriesFromDeals(soldDeals);
  }, [ownedDeals]);

  const offersByMonth = useMemo(() => {
    return buildMonthlySeriesFromOffers(buyerOffers);
  }, [buyerOffers]);

  const topProductsByRevenue = useMemo(() => {
    return buildTopProductsByRevenue(ownedDeals);
  }, [ownedDeals]);

  const productPerformance = useMemo(() => {
    return ownedDeals
      .filter((d) => d.status === "closed")
      .map((d) => {
        const publicPrice = Number(d.product_price_public ?? 0);
        const finalPrice = Number(d.final_price ?? 0);
        const diff = finalPrice - publicPrice;
        const pct = publicPrice > 0 ? (diff / publicPrice) * 100 : 0;

        return {
          id: d.id,
          title: d.product_title ?? "Sin título",
          status: d.status,
          publicPrice,
          finalPrice,
          diff,
          pct,
          createdAt: d.created_at,
        };
      })
      .sort((a, b) => b.finalPrice - a.finalPrice);
  }, [ownedDeals]);

  if (loading) return <main className="container">Cargando…</main>;

  if (errorMsg) {
    return (
      <main className="container">
        <div className="header">
          <div>
            <h1 className="h1">Dashboard</h1>
            <div className="sub">{errorMsg}</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="header">
        <div>
          <h1 className="h1">Dashboard</h1>
          <div className="sub">Resumen de tu actividad</div>
        </div>

        <div className="btnRow">
          <Link className="btnGhost" href="/shop">Tienda</Link>
          <Link className="btnGhost" href="/my-products">Mis productos</Link>
          <Link className="btnGhost" href="/my-offers">Mis ofertas</Link>
          <Link className="btn" href="/create">Publicar</Link>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {statCard("Publicados", stats.published)}
        {statCard("Disponibles", stats.active)}
        {statCard("Negociando", stats.negotiating)}
        {statCard("Vendidos", stats.sold, `Ingresos: ${money(stats.revenue)}`)}
        {statCard("Ofertas hechas", stats.offersMade)}
        {statCard("Compras ganadas", stats.wins, `Gastado: ${money(stats.spent)}`)}
        {statCard("Ticket promedio", money(stats.ticketPromedio))}
      </div>

      <DashboardCharts
        published={stats.published}
        active={stats.active}
        negotiating={stats.negotiating}
        sold={stats.sold}
        offersMade={stats.offersMade}
        wins={stats.wins}
        revenueByMonth={revenueByMonth}
        offersByMonth={offersByMonth}
        topProductsByRevenue={topProductsByRevenue}
      />

      <SalesAdvisor
        deals={ownedDeals}
        ticketPromedio={stats.ticketPromedio}
      />

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        <div className="card">
          <h3>Tus productos</h3>
          {ownedDeals.slice(0, 5).length === 0 ? (
            <div className="muted">Aún no tienes publicaciones.</div>
          ) : (
            ownedDeals.slice(0, 5).map((d) => (
              <div key={d.id} style={{ marginTop: 8 }}>
                {d.product_title} · {d.status}
              </div>
            ))
          )}
        </div>

        <div className="card">
          <h3>Tus compras</h3>
          {wonDeals.slice(0, 5).length === 0 ? (
            <div className="muted">Aún no tienes compras cerradas.</div>
          ) : (
            wonDeals.slice(0, 5).map((d) => (
              <div key={d.id} style={{ marginTop: 8 }}>
                {d.product_title} · {money(d.final_price)}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>
          Rendimiento por producto
        </div>

        {productPerformance.length === 0 ? (
          <div className="muted">Aún no tienes ventas cerradas para analizar.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                  <th style={{ padding: "10px 8px" }}>Producto</th>
                  <th style={{ padding: "10px 8px" }}>Publicado</th>
                  <th style={{ padding: "10px 8px" }}>Final</th>
                  <th style={{ padding: "10px 8px" }}>Diferencia</th>
                  <th style={{ padding: "10px 8px" }}>%</th>
                  <th style={{ padding: "10px 8px" }}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {productPerformance.map((row) => (
                  <tr
                    key={row.id}
                    style={{ borderBottom: "1px solid rgba(255,255,255,.05)" }}
                  >
                    <td style={{ padding: "10px 8px", fontWeight: 700 }}>{row.title}</td>
                    <td style={{ padding: "10px 8px" }}>{money(row.publicPrice)}</td>
                    <td style={{ padding: "10px 8px" }}>{money(row.finalPrice)}</td>
                    <td
                      style={{
                        padding: "10px 8px",
                        color: row.diff >= 0 ? "#22c55e" : "#f87171",
                        fontWeight: 700,
                      }}
                    >
                      {row.diff >= 0 ? "+" : ""}{money(row.diff)}
                    </td>
                    <td
                      style={{
                        padding: "10px 8px",
                        color: row.pct >= 0 ? "#22c55e" : "#f87171",
                        fontWeight: 700,
                      }}
                    >
                      {row.pct >= 0 ? "+" : ""}
                      {row.pct.toFixed(1)}%
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      {new Date(row.createdAt).toLocaleDateString("es-CL")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
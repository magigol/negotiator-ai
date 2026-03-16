"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardCharts from "@/components/DashboardCharts";

type DealRow = {
  id: string;
  status: string;
  created_at: string;
  product_title: string | null;
  product_price_public: number | null;
  product_image_url: string | null;
  product_description: string | null;
  owner_user_id: string | null;
};

type OfferRow = {
  id: string;
  deal_id: string;
  proposed_price: number | null;
  created_at: string | null;
};

type MessageRow = {
  id: string;
  deal_id: string;
  sender_role: string | null;
  content: string | null;
  created_at: string | null;
};

function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `$${Number(n).toLocaleString("es-CL")}`;
}

function getStatusBadge(status: string) {
  if (status === "closed") {
    return {
      label: "✅ Vendida",
      bg: "rgba(34,197,94,.20)",
    };
  }

  if (status === "negotiating") {
    return {
      label: "⏳ En negociación",
      bg: "rgba(234,179,8,.20)",
    };
  }

  return {
    label: "🟢 Disponible",
    bg: "rgba(59,130,246,.20)",
  };
}

export default function DashboardPage() {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setErrMsg(null);

      const { data: auth, error: authError } = await supabase.auth.getUser();

      if (authError) {
        if (!mounted) return;
        setErrMsg(authError.message);
        setLoading(false);
        return;
      }

      if (!auth?.user) {
        router.push("/login");
        return;
      }

      const { data: dealsData, error: dealsErr } = await supabase
        .from("deals")
        .select(
          "id,status,created_at,product_title,product_price_public,product_image_url,product_description,owner_user_id"
        )
        .eq("owner_user_id", auth.user.id)
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (dealsErr) {
        setErrMsg(dealsErr.message);
        setDeals([]);
        setLoading(false);
        return;
      }

      const dealRows = (dealsData ?? []) as DealRow[];
      setDeals(dealRows);

      const dealIds = dealRows.map((d) => d.id);

      if (dealIds.length > 0) {
        const { data: offersData } = await supabase
          .from("offers")
          .select("id,deal_id,proposed_price,created_at")
          .in("deal_id", dealIds);

        const { data: messagesData } = await supabase
          .from("messages")
          .select("id,deal_id,sender_role,content,created_at")
          .in("deal_id", dealIds);

        if (!mounted) return;

        setOffers((offersData ?? []) as OfferRow[]);
        setMessages((messagesData ?? []) as MessageRow[]);
      } else {
        setOffers([]);
        setMessages([]);
      }

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const offerStatsByDeal = useMemo(() => {
    const stats = new Map<
      string,
      {
        count: number;
        bestOffer: number | null;
      }
    >();

    for (const o of offers) {
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

  const finalPriceByDeal = useMemo(() => {
    const finals = new Map<string, number>();

    for (const m of messages) {
      const content = m.content ?? "";

      if (
        content.includes("Trato cerrado en $") ||
        content.includes("aceptó la contraoferta de $")
      ) {
        const match = content.match(/\$(\d[\d.]*)/);
        if (!match) continue;

        const normalized = match[1].replace(/\./g, "");
        const parsed = Number(normalized);

        if (Number.isFinite(parsed)) {
          finals.set(m.deal_id, parsed);
        }
      }
    }

    return finals;
  }, [messages]);

  const metrics = useMemo(() => {
    const total = deals.length;
    const active = deals.filter((d) => d.status === "active").length;
    const negotiating = deals.filter((d) => d.status === "negotiating").length;
    const closed = deals.filter((d) => d.status === "closed").length;

    let revenue = 0;
    for (const d of deals) {
      if (d.status === "closed") {
        revenue += finalPriceByDeal.get(d.id) ?? 0;
      }
    }

    return {
      total,
      active,
      negotiating,
      closed,
      revenue,
    };
  }, [deals, finalPriceByDeal]);

  const salesChartData = useMemo(() => {
    const data: Record<string, number> = {};

    for (const m of messages) {
      const content = m.content ?? "";

      if (
        content.includes("Trato cerrado en $") ||
        content.includes("aceptó la contraoferta de $")
      ) {
        const date = new Date(m.created_at ?? "").toLocaleDateString("es-CL");
        const match = content.match(/\$(\d[\d.]*)/);

        if (match) {
          const value = Number(match[1].replace(/\./g, ""));
          data[date] = (data[date] ?? 0) + value;
        }
      }
    }

    return Object.entries(data).map(([date, value]) => ({
      date,
      value,
    }));
  }, [messages]);

  const statusChartData = [
    { name: "Disponibles", value: metrics.active },
    { name: "Negociando", value: metrics.negotiating },
    { name: "Vendidos", value: metrics.closed },
  ];

  const priceComparisonData = useMemo(() => {
    return deals.slice(0, 8).map((d, index) => {
      const stats = offerStatsByDeal.get(d.id) ?? {
        count: 0,
        bestOffer: null,
      };

      return {
        name: d.product_title
          ? d.product_title.length > 18
            ? d.product_title.slice(0, 18) + "..."
            : d.product_title
          : `Deal ${index + 1}`,
        published: Number(d.product_price_public ?? 0),
        bestOffer: Number(stats.bestOffer ?? 0),
      };
    });
  }, [deals, offerStatsByDeal]);

  if (loading) return <main className="container">Cargando…</main>;

  return (
    <main className="container">
      <div className="header">
        <div>
          <h1 className="h1">Dashboard</h1>
          <div className="sub">Tus publicaciones</div>
        </div>

        <div className="btnRow">
          <Link className="btnGhost" href="/create">
            Crear
          </Link>
          <Link className="btnGhost" href="/shop">
            Tienda
          </Link>
          <button className="btnGhost" onClick={logout}>
            Salir
          </button>
        </div>
      </div>

      {errMsg && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,80,80,.35)",
            background: "rgba(255,80,80,.08)",
          }}
        >
          {errMsg}
        </div>
      )}

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <div className="card">
          <div className="small" style={{ opacity: 0.75 }}>
            Total publicaciones
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>
            {metrics.total}
          </div>
        </div>

        <div className="card">
          <div className="small" style={{ opacity: 0.75 }}>
            Disponibles
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>
            {metrics.active}
          </div>
        </div>

        <div className="card">
          <div className="small" style={{ opacity: 0.75 }}>
            En negociación
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>
            {metrics.negotiating}
          </div>
        </div>

        <div className="card">
          <div className="small" style={{ opacity: 0.75 }}>
            Vendidas
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>
            {metrics.closed}
          </div>
        </div>

        <div className="card">
          <div className="small" style={{ opacity: 0.75 }}>
            Ingreso total cerrado
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>
            {money(metrics.revenue)}
          </div>
        </div>
      </div>

      <DashboardCharts
        sales={salesChartData}
        statusStats={statusChartData}
        priceComparison={priceComparisonData}
      />

      {deals.length === 0 ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="muted">Aún no tienes publicaciones.</div>
        </div>
      ) : (
        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 16,
          }}
        >
          {deals.map((d) => {
            const stats = offerStatsByDeal.get(d.id) ?? {
              count: 0,
              bestOffer: null,
            };

            const finalPrice = finalPriceByDeal.get(d.id) ?? null;
            const statusBadge = getStatusBadge(d.status);

            return (
              <Link
                key={d.id}
                href={`/deal/${d.id}`}
                className="card"
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  display: "block",
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

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "start",
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>
                      {d.product_title ?? "(sin título)"}
                    </div>

                    <div
                      style={{
                        padding: "7px 10px",
                        borderRadius: 999,
                        background: statusBadge.bg,
                        fontWeight: 700,
                        fontSize: 13,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {statusBadge.label}
                    </div>
                  </div>

                  <div style={{ fontSize: 24, fontWeight: 900 }}>
                    {money(d.product_price_public)}
                  </div>

                  {d.status === "closed" && finalPrice !== null ? (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        background: "rgba(34,197,94,.10)",
                      }}
                    >
                      <div className="small" style={{ opacity: 0.8, marginBottom: 4 }}>
                        Precio final de venta
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 20 }}>
                        {money(finalPrice)}
                      </div>
                    </div>
                  ) : stats.bestOffer !== null ? (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        background: "rgba(59,130,246,.10)",
                      }}
                    >
                      <div className="small" style={{ opacity: 0.8, marginBottom: 4 }}>
                        Mejor oferta actual
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 20 }}>
                        {money(stats.bestOffer)}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        background: "rgba(255,255,255,.05)",
                      }}
                    >
                      <div className="small" style={{ opacity: 0.8 }}>
                        Aún no hay ofertas
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 4,
                    }}
                  >
                    <div className="small" style={{ opacity: 0.75 }}>
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
                      Ver deal
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
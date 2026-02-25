"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend);

type DealRow = {
  id: string;
  status: string;
  created_at: string;
  product_title: string | null;
  product_price_public: number | null;
};

type OfferRow = {
  id: string;
  deal_id: string;
  created_at: string;
};

function dayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function minutesBetween(aIso: string, bIso: string) {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.max(0, Math.round((b - a) / 60000));
}

function isEmailAdmin(email: string | null | undefined) {
  const allow = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (!email) return false;
  return allow.includes(email.toLowerCase());
}

export default function AdminPage() {
  const router = useRouter();

  const [deals, setDeals] = useState<DealRow[]>([]);
  const [firstOffers, setFirstOffers] = useState<Map<string, OfferRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        setLoading(true);

        // ✅ Guard Auth + Admin allowlist
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) {
          router.push("/login");
          return;
        }
        if (!isEmailAdmin(auth.user.email)) {
          router.push("/dashboard");
          return;
        }

        // Deals
        const { data: dealsData, error: dealsErr } = await supabase
          .from("deals")
          .select("id,status,created_at,product_title,product_price_public")
          .order("created_at", { ascending: false })
          .limit(500);

        if (dealsErr) throw new Error(dealsErr.message);
        const d = (dealsData ?? []) as DealRow[];
        setDeals(d);

        // Offers (para tiempo a 1ª oferta)
        const { data: offersData, error: offersErr } = await supabase
          .from("offers")
          .select("id,deal_id,created_at")
          .order("created_at", { ascending: true })
          .limit(2000);

        if (offersErr) throw new Error(offersErr.message);

        const map = new Map<string, OfferRow>();
        for (const o of (offersData ?? []) as OfferRow[]) {
          if (!map.has(o.deal_id)) map.set(o.deal_id, o);
        }
        setFirstOffers(map);
      } catch (e: any) {
        setErr(e?.message ?? "Error cargando métricas");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const stats = useMemo(() => {
    const total = deals.length;
    const count = (s: string) => deals.filter((d) => d.status === s).length;

    const active = count("active");
    const pending = count("pending_seller");
    const accepted = count("accepted");
    const rejected = count("rejected");

    const acceptanceRate =
      accepted + rejected > 0 ? Math.round((accepted / (accepted + rejected)) * 100) : 0;

    const samples: number[] = [];
    for (const deal of deals) {
      const fo = firstOffers.get(deal.id);
      if (!fo) continue;
      samples.push(minutesBetween(deal.created_at, fo.created_at));
    }
    const avgFirstOfferMin =
      samples.length > 0 ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length) : null;

    return { total, active, pending, accepted, rejected, acceptanceRate, avgFirstOfferMin };
  }, [deals, firstOffers]);

  const barData = useMemo(() => {
    const labels = ["active", "pending_seller", "accepted", "rejected"];
    const values = [
      deals.filter((d) => d.status === "active").length,
      deals.filter((d) => d.status === "pending_seller").length,
      deals.filter((d) => d.status === "accepted").length,
      deals.filter((d) => d.status === "rejected").length,
    ];

    return {
      labels,
      datasets: [
        {
          label: "Deals",
          data: values,
          backgroundColor: "rgba(110,231,255,0.75)",
          borderColor: "rgba(110,231,255,1)",
          borderWidth: 1,
        },
      ],
    };
  }, [deals]);

  const lineData = useMemo(() => {
    const today = new Date();
    const days = 14;

    const keys: string[] = [];
    const counts = new Map<string, number>();

    for (let i = days - 1; i >= 0; i--) {
      const dt = new Date(today);
      dt.setDate(today.getDate() - i);
      const k = dayKey(dt);
      keys.push(k);
      counts.set(k, 0);
    }

    for (const d of deals) {
      const k = dayKey(new Date(d.created_at));
      if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
    }

    return {
      labels: keys.map((k) => k.slice(5)),
      datasets: [
        {
          label: "Deals creados (últimos 14 días)",
          data: keys.map((k) => counts.get(k) ?? 0),
          tension: 0.25,
          borderColor: "rgba(124,255,178,1)",
          backgroundColor: "rgba(124,255,178,0.18)",
          pointBackgroundColor: "rgba(124,255,178,1)",
          pointRadius: 3,
          fill: true,
        },
      ],
    };
  }, [deals]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: { display: true },
        tooltip: { enabled: true },
      },
      elements: { line: { borderWidth: 2 } },
      scales: {
        x: {
          ticks: { color: "rgba(255,255,255,0.65)" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
        y: {
          ticks: { color: "rgba(255,255,255,0.65)" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
      },
    }),
    []
  );

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) return <main className="container">Cargando métricas…</main>;
  if (err)
    return (
      <main className="container">
        <div className="alert">{err}</div>
      </main>
    );

  return (
    <main className="container">
      <div className="header">
        <div>
          <h1 className="h1">Admin · Métricas</h1>
          <div className="sub">Funnel + actividad + velocidad de IA.</div>
        </div>
        <div className="btnRow">
          <a className="btnGhost" href="/dashboard">Dashboard</a>
          <a className="btnGhost" href="/create">Crear</a>
          <button className="btnGhost" onClick={logout}>Salir</button>
        </div>
      </div>

      <div className="grid grid-2">
        <section className="card">
          <h3 className="cardTitle">KPIs</h3>
          <div style={{ display: "grid", gap: 8 }}>
            <div>Total deals: <b>{stats.total}</b></div>
            <div>Active: <b>{stats.active}</b></div>
            <div>Pending seller: <b>{stats.pending}</b></div>
            <div>Accepted: <b>{stats.accepted}</b></div>
            <div>Rejected: <b>{stats.rejected}</b></div>
            <div>Tasa de aceptación: <b>{stats.acceptanceRate}%</b></div>
            <div>
              Tiempo promedio a 1ª propuesta IA:{" "}
              <b>{stats.avgFirstOfferMin == null ? "—" : `${stats.avgFirstOfferMin} min`}</b>
            </div>
          </div>
          <div className="small" style={{ marginTop: 10 }}>
            Si crecen los datos, optimizamos con una vista/RPC.
          </div>
        </section>

        <aside className="card">
          <h3 className="cardTitle">Deals por estado</h3>
          <Bar data={barData} options={chartOptions} />
        </aside>
      </div>

      <div style={{ marginTop: 12 }} className="card">
        <h3 className="cardTitle">Actividad</h3>
        <div className="small">Deals creados por día (últimos 14 días)</div>
        <div style={{ marginTop: 10 }}>
          <Line data={lineData} options={chartOptions} />
        </div>
      </div>

      <div style={{ marginTop: 12 }} className="card">
        <h3 className="cardTitle">Últimos deals</h3>
        <div className="small">Últimos 10 (para revisar rápido)</div>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {deals.slice(0, 10).map((d) => (
            <div
              key={d.id}
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: 12,
                background: "rgba(0,0,0,0.18)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{d.product_title ?? "(sin título)"}</div>
                  <div className="small">
                    {new Date(d.created_at).toLocaleString()} · ${d.product_price_public ?? "—"}
                  </div>
                </div>
                <div className="badge">{d.status}</div>
              </div>

              <div className="small" style={{ marginTop: 8 }}>
                Deal ID: {d.id}
                {firstOffers.get(d.id)
                  ? ` · 1ª oferta IA en ${minutesBetween(d.created_at, firstOffers.get(d.id)!.created_at)} min`
                  : ""}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
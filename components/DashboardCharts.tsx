"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type MonthlyPoint = {
  name: string;
  value: number;
};

type ProductPoint = {
  name: string;
  value: number;
};

type DashboardChartsProps = {
  published: number;
  active: number;
  negotiating: number;
  sold: number;
  offersMade: number;
  wins: number;
  revenueByMonth: MonthlyPoint[];
  offersByMonth: MonthlyPoint[];
  topProductsByRevenue: ProductPoint[];
};

export default function DashboardCharts({
  published,
  active,
  negotiating,
  sold,
  offersMade,
  wins,
  revenueByMonth,
  offersByMonth,
  topProductsByRevenue,
}: DashboardChartsProps) {
  const publicationData = [
    { name: "Disponibles", value: active },
    { name: "Negociando", value: negotiating },
    { name: "Vendidos", value: sold },
  ];

  const activityData = [
    { name: "Publicados", value: published },
    { name: "Ofertas hechas", value: offersMade },
    { name: "Compras ganadas", value: wins },
  ];

  const pieData = [
    { name: "Disponibles", value: active },
    { name: "Negociando", value: negotiating },
    { name: "Vendidos", value: sold },
  ];

  const hasPublicationData = publicationData.some((d) => d.value > 0);
  const hasActivityData = activityData.some((d) => d.value > 0);
  const hasPieData = pieData.some((d) => d.value > 0);
  const hasRevenueData = revenueByMonth.some((d) => d.value > 0);
  const hasOffersByMonthData = offersByMonth.some((d) => d.value > 0);
  const hasTopProducts = topProductsByRevenue.some((d) => d.value > 0);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 16,
        marginTop: 16,
      }}
    >
      <div className="card">
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>
          Estado de tus publicaciones
        </div>

        {!hasPublicationData ? (
          <div className="muted">Aún no hay datos para este gráfico.</div>
        ) : (
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={publicationData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>
          Distribución de publicaciones
        </div>

        {!hasPieData ? (
          <div className="muted">Aún no hay datos para este gráfico.</div>
        ) : (
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  innerRadius={45}
                  paddingAngle={3}
                  label
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>
          Ingresos por mes
        </div>

        {!hasRevenueData ? (
          <div className="muted">Aún no hay ingresos cerrados para graficar.</div>
        ) : (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" strokeWidth={3} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>
          Ofertas por mes
        </div>

        {!hasOffersByMonthData ? (
          <div className="muted">Aún no hay ofertas suficientes para graficar.</div>
        ) : (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={offersByMonth}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>
          Top productos por ingresos
        </div>

        {!hasTopProducts ? (
          <div className="muted">Aún no hay productos vendidos para este gráfico.</div>
        ) : (
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={topProductsByRevenue} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>
          Actividad general
        </div>

        {!hasActivityData ? (
          <div className="muted">Aún no hay datos para este gráfico.</div>
        ) : (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
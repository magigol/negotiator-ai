"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  ComposedChart,
} from "recharts";

type SalePoint = {
  date: string;
  value: number;
};

type StatusPoint = {
  name: string;
  value: number;
};

type PriceComparisonPoint = {
  name: string;
  published: number;
  bestOffer: number;
};

type Props = {
  sales: SalePoint[];
  statusStats: StatusPoint[];
  priceComparison: PriceComparisonPoint[];
};

function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `$${Number(n).toLocaleString("es-CL")}`;
}

export default function DashboardCharts({
  sales,
  statusStats,
  priceComparison,
}: Props) {
  return (
    <div
      style={{
        marginTop: 16,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 16,
      }}
    >
      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 12 }}>
          Ventas cerradas por fecha
        </div>

        {sales.length === 0 ? (
          <div className="muted">Aún no hay ventas cerradas para graficar.</div>
        ) : (
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sales}>
                <CartesianGrid stroke="rgba(255,255,255,.08)" strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  formatter={(value: any) => money(Number(value))}
                  contentStyle={{
                    background: "#111",
                    border: "1px solid rgba(255,255,255,.12)",
                    borderRadius: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#22c55e"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 12 }}>
          Estado de publicaciones
        </div>

        {statusStats.length === 0 ? (
          <div className="muted">No hay datos de estados.</div>
        ) : (
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusStats}>
                <CartesianGrid stroke="rgba(255,255,255,.08)" strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip
                  formatter={(value: any) => Number(value)}
                  contentStyle={{
                    background: "#111",
                    border: "1px solid rgba(255,255,255,.12)",
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <div style={{ fontWeight: 800, marginBottom: 12 }}>
          Precio publicado vs mejor oferta
        </div>

        {priceComparison.length === 0 ? (
          <div className="muted">Aún no hay datos suficientes para comparar precios.</div>
        ) : (
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={priceComparison}>
                <CartesianGrid stroke="rgba(255,255,255,.08)" strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    money(Number(value)),
                    name === "published" ? "Precio publicado" : "Mejor oferta",
                  ]}
                  contentStyle={{
                    background: "#111",
                    border: "1px solid rgba(255,255,255,.12)",
                    borderRadius: 12,
                  }}
                />
                <Bar
                  dataKey="published"
                  fill="rgba(59,130,246,.65)"
                  radius={[8, 8, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="bestOffer"
                  stroke="#22c55e"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
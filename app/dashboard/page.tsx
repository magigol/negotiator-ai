"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type DealRow = {
  id: string;
  status: string;
  created_at: string;
  product_title: string | null;
  product_price_public: number | null;
  product_image_url: string | null;
};

export default function DashboardPage() {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("deals")
        .select("id,status,created_at,product_title,product_price_public,product_image_url")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!error) setDeals((data ?? []) as DealRow[]);
      setLoading(false);
    })();
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) return <main className="container">Cargando…</main>;

  return (
    <main className="container">
      <div className="header">
        <div>
          <h1 className="h1">Dashboard</h1>
          <div className="sub">Tus publicaciones</div>
        </div>
        <div className="btnRow">
          <a className="btnGhost" href="/create">Crear</a>
          <button className="btnGhost" onClick={logout}>Salir</button>
        </div>
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        {deals.map((d) => (
          <div key={d.id} className="card">
            <div className="productCard">
              {d.product_image_url ? (
                <img className="productImg" src={d.product_image_url} alt="img" />
              ) : (
                <div className="productImg" />
              )}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontWeight: 800 }}>{d.product_title ?? "(sin título)"}</div>
                  <span className="badge">{d.status}</span>
                </div>
                <div className="small" style={{ marginTop: 6 }}>
                  {new Date(d.created_at).toLocaleString()} · ${d.product_price_public ?? "—"}
                </div>
                <div className="small" style={{ marginTop: 8 }}>
                  Deal ID: {d.id}
                </div>
              </div>
            </div>
          </div>
        ))}
        {deals.length === 0 && <div className="muted">Aún no tienes publicaciones.</div>}
      </div>
    </main>
  );
}
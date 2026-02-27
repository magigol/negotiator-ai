"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Deal = {
  id: string;
  status: string;
  created_at: string;
  product_title: string | null;
  product_description: string | null;
  product_price_public: number | null;
  product_image_url: string | null;
  owner_user_id: string | null;
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export default function DealSellerPage() {
  const params = useParams();
  const router = useRouter();

  const tokenOrId = useMemo(() => String(params?.token ?? ""), [params]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deal, setDeal] = useState<Deal | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrorMsg(null);
      setDeal(null);

      // 1) Si parece UUID => lo tratamos como deal.id (vendedor logeado)
      if (isUuid(tokenOrId)) {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) {
          router.push("/login");
          return;
        }

        const { data, error } = await supabase
          .from("deals")
          .select(
            "id,status,created_at,product_title,product_description,product_price_public,product_image_url,owner_user_id"
          )
          .eq("id", tokenOrId)
          .eq("owner_user_id", auth.user.id)
          .maybeSingle();

        if (error || !data) {
          setErrorMsg("Link inválido (no encontrado o no eres el vendedor).");
          setLoading(false);
          return;
        }

        setDeal(data as Deal);
        setLoading(false);
        return;
      }

      // 2) Si NO es UUID => flujo token (deal_participants)
      const { data: participant, error: pErr } = await supabase
        .from("deal_participants")
        .select("deal_id, role")
        .eq("token", tokenOrId)
        .maybeSingle();

      if (pErr || !participant || participant.role !== "seller") {
        setErrorMsg("Link inválido (token no encontrado o no es de vendedor).");
        setLoading(false);
        return;
      }

      const { data: d, error: dErr } = await supabase
        .from("deals")
        .select(
          "id,status,created_at,product_title,product_description,product_price_public,product_image_url,owner_user_id"
        )
        .eq("id", participant.deal_id)
        .maybeSingle();

      if (dErr || !d) {
        setErrorMsg("No se pudo cargar el deal.");
        setLoading(false);
        return;
      }

      setDeal(d as Deal);
      setLoading(false);
    })();
  }, [tokenOrId, router]);

  if (loading) return <main className="container">Cargando…</main>;

  if (errorMsg) {
    return (
      <main className="container">
        <h1 className="h1">Deal (vendedor)</h1>
        <div className="muted">{errorMsg}</div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="header">
        <div>
          <h1 className="h1">Deal (vendedor)</h1>
          <div className="sub">ID: {deal?.id}</div>
        </div>
        <div className="btnRow">
          <a className="btnGhost" href="/dashboard">Volver</a>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="productCard">
          {deal?.product_image_url ? (
            <img className="productImg" src={deal.product_image_url} alt="img" />
          ) : (
            <div className="productImg" />
          )}

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontWeight: 800 }}>{deal?.product_title ?? "(sin título)"}</div>
              <span className="badge">{deal?.status}</span>
            </div>

            <div className="small" style={{ marginTop: 6 }}>
              {deal?.created_at ? new Date(deal.created_at).toLocaleString() : ""} · $
              {deal?.product_price_public ?? "—"}
            </div>

            {deal?.product_description && (
              <div className="small" style={{ marginTop: 10, opacity: 0.9 }}>
                {deal.product_description}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
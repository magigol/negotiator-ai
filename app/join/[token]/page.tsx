"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useParams } from "next/navigation";

export default function JoinPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [buyerMax, setBuyerMax] = useState("900");
  const [buyerOffer, setBuyerOffer] = useState("750");
  const [buyerUrgency, setBuyerUrgency] = useState<"low" | "medium" | "high">("medium");
  const [dealId, setDealId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    (async () => {
      setErr(null);
      setLoading(true);

      const { data, error } = await supabase
        .from("deal_participants")
        .select("deal_id, role")
        .eq("token", token)
        .single();

      if (error || !data) {
        setErr("Token inválido.");
        setLoading(false);
        return;
      }
      if (data.role !== "buyer") {
        setErr("Este link no es de comprador.");
        setLoading(false);
        return;
      }

      setDealId(data.deal_id);
      setLoading(false);
    })();
  }, [token]);

  async function onSave() {
    try {
      if (!dealId || !token) return;
      setErr(null);

      const { error: termsErr } = await supabase.from("deal_terms").upsert({
        deal_id: dealId,
        buyer_max: Number(buyerMax),
        buyer_initial_offer: Number(buyerOffer),
        buyer_urgency: buyerUrgency,
        updated_at: new Date().toISOString(),
      });
      if (termsErr) throw termsErr;

      await supabase.from("deals").update({ status: "active" }).eq("id", dealId);

      router.push(`/deal/${token}`);
    } catch (e: any) {
      setErr(e?.message ?? "Error guardando datos");
    }
  }

  if (!token) return <main style={{ padding: 24 }}>Cargando…</main>;
  if (loading) return <main style={{ padding: 24 }}>Cargando…</main>;

  if (err) {
    return (
      <main style={{ padding: 24 }}>
        <p style={{ color: "crimson" }}>{err}</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>Entrar como comprador</h1>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label style={{ display: "grid", gap: 6 }}>
          Presupuesto máximo:
          <input value={buyerMax} onChange={(e) => setBuyerMax(e.target.value)} />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          Oferta inicial:
          <input value={buyerOffer} onChange={(e) => setBuyerOffer(e.target.value)} />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          Urgencia:
          <select value={buyerUrgency} onChange={(e) => setBuyerUrgency(e.target.value as any)}>
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
          </select>
        </label>

        <button onClick={onSave}>Entrar al chat</button>
      </div>
    </main>
  );
}

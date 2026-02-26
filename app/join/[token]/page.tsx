"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Urgency = "low" | "medium" | "high";

type DealRow = {
  id: string;
  status: string | null;
  created_at: string;
  product_title: string | null;
  product_description: string | null;
  product_price_public: number | null;
  product_image_url: string | null;
};

type TermsRow = {
  deal_id: string;

  seller_initial: number | null;
  seller_min: number | null;
  seller_urgency: string | null;

  buyer_max: number | null;
  buyer_initial_offer: number | null;
  buyer_urgency: string | null;

  updated_at: string | null;
};

export default function JoinBuyerPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [dealId, setDealId] = useState<string | null>(null);
  const [deal, setDeal] = useState<DealRow | null>(null);
  const [terms, setTerms] = useState<TermsRow | null>(null);

  // form buyer
  const [buyerMax, setBuyerMax] = useState<number>(0);
  const [buyerInitialOffer, setBuyerInitialOffer] = useState<number>(0);
  const [buyerUrgency, setBuyerUrgency] = useState<Urgency>("medium");

  const origin = useMemo(
    () => (typeof window !== "undefined" ? window.location.origin : ""),
    []
  );

  useEffect(() => {
    (async () => {
      setErrMsg(null);
      setLoading(true);

      // 1) validar token en deal_participants
      const { data: part, error: partErr } = await supabase
        .from("deal_participants")
        .select("deal_id, role")
        .eq("token", token)
        .maybeSingle();

      if (partErr) {
        setErrMsg(partErr.message);
        setLoading(false);
        return;
      }

      if (!part || part.role !== "buyer") {
        setErrMsg("Link inválido (token no encontrado o no es de comprador).");
        setLoading(false);
        return;
      }

      const dId = part.deal_id as string;
      setDealId(dId);

      // 2) cargar deal
      const { data: dealRow, error: dealErr } = await supabase
        .from("deals")
        .select(
          "id,status,created_at,product_title,product_description,product_price_public,product_image_url"
        )
        .eq("id", dId)
        .single();

      if (dealErr) {
        setErrMsg(dealErr.message);
        setLoading(false);
        return;
      }

      setDeal(dealRow as DealRow);

      // 3) cargar terms
      const { data: termsRow, error: termsErr } = await supabase
        .from("deal_terms")
        .select(
          "deal_id,seller_initial,seller_min,seller_urgency,buyer_max,buyer_initial_offer,buyer_urgency,updated_at"
        )
        .eq("deal_id", dId)
        .maybeSingle();

      if (termsErr) {
        setErrMsg(termsErr.message);
        setLoading(false);
        return;
      }

      setTerms((termsRow ?? null) as TermsRow | null);

      // hidratar formulario con valores previos si existen
      setBuyerMax(Number(termsRow?.buyer_max ?? 0));
      setBuyerInitialOffer(Number(termsRow?.buyer_initial_offer ?? 0));
      setBuyerUrgency(((termsRow?.buyer_urgency as Urgency) ?? "medium") as Urgency);

      setLoading(false);
    })();
  }, [token]);

  async function saveBuyerTerms() {
    if (!dealId) return;

    setErrMsg(null);
    setSaving(true);

    // validaciones mínimas
    if (!buyerMax || buyerMax <= 0) {
      setErrMsg("Tu precio máximo debe ser > 0.");
      setSaving(false);
      return;
    }
    if (!buyerInitialOffer || buyerInitialOffer <= 0) {
      setErrMsg("Tu oferta inicial debe ser > 0.");
      setSaving(false);
      return;
    }
    if (buyerInitialOffer > buyerMax) {
      setErrMsg("La oferta inicial no puede ser mayor que tu máximo.");
      setSaving(false);
      return;
    }

    // Si por alguna razón no existe deal_terms, lo creamos.
    // (Normalmente ya existe desde /create)
    const upsertPayload: Partial<TermsRow> & { deal_id: string } = {
      deal_id: dealId,
      buyer_max: buyerMax,
      buyer_initial_offer: buyerInitialOffer,
      buyer_urgency: buyerUrgency,
      updated_at: new Date().toISOString(),
    };

    const { error: upErr } = await supabase.from("deal_terms").upsert(upsertPayload, {
      onConflict: "deal_id",
    });

    if (upErr) {
      setErrMsg(upErr.message);
      setSaving(false);
      return;
    }

    // Opcional: mover el deal a pending_seller para que el vendedor vea que hay acción.
    const { error: stErr } = await supabase
      .from("deals")
      .update({ status: "pending_seller" })
      .eq("id", dealId);

    if (stErr) {
      // no es crítico, pero lo avisamos
      setErrMsg(`Guardé tus términos, pero no pude actualizar el estado: ${stErr.message}`);
      setSaving(false);
      return;
    }

    // refrescar terms
    const { data: termsRow2 } = await supabase
      .from("deal_terms")
      .select(
        "deal_id,seller_initial,seller_min,seller_urgency,buyer_max,buyer_initial_offer,buyer_urgency,updated_at"
      )
      .eq("deal_id", dealId)
      .maybeSingle();

    setTerms((termsRow2 ?? null) as TermsRow | null);
    setSaving(false);

    // Siguiente paso: ir a pantalla de negociación buyer (si la tienes),
    // por ahora lo dejamos aquí.
  }

  if (loading) return <main className="container">Cargando…</main>;

  if (!deal) {
    return (
      <main className="container">
        <h1 className="h1">Entrar como comprador</h1>
        {errMsg ? <div className="muted">{errMsg}</div> : <div className="muted">No se encontró el deal.</div>}
      </main>
    );
  }

  return (
    <main className="container">
      <div className="header">
        <div>
          <h1 className="h1">Oferta del comprador</h1>
          <div className="sub">Completa tu máximo y tu oferta inicial para iniciar la negociación.</div>
        </div>
        <div className="btnRow">
          <button className="btnGhost" onClick={() => router.push("/")}>Inicio</button>
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

      <div className="grid2" style={{ marginTop: 12 }}>
        {/* Producto */}
        <div className="card">
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Producto</div>

          {deal.product_image_url ? (
            <img
              src={deal.product_image_url}
              alt="img"
              style={{ width: 260, height: 260, objectFit: "cover", borderRadius: 18, marginBottom: 12 }}
            />
          ) : (
            <div style={{ width: 260, height: 260, borderRadius: 18, background: "rgba(255,255,255,.06)", marginBottom: 12 }} />
          )}

          <div style={{ fontWeight: 800, fontSize: 18 }}>{deal.product_title ?? "(sin título)"}</div>
          <div className="small muted" style={{ marginTop: 6 }}>
            Publicado: {deal.created_at ? new Date(deal.created_at).toLocaleString() : "—"}
          </div>

          <div style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
            {deal.product_description ?? "(sin descripción)"}
          </div>

          <div style={{ marginTop: 12, fontWeight: 800 }}>
            Precio publicado: ${deal.product_price_public ?? "—"}
          </div>

          <div className="small muted" style={{ marginTop: 10 }}>
            Deal: {deal.id}
          </div>
        </div>

        {/* Form buyer */}
        <div className="card">
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Tus términos (comprador)</div>

          <div className="field">
            <label className="label">Tu máximo (interno)</label>
            <input
              className="input"
              type="number"
              value={buyerMax}
              onChange={(e) => setBuyerMax(Number(e.target.value))}
            />
          </div>

          <div className="field">
            <label className="label">Tu oferta inicial</label>
            <input
              className="input"
              type="number"
              value={buyerInitialOffer}
              onChange={(e) => setBuyerInitialOffer(Number(e.target.value))}
            />
          </div>

          <div className="field">
            <label className="label">Tu urgencia</label>
            <select
              className="input"
              value={buyerUrgency}
              onChange={(e) => setBuyerUrgency(e.target.value as Urgency)}
            >
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
            </select>
          </div>

          <div className="btnRow" style={{ marginTop: 12 }}>
            <button className="btnPrimary" disabled={saving} onClick={saveBuyerTerms}>
              {saving ? "Guardando…" : "Guardar y empezar"}
            </button>
          </div>

          {terms?.buyer_max != null && (
            <div style={{ marginTop: 14 }}>
              <div className="small muted" style={{ marginBottom: 8 }}>
                Guardado
              </div>
              <div className="small">Máximo: ${terms.buyer_max ?? "—"}</div>
              <div className="small">Oferta inicial: ${terms.buyer_initial_offer ?? "—"}</div>
              <div className="small">Urgencia: {terms.buyer_urgency ?? "—"}</div>
              <div className="small muted" style={{ marginTop: 8 }}>
                Última actualización: {terms.updated_at ? new Date(terms.updated_at).toLocaleString() : "—"}
              </div>
            </div>
          )}

          <div className="small muted" style={{ marginTop: 14 }}>
            Link actual: {origin}/join/{token}
          </div>
        </div>
      </div>
    </main>
  );
}
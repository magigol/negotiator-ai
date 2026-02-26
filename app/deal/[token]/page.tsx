"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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
  seller_min_current: number | null;
  seller_urgency: string | null;

  buyer_max: number | null;
  buyer_initial_offer: number | null;
  buyer_urgency: string | null;

  updated_at: string | null;
};

// ⚠️ Ajusta campos si tu tabla offers es distinta
type OfferRow = {
  id: string;
  deal_id: string;
  created_at: string;
  // típicos:
  side?: "buyer" | "seller" | "ai";
  amount?: number;
  summary?: string | null;
};

// ⚠️ Ajusta campos si tu tabla messages es distinta
type MessageRow = {
  id: string;
  deal_id: string;
  created_at: string;
  role?: "buyer" | "seller" | "ai";
  content?: string;
};

export default function SellerDealPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [dealId, setDealId] = useState<string | null>(null);
  const [deal, setDeal] = useState<DealRow | null>(null);
  const [terms, setTerms] = useState<TermsRow | null>(null);

  const [buyerToken, setBuyerToken] = useState<string | null>(null);

  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);

  const origin = useMemo(() => (typeof window !== "undefined" ? window.location.origin : ""), []);

  async function loadAll(dId: string) {
    // deal
    const { data: dealRow, error: dealErr } = await supabase
      .from("deals")
      .select("id,status,created_at,product_title,product_description,product_price_public,product_image_url")
      .eq("id", dId)
      .single();

    if (dealErr) throw dealErr;
    setDeal(dealRow as DealRow);

    // terms
    const { data: termsRow, error: termsErr } = await supabase
      .from("deal_terms")
      .select("deal_id,seller_initial,seller_min,seller_min_current,seller_urgency,buyer_max,buyer_initial_offer,buyer_urgency,updated_at")
      .eq("deal_id", dId)
      .maybeSingle();

    if (termsErr) throw termsErr;
    setTerms((termsRow ?? null) as TermsRow | null);

    // buyer token (para mostrar link al vendedor)
    const { data: buyerPart, error: buyerErr } = await supabase
      .from("deal_participants")
      .select("token")
      .eq("deal_id", dId)
      .eq("role", "buyer")
      .maybeSingle();

    if (buyerErr) throw buyerErr;
    setBuyerToken((buyerPart?.token as string) ?? null);

    // offers (opcional)
    const { data: offersRows } = await supabase
      .from("offers")
      .select("*")
      .eq("deal_id", dId)
      .order("created_at", { ascending: false })
      .limit(50);

    setOffers((offersRows ?? []) as OfferRow[]);

    // messages (opcional)
    const { data: msgRows } = await supabase
      .from("messages")
      .select("*")
      .eq("deal_id", dId)
      .order("created_at", { ascending: true })
      .limit(200);

    setMessages((msgRows ?? []) as MessageRow[]);
  }

  useEffect(() => {
    (async () => {
      setErrMsg(null);
      setLoading(true);

      // 1) Validar token seller
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

      if (!part || part.role !== "seller") {
        setErrMsg("Link inválido (token no encontrado o no es de vendedor).");
        setLoading(false);
        return;
      }

      const dId = part.deal_id as string;
      setDealId(dId);

      try {
        await loadAll(dId);
      } catch (e: any) {
        setErrMsg(e?.message ?? "Error cargando deal");
      }

      setLoading(false);
    })();
  }, [token]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  }

  async function setStatus(status: "accepted" | "rejected" | "active" | "pending_seller") {
    if (!dealId) return;
    setBusy(true);
    setErrMsg(null);

    const { error } = await supabase.from("deals").update({ status }).eq("id", dealId);
    if (error) setErrMsg(error.message);

    try {
      await loadAll(dealId);
    } catch {}
    setBusy(false);
  }

  async function requestAIProposal() {
    if (!dealId) return;
    setBusy(true);
    setErrMsg(null);

    try {
      const res = await fetch("/api/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId,
          sellerToken: token, // por si quieres validar server-side
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error ?? `Error /api/propose (${res.status})`);
      }

      // Si tu API devuelve algo tipo {offer, summary}, aquí podrías mostrarlo.
      // Para MVP, solo recargamos.
      await loadAll(dealId);
    } catch (e: any) {
      setErrMsg(e?.message ?? "No se pudo generar propuesta IA.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="container">Cargando…</main>;

  if (!deal) {
    return (
      <main className="container">
        <h1 className="h1">Deal (vendedor)</h1>
        <div className="muted">{errMsg ?? "No encontrado"}</div>
      </main>
    );
  }

  const buyerLink = buyerToken ? `${origin}/join/${buyerToken}` : null;

  return (
    <main className="container">
      <div className="header">
        <div>
          <h1 className="h1">Deal (vendedor)</h1>
          <div className="sub">Control y negociación del trato</div>
        </div>
        <div className="btnRow">
          <a className="btnGhost" href="/dashboard">Dashboard</a>
          <button className="btnGhost" onClick={() => router.push("/create")}>Crear</button>
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
            {new Date(deal.created_at).toLocaleString()} · Publicado: ${deal.product_price_public ?? "—"}
          </div>

          <div style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
            {deal.product_description ?? "(sin descripción)"}
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="badge">{deal.status ?? "—"}</span>

            <button className="btnGhost" disabled={!buyerLink} onClick={() => buyerLink && copy(buyerLink)}>
              Copiar link comprador
            </button>

            {buyerLink && (
              <a className="btnGhost" href={buyerLink} target="_blank" rel="noreferrer">
                Abrir link comprador
              </a>
            )}
          </div>

          <div className="small muted" style={{ marginTop: 12 }}>Deal ID: {deal.id}</div>
        </div>

        {/* Términos + acciones */}
        <div className="card">
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Términos y acciones</div>

          <div className="small muted" style={{ marginBottom: 8 }}>Vendedor (interno)</div>
          <div className="small">Inicial: ${terms?.seller_initial ?? "—"}</div>
          <div className="small">Mínimo: ${terms?.seller_min ?? "—"}</div>
          <div className="small">Mínimo actual: ${terms?.seller_min_current ?? "—"}</div>
          <div className="small">Urgencia: {terms?.seller_urgency ?? "—"}</div>

          <div style={{ height: 12 }} />

          <div className="small muted" style={{ marginBottom: 8 }}>Comprador</div>
          <div className="small">Máximo: ${terms?.buyer_max ?? "—"}</div>
          <div className="small">Oferta inicial: ${terms?.buyer_initial_offer ?? "—"}</div>
          <div className="small">Urgencia: {terms?.buyer_urgency ?? "—"}</div>

          <div style={{ height: 14 }} />

          <div className="btnRow">
            <button className="btnPrimary" disabled={busy} onClick={requestAIProposal}>
              {busy ? "Procesando…" : "Generar propuesta IA"}
            </button>
          </div>

          <div className="btnRow" style={{ marginTop: 10 }}>
            <button className="btnGhost" disabled={busy} onClick={() => setStatus("accepted")}>
              Aceptar
            </button>
            <button className="btnGhost" disabled={busy} onClick={() => setStatus("rejected")}>
              Rechazar
            </button>
            <button className="btnGhost" disabled={busy} onClick={() => setStatus("active")}>
              Reabrir
            </button>
          </div>

          <div className="small muted" style={{ marginTop: 12 }}>
            Última actualización: {terms?.updated_at ? new Date(terms.updated_at).toLocaleString() : "—"}
          </div>
        </div>
      </div>

      {/* Offers */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Ofertas</div>
        {offers.length === 0 ? (
          <div className="muted">Aún no hay ofertas.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {offers.map((o) => (
              <div
                key={o.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  padding: 12,
                  background: "rgba(0,0,0,0.18)",
                }}
              >
                <div className="small muted">{new Date(o.created_at).toLocaleString()}</div>
                <div style={{ marginTop: 6 }}>
                  <b>{o.side ?? "offer"}</b> · <b>${o.amount ?? "—"}</b>
                </div>
                {o.summary ? <div style={{ marginTop: 8 }}>{o.summary}</div> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Mensajes</div>
        {messages.length === 0 ? (
          <div className="muted">Aún no hay mensajes.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  padding: 12,
                  background: "rgba(0,0,0,0.18)",
                }}
              >
                <div className="small muted">
                  {new Date(m.created_at).toLocaleString()} · {m.role ?? "msg"}
                </div>
                <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{m.content ?? ""}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
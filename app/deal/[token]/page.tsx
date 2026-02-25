"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams } from "next/navigation";

type Role = "seller" | "buyer" | "mediator";

type Product = {
  title: string | null;
  description: string | null;
  price: number | null;
  imageUrl: string | null;
};

export default function DealPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [dealId, setDealId] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);

  const [dealStatus, setDealStatus] = useState<string>("active");
  const [product, setProduct] = useState<Product | null>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [latestOffer, setLatestOffer] = useState<any | null>(null);

  const [text, setText] = useState("");
  const [newMin, setNewMin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);

  const buyerMessages = useMemo(
    () => messages.filter((m) => m.sender_role === "buyer"),
    [messages]
  );

  const lastBuyerMsg = useMemo(
    () => buyerMessages[buyerMessages.length - 1]?.content ?? null,
    [buyerMessages]
  );

  const lastMediatorMsg = useMemo(
    () =>
      messages
        .filter((m) => m.sender_role === "mediator")
        .slice(-1)[0]?.content ?? null,
    [messages]
  );

  const startedAt = useMemo(() => {
    const first = messages[0]?.created_at;
    return first ? new Date(first).toLocaleString() : null;
  }, [messages]);

  const buyerInputDisabled =
    role !== "buyer" || dealStatus !== "active" || busy;

  useEffect(() => {
    if (role !== "buyer") return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, role]);

  async function loadDeal(id: string) {
    const { data } = await supabase
      .from("deals")
      .select("status, product_title, product_description, product_price_public, product_image_url")
      .eq("id", id)
      .single();

    if (data) {
      setDealStatus(data.status);
      setProduct({
        title: data.product_title ?? null,
        description: data.product_description ?? null,
        price: data.product_price_public ?? null,
        imageUrl: data.product_image_url ?? null,
      });
    }
  }

  async function loadMessages(id: string) {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("deal_id", id)
      .order("created_at", { ascending: true });

    setMessages(data ?? []);
  }

  async function loadLatestOffer(id: string) {
    const { data } = await supabase
      .from("offers")
      .select("*")
      .eq("deal_id", id)
      .order("created_at", { ascending: false })
      .limit(1);

    setLatestOffer(data?.[0] ?? null);
  }

  useEffect(() => {
    if (!token) return;

    (async () => {
      const { data, error } = await supabase
        .from("deal_participants")
        .select("deal_id, role")
        .eq("token", token)
        .single();

      if (error || !data) {
        setErr("Token inválido.");
        return;
      }

      setDealId(data.deal_id);
      setRole(data.role);

      await loadDeal(data.deal_id);
      await loadMessages(data.deal_id);
      await loadLatestOffer(data.deal_id);
    })();
  }, [token]);

  useEffect(() => {
    if (!dealId) return;

    const channel = supabase
      .channel(`deal:${dealId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `deal_id=eq.${dealId}`,
        },
        async (payload) => {
          setMessages((prev) => [...prev, payload.new]);

          if (payload.new.sender_role === "mediator") {
            await loadDeal(dealId);
            await loadLatestOffer(dealId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dealId]);

  async function buyerSend() {
    if (!dealId || role !== "buyer") return;

    const content = text.trim();
    if (!content) return;

    setText("");
    setBusy(true);
    setErr(null);

    try {
      const { error: insErr } = await supabase.from("messages").insert({
        deal_id: dealId,
        sender_role: "buyer",
        content,
      });
      if (insErr) throw new Error(insErr.message);

      const r = await fetch("/api/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error ?? "Error en /api/propose");

      await loadDeal(dealId);
      await loadLatestOffer(dealId);
    } catch (e: any) {
      setErr(e?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  async function sellerRespond(action: "accept" | "reject") {
    if (!dealId || role !== "seller" || !latestOffer) return;

    setBusy(true);
    setErr(null);

    try {
      const r = await fetch("/api/offers/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId,
          offerId: latestOffer.id,
          actorRole: "seller",
          action,
        }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error ?? "Error respondiendo oferta");

      await loadDeal(dealId);
      await loadLatestOffer(dealId);
    } catch (e: any) {
      setErr(e?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  async function updateMin() {
    if (!dealId || role !== "seller" || !newMin.trim()) return;

    setBusy(true);
    setErr(null);

    try {
      const r = await fetch("/api/seller/update-min", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId, newMin: Number(newMin) }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error ?? "Error actualizando mínimo");

      await loadDeal(dealId);
      setNewMin("");
    } catch (e: any) {
      setErr(e?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  if (!role || !dealId) return <main className="container">Cargando…</main>;
  if (err) return <main className="container"><div className="alert">{err}</div></main>;

  return (
    <main className="container">
      <div className="header">
        <div>
          <h1 className="h1">Negotiator AI</h1>
          <div className="sub">
            Rol: <b>{role}</b> · Estado: <b>{dealStatus}</b>
          </div>
        </div>
        <span className="badge">Deal</span>
      </div>

      {product && (
        <div className="card">
          <div className="productCard">
            {product.imageUrl ? (
              <img
                className="productImg"
                src={product.imageUrl}
                alt={product.title ?? "Producto"}
                onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
              />
            ) : (
              <div className="productImg" />
            )}

            <div>
              <p className="productTitle">{product.title ?? "Producto"}</p>
              {product.price != null && <div className="productPrice">${product.price}</div>}
              {product.description && <div className="muted" style={{ marginTop: 8 }}>{product.description}</div>}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-2" style={{ marginTop: 12 }}>
        {/* BUYER */}
        {role === "buyer" && (
          <>
            <section className="card">
              <h3 className="cardTitle">Chat</h3>

              <div ref={listRef} className="chatBox">
                {messages.map((m) => (
                  <div key={m.id} className="msg">
                    <b>{m.sender_role}:</b> {m.content}
                  </div>
                ))}
              </div>

              <div className="small" style={{ marginTop: 10 }}>
                {dealStatus === "pending_seller"
                  ? "⏳ Esperando aprobación del vendedor…"
                  : dealStatus === "accepted"
                  ? "🎉 Trato aprobado."
                  : dealStatus === "rejected"
                  ? "❌ Rechazado. Puedes intentar otra oferta."
                  : "Escribe para seguir negociando."}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <input
                  value={text}
                  disabled={buyerInputDisabled}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={buyerInputDisabled ? "Negociación pausada..." : "Escribe tu oferta..."}
                  onKeyDown={(e) => e.key === "Enter" && buyerSend()}
                />
                <button className="btnPrimary" disabled={buyerInputDisabled} onClick={buyerSend}>
                  {busy ? "..." : "Enviar"}
                </button>
              </div>
            </section>

            <aside className="card">
              <h3 className="cardTitle">Última propuesta IA</h3>
              {!latestOffer ? (
                <div className="muted">Aún no hay propuesta.</div>
              ) : (
                <>
                  <div className="productPrice">${latestOffer.proposed_price}</div>
                  {latestOffer.rationale && (
                    <div className="muted" style={{ marginTop: 8 }}>
                      {latestOffer.rationale}
                    </div>
                  )}
                </>
              )}
            </aside>
          </>
        )}

        {/* SELLER */}
        {role === "seller" && (
          <>
            <section className="card">
              <h3 className="cardTitle">Resumen</h3>
              <div className="small">Inicio: {startedAt ?? "—"}</div>
              <div className="small">Mensajes del comprador: {buyerMessages.length}</div>

              <div className="hr" />

              {lastBuyerMsg && (
                <>
                  <div className="small">Último mensaje del comprador</div>
                  <div style={{ marginTop: 6 }}>{lastBuyerMsg}</div>
                </>
              )}

              {lastMediatorMsg && (
                <>
                  <div className="hr" />
                  <div className="small">Última respuesta IA</div>
                  <div style={{ marginTop: 6 }}>{lastMediatorMsg}</div>
                </>
              )}
            </section>

            <aside className="card">
              <h3 className="cardTitle">Propuesta</h3>

              {!latestOffer ? (
                <div className="muted">Aún no hay propuesta.</div>
              ) : (
                <>
                  <div className="productPrice">${latestOffer.proposed_price}</div>
                  {latestOffer.rationale && (
                    <div className="muted" style={{ marginTop: 8 }}>
                      {latestOffer.rationale}
                    </div>
                  )}

                  <div className="btnRow" style={{ marginTop: 12 }}>
                    <button
                      className="btnPrimary"
                      disabled={busy || dealStatus !== "pending_seller"}
                      onClick={() => sellerRespond("accept")}
                    >
                      Aprobar
                    </button>
                    <button
                      className="btnDanger"
                      disabled={busy || dealStatus !== "pending_seller"}
                      onClick={() => sellerRespond("reject")}
                    >
                      Rechazar
                    </button>
                  </div>

                  <div className="hr" />

                  <div className="small">Ajustar mínimo</div>
                  <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <input
                      value={newMin}
                      onChange={(e) => setNewMin(e.target.value)}
                      placeholder="Nuevo mínimo (ej: 850)"
                    />
                    <button className="btnGhost" disabled={busy || !newMin.trim()} onClick={updateMin}>
                      Guardar
                    </button>
                  </div>

                  <div className="small" style={{ marginTop: 8 }}>
                    Ajustar mínimo vuelve el deal a <b>active</b>.
                  </div>
                </>
              )}
            </aside>
          </>
        )}
      </div>
    </main>
  );
}
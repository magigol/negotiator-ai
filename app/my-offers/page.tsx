"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type OfferRow = {
  id: string;
  deal_id: string;
  buyer_user_id: string | null;
  proposed_price: number | null;
  rationale: string | null;
  seller_decision?: string | null;
  buyer_decision?: string | null;
  buyer_status?: string | null;
  seller_status?: string | null;
  created_at: string | null;
};

type DealRow = {
  id: string;
  status: string;
  created_at: string;
  owner_user_id: string | null;
  buyer_user_id?: string | null;
  final_price?: number | null;
  product_title: string | null;
  product_description: string | null;
  product_price_public: number | null;
  product_image_url: string | null;
};

type MessageRow = {
  id: string;
  deal_id: string;
  sender_role: string | null;
  content: string | null;
  created_at: string | null;
};

type StatusFilter = "all" | "active" | "negotiating" | "closed";

function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `$${Number(n).toLocaleString("es-CL")}`;
}

function getStatusBadge(status: string) {
  if (status === "closed") {
    return {
      label: "✅ Vendido",
      bg: "rgba(34,197,94,.18)",
      border: "1px solid rgba(34,197,94,.28)",
    };
  }

  if (status === "negotiating") {
    return {
      label: "⏳ En negociación",
      bg: "rgba(234,179,8,.16)",
      border: "1px solid rgba(234,179,8,.34)",
    };
  }

  return {
    label: "🟢 Disponible",
    bg: "rgba(59,130,246,.16)",
    border: "1px solid rgba(59,130,246,.30)",
  };
}

function getBuyerOutcome(params: {
  deal: DealRow | null;
  offerIdsCount: number;
  bestBuyerOffer: number | null;
  maxOfferOverall: number | null;
  authUserId: string;
  anyAcceptedOfferForUser: boolean;
  anyRejectedOfferForUser: boolean;
}) {
  const {
    deal,
    bestBuyerOffer,
    maxOfferOverall,
    authUserId,
    anyAcceptedOfferForUser,
    anyRejectedOfferForUser,
  } = params;

  if (!deal) {
    return {
      label: "Sin datos",
      bg: "rgba(255,255,255,.08)",
      border: "1px solid rgba(255,255,255,.12)",
    };
  }

  if (deal.status === "closed") {
    if (deal.buyer_user_id && deal.buyer_user_id === authUserId) {
      return {
        label: "🏆 Ganaste la compra",
        bg: "rgba(34,197,94,.14)",
        border: "1px solid rgba(34,197,94,.28)",
      };
    }

    if (anyAcceptedOfferForUser) {
      return {
        label: "🏆 Tu oferta fue aceptada",
        bg: "rgba(34,197,94,.14)",
        border: "1px solid rgba(34,197,94,.28)",
      };
    }

    return {
      label: "❌ No ganaste esta negociación",
      bg: "rgba(239,68,68,.12)",
      border: "1px solid rgba(239,68,68,.24)",
    };
  }

  if (anyRejectedOfferForUser && deal.status !== "closed") {
    return {
      label: "🟠 Una oferta tuya fue rechazada",
      bg: "rgba(249,115,22,.12)",
      border: "1px solid rgba(249,115,22,.24)",
    };
  }

  if (
    bestBuyerOffer !== null &&
    maxOfferOverall !== null &&
    bestBuyerOffer >= maxOfferOverall
  ) {
    return {
      label: "🥇 Vas liderando",
      bg: "rgba(59,130,246,.12)",
      border: "1px solid rgba(59,130,246,.24)",
    };
  }

  return {
    label: "⏳ Esperando respuesta",
    bg: "rgba(234,179,8,.12)",
    border: "1px solid rgba(234,179,8,.24)",
  };
}

export default function MyOffersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [authUserId, setAuthUserId] = useState<string>("");

  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);

  async function loadData() {
    setErrorMsg(null);

    const { data: auth, error: authErr } = await supabase.auth.getUser();

    if (authErr) {
      setErrorMsg(authErr.message);
      setLoading(false);
      return;
    }

    if (!auth?.user?.id) {
      router.push(`/login?next=${encodeURIComponent("/my-offers")}`);
      return;
    }

    const userId = auth.user.id;
    setAuthUserId(userId);

    const { data: offersData, error: offersErr } = await supabase
      .from("offers")
      .select(
        "id,deal_id,buyer_user_id,proposed_price,rationale,seller_decision,buyer_decision,buyer_status,seller_status,created_at"
      )
      .eq("buyer_user_id", userId)
      .order("created_at", { ascending: false });

    if (offersErr) {
      setErrorMsg(offersErr.message);
      setLoading(false);
      return;
    }

    const offerRows = (offersData ?? []) as OfferRow[];
    setOffers(offerRows);

    const uniqueDealIds = [...new Set(offerRows.map((o) => o.deal_id).filter(Boolean))];

    if (uniqueDealIds.length === 0) {
      setDeals([]);
      setMessages([]);
      setLoading(false);
      return;
    }

    const { data: dealsData, error: dealsErr } = await supabase
      .from("deals")
      .select(
        "id,status,created_at,owner_user_id,buyer_user_id,final_price,product_title,product_description,product_price_public,product_image_url"
      )
      .in("id", uniqueDealIds);

    if (dealsErr) {
      setErrorMsg(dealsErr.message);
      setLoading(false);
      return;
    }

    const { data: messagesData, error: messagesErr } = await supabase
      .from("messages")
      .select("id,deal_id,sender_role,content,created_at")
      .in("deal_id", uniqueDealIds)
      .order("created_at", { ascending: true });

    if (messagesErr) {
      setErrorMsg(messagesErr.message);
      setLoading(false);
      return;
    }

    setDeals((dealsData ?? []) as DealRow[]);
    setMessages((messagesData ?? []) as MessageRow[]);
    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (!mounted) return;
      setLoading(true);
      await loadData();
    }

    init();

    const channel = supabase
      .channel("my-offers-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "offers" },
        () => {
          loadData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deals" },
        () => {
          loadData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const dealById = useMemo(() => {
    const map = new Map<string, DealRow>();
    for (const d of deals) map.set(d.id, d);
    return map;
  }, [deals]);

  const latestCounterByDeal = useMemo(() => {
    const map = new Map<
      string,
      {
        price: number;
        text: string;
        created_at: string | null;
      }
    >();

    const grouped = new Map<string, MessageRow[]>();

    for (const m of messages) {
      if (!grouped.has(m.deal_id)) grouped.set(m.deal_id, []);
      grouped.get(m.deal_id)!.push(m);
    }

    for (const [dealId, msgs] of grouped.entries()) {
      const aiMessages = [...msgs]
        .filter(
          (m) => m.sender_role === "ai" && m.content?.startsWith("COUNTER_OFFER:")
        )
        .sort((a, b) => {
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
          return tb - ta;
        });

      const latest = aiMessages[0];
      if (!latest?.content) continue;

      const match = latest.content.match(/^COUNTER_OFFER:(\d+)/);
      if (!match) continue;

      map.set(dealId, {
        price: Number(match[1]),
        text: latest.content.replace(/^COUNTER_OFFER:\d+\n?/, "").trim(),
        created_at: latest.created_at,
      });
    }

    return map;
  }, [messages]);

  const groupedOffers = useMemo(() => {
    const map = new Map<
      string,
      {
        deal: DealRow | null;
        offers: OfferRow[];
        bestBuyerOffer: number | null;
        maxOfferOverall: number | null;
        latestOfferDate: string | null;
        latestCounterOffer:
          | {
              price: number;
              text: string;
              created_at: string | null;
            }
          | null;
      }
    >();

    for (const offer of offers) {
      const deal = dealById.get(offer.deal_id) ?? null;
      const current = map.get(offer.deal_id) ?? {
        deal,
        offers: [],
        bestBuyerOffer: null,
        maxOfferOverall: null,
        latestOfferDate: null,
        latestCounterOffer: latestCounterByDeal.get(offer.deal_id) ?? null,
      };

      current.offers.push(offer);

      if (
        typeof offer.proposed_price === "number" &&
        (current.bestBuyerOffer === null || offer.proposed_price > current.bestBuyerOffer)
      ) {
        current.bestBuyerOffer = offer.proposed_price;
      }

      if (!current.latestOfferDate && offer.created_at) {
        current.latestOfferDate = offer.created_at;
      }

      map.set(offer.deal_id, current);
    }

    for (const entry of map.values()) {
      entry.maxOfferOverall = entry.offers.reduce<number | null>((acc, o) => {
        if (typeof o.proposed_price !== "number") return acc;
        if (acc === null || o.proposed_price > acc) return o.proposed_price;
        return acc;
      }, null);
    }

    return Array.from(map.entries()).map(([dealId, value]) => ({
      dealId,
      ...value,
    }));
  }, [offers, dealById, latestCounterByDeal]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    return groupedOffers.filter((item) => {
      const title = item.deal?.product_title?.toLowerCase() ?? "";
      const desc = item.deal?.product_description?.toLowerCase() ?? "";
      const status = item.deal?.status ?? "active";

      const matchesQuery = !q || title.includes(q) || desc.includes(q);
      const matchesStatus = statusFilter === "all" ? true : status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [groupedOffers, query, statusFilter]);

  if (loading) {
    return <main className="container">Cargando tus ofertas…</main>;
  }

  if (errorMsg) {
    return (
      <main className="container">
        <div className="header">
          <div>
            <h1 className="h1">Mis ofertas</h1>
            <div className="sub">{errorMsg}</div>
          </div>
          <div className="btnRow">
            <button className="btnGhost" onClick={() => router.push("/dashboard")}>
              Volver
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="header">
        <div>
          <h1 className="h1">Mis ofertas</h1>
          <div className="sub">
            Revisa los productos por los que has ofertado y el estado de cada negociación.
          </div>
        </div>

        <div className="btnRow">
          <Link className="btnGhost" href="/shop">
            Tienda
          </Link>
          <Link className="btnGhost" href="/my-products">
            Mis productos
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            className="input"
            type="text"
            placeholder="Buscar por nombre o descripción..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, minWidth: 240 }}
          />

          <div className="small" style={{ opacity: 0.8 }}>
            {filteredItems.length} negociación{filteredItems.length !== 1 ? "es" : ""}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 12,
          }}
        >
          <button
            className={statusFilter === "all" ? "btn" : "btnGhost"}
            onClick={() => setStatusFilter("all")}
          >
            Todas
          </button>

          <button
            className={statusFilter === "active" ? "btn" : "btnGhost"}
            onClick={() => setStatusFilter("active")}
          >
            Disponibles
          </button>

          <button
            className={statusFilter === "negotiating" ? "btn" : "btnGhost"}
            onClick={() => setStatusFilter("negotiating")}
          >
            En negociación
          </button>

          <button
            className={statusFilter === "closed" ? "btn" : "btnGhost"}
            onClick={() => setStatusFilter("closed")}
          >
            Cerradas
          </button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="muted">No tienes ofertas que coincidan con el filtro.</div>
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
          {filteredItems.map((item) => {
            const deal = item.deal;
            const status = deal?.status ?? "active";
            const statusBadge = getStatusBadge(status);

            const anyAcceptedOfferForUser = item.offers.some(
              (o) =>
                o.seller_decision === "accepted" ||
                o.seller_status === "accepted" ||
                o.buyer_status === "accepted"
            );

            const anyRejectedOfferForUser = item.offers.some(
              (o) =>
                o.seller_decision === "rejected" ||
                o.seller_status === "rejected"
            );

            const buyerOutcome = getBuyerOutcome({
              deal,
              offerIdsCount: item.offers.length,
              bestBuyerOffer: item.bestBuyerOffer,
              maxOfferOverall: item.maxOfferOverall,
              authUserId,
              anyAcceptedOfferForUser,
              anyRejectedOfferForUser,
            });

            return (
              <div
                key={item.dealId}
                className="card"
                style={{
                  border:
                    status === "negotiating"
                      ? "1px solid rgba(234,179,8,.22)"
                      : undefined,
                  boxShadow:
                    status === "negotiating"
                      ? "0 0 22px rgba(234,179,8,.06)"
                      : undefined,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {deal?.product_image_url ? (
                    <img
                      src={deal.product_image_url}
                      alt={deal.product_title ?? "producto"}
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

                  <div style={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>
                    {deal?.product_title ?? "(sin título)"}
                  </div>

                  <div style={{ fontSize: 24, fontWeight: 900 }}>
                    {money(deal?.product_price_public)}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        padding: "7px 10px",
                        borderRadius: 999,
                        background: statusBadge.bg,
                        border: statusBadge.border,
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {statusBadge.label}
                    </div>

                    <div
                      style={{
                        padding: "7px 10px",
                        borderRadius: 999,
                        background: "rgba(59,130,246,.12)",
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      Tu mejor oferta: {money(item.bestBuyerOffer)}
                    </div>

                    <div
                      style={{
                        padding: "7px 10px",
                        borderRadius: 999,
                        background: "rgba(255,255,255,.08)",
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {item.offers.length} oferta{item.offers.length !== 1 ? "s" : ""}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 14,
                      background: buyerOutcome.bg,
                      border: buyerOutcome.border,
                      fontWeight: 800,
                      fontSize: 14,
                    }}
                  >
                    {buyerOutcome.label}
                  </div>

                  {deal?.status === "closed" ? (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        background: "rgba(34,197,94,.10)",
                      }}
                    >
                      <div className="small" style={{ opacity: 0.85, marginBottom: 4 }}>
                        Precio final
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 20 }}>
                        {money(deal.final_price)}
                      </div>
                    </div>
                  ) : null}

                  {item.latestCounterOffer ? (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        background: "rgba(59,130,246,.10)",
                        border: "1px solid rgba(59,130,246,.18)",
                      }}
                    >
                      <div className="small" style={{ opacity: 0.85, marginBottom: 4 }}>
                        Contraoferta activa
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 20 }}>
                        {money(item.latestCounterOffer.price)}
                      </div>
                      {item.latestCounterOffer.text ? (
                        <div className="small" style={{ marginTop: 6, opacity: 0.85 }}>
                          {item.latestCounterOffer.text}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {deal?.product_description ? (
                    <div className="small" style={{ opacity: 0.85 }}>
                      {deal.product_description.length > 110
                        ? `${deal.product_description.slice(0, 110)}...`
                        : deal.product_description}
                    </div>
                  ) : null}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 6,
                    }}
                  >
                    <div className="small" style={{ opacity: 0.7 }}>
                      {deal?.created_at
                        ? new Date(deal.created_at).toLocaleDateString("es-CL")
                        : "—"}
                    </div>

                    <Link className="btnGhost" href={`/shop/${item.dealId}`}>
                      Ver negociación
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
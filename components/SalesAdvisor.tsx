"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ImproveDescriptionModal from "@/components/ImproveDescriptionModal";
import ImprovePriceModal from "@/components/ImprovePriceModal";

type DealRow = {
  id: string;
  status: string;
  created_at: string;
  final_price?: number | null;
  product_title: string | null;
  product_price_public: number | null;
  product_description?: string | null;
};

type AdviceItem = {
  title: string;
  message: string;
  tone: "good" | "warning" | "info";
};

type ActionItem = {
  productId: string;
  productTitle: string;
  action:
    | "subir_precio"
    | "bajar_precio"
    | "mejorar_descripcion"
    | "mejorar_foto"
    | "mantener_estrategia"
    | "revisar_negociacion";
  reason: string;
  priority: "alta" | "media" | "baja";
};

type SalesAdvisorProps = {
  deals: DealRow[];
  ticketPromedio: number;
};

export default function SalesAdvisor({
  deals,
  ticketPromedio,
}: SalesAdvisorProps) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<AdviceItem[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [selectedPriceDealId, setSelectedPriceDealId] = useState<string | null>(
    null
  );

  const selectedDeal = useMemo(() => {
    return deals.find((d) => d.id === selectedDealId) ?? null;
  }, [deals, selectedDealId]);

  const selectedPriceDeal = useMemo(() => {
    return deals.find((d) => d.id === selectedPriceDealId) ?? null;
  }, [deals, selectedPriceDealId]);

  const selectedPriceAction = useMemo(() => {
    const action = actions.find((a) => a.productId === selectedPriceDeal?.id)?.action;

    if (action === "subir_precio" || action === "bajar_precio") {
      return action;
    }

    return null;
  }, [actions, selectedPriceDeal]);

  useEffect(() => {
    let cancelled = false;

    async function loadAdvice() {
      if (!deals.length) {
        setSummary([
          {
            title: "Aún falta información",
            message:
              "Todavía no hay suficientes datos para generar recomendaciones útiles. Publica más productos o cierra algunas negociaciones para activar el asesor.",
            tone: "info",
          },
        ]);
        setActions([]);
        return;
      }

      setLoading(true);
      setErrorMsg(null);

      try {
        const res = await fetch("/api/sales-advisor", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deals,
            ticketPromedio,
          }),
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(json?.error ?? "No se pudo generar el asesoramiento.");
        }

        if (!cancelled) {
          setSummary(json.summary ?? []);
          setActions(json.actions ?? []);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErrorMsg(e?.message ?? "No se pudo generar el asesoramiento.");
          setSummary([
            {
              title: "Asesor no disponible",
              message:
                "No fue posible generar recomendaciones con IA en este momento.",
              tone: "warning",
            },
          ]);
          setActions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAdvice();

    return () => {
      cancelled = true;
    };
  }, [deals, ticketPromedio]);

  function getSummaryStyles(tone: AdviceItem["tone"]) {
    if (tone === "good") {
      return {
        bg: "rgba(34,197,94,.10)",
        border: "1px solid rgba(34,197,94,.24)",
      };
    }

    if (tone === "warning") {
      return {
        bg: "rgba(234,179,8,.10)",
        border: "1px solid rgba(234,179,8,.24)",
      };
    }

    return {
      bg: "rgba(59,130,246,.10)",
      border: "1px solid rgba(59,130,246,.24)",
    };
  }

  function getPriorityStyles(priority: ActionItem["priority"]) {
    if (priority === "alta") {
      return {
        bg: "rgba(239,68,68,.12)",
        border: "1px solid rgba(239,68,68,.24)",
      };
    }

    if (priority === "media") {
      return {
        bg: "rgba(234,179,8,.12)",
        border: "1px solid rgba(234,179,8,.24)",
      };
    }

    return {
      bg: "rgba(59,130,246,.10)",
      border: "1px solid rgba(59,130,246,.22)",
    };
  }

  function actionLabel(action: ActionItem["action"]) {
    switch (action) {
      case "subir_precio":
        return "Subir precio";
      case "bajar_precio":
        return "Bajar precio";
      case "mejorar_descripcion":
        return "Mejorar descripción";
      case "mejorar_foto":
        return "Mejorar foto";
      case "mantener_estrategia":
        return "Mantener estrategia";
      case "revisar_negociacion":
        return "Revisar negociación";
      default:
        return action;
    }
  }

  return (
    <>
      <div className="card" style={{ marginTop: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 18 }}>
            🤖 Asesor de ventas IA
          </div>
          {loading ? (
            <div className="small" style={{ opacity: 0.75 }}>
              Analizando…
            </div>
          ) : null}
        </div>

        {errorMsg ? (
          <div className="small" style={{ marginBottom: 12, opacity: 0.85 }}>
            {errorMsg}
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 12 }}>
          {summary.map((advice, index) => {
            const styles = getSummaryStyles(advice.tone);

            return (
              <div
                key={`${advice.title}-${index}`}
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: styles.bg,
                  border: styles.border,
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 6 }}>
                  {advice.title}
                </div>
                <div className="small" style={{ lineHeight: 1.7, opacity: 0.92 }}>
                  {advice.message}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            fontWeight: 900,
            fontSize: 18,
            marginTop: 18,
            marginBottom: 12,
          }}
        >
          Acciones sugeridas por producto
        </div>

        {actions.length === 0 ? (
          <div className="small" style={{ opacity: 0.8 }}>
            Aún no hay acciones sugeridas para mostrar.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {actions.map((item, index) => {
              const styles = getPriorityStyles(item.priority);

              return (
                <div
                  key={`${item.productId}-${index}`}
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    background: styles.bg,
                    border: styles.border,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>{item.productTitle}</div>
                    <div
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        background: "rgba(255,255,255,.08)",
                        fontSize: 12,
                        fontWeight: 800,
                        textTransform: "uppercase",
                      }}
                    >
                      Prioridad {item.priority}
                    </div>
                  </div>

                  <div style={{ marginTop: 8, fontWeight: 700 }}>
                    Acción: {actionLabel(item.action)}
                  </div>

                  <div
                    className="small"
                    style={{ marginTop: 6, lineHeight: 1.7, opacity: 0.92 }}
                  >
                    {item.reason}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      marginTop: 12,
                    }}
                  >
                    <Link className="btn" href={`/deal/${item.productId}`}>
                      Ver deal
                    </Link>

                    <Link className="btnGhost" href="/my-products">
                      Mis productos
                    </Link>

                    {item.action === "mejorar_descripcion" ? (
                      <button
                        className="btnGhost"
                        onClick={() => setSelectedDealId(item.productId)}
                      >
                        Mejorar descripción
                      </button>
                    ) : null}

                    {item.action === "subir_precio" ||
                    item.action === "bajar_precio" ? (
                      <button
                        className="btnGhost"
                        onClick={() => setSelectedPriceDealId(item.productId)}
                      >
                        Ajustar precio
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ImproveDescriptionModal
        open={!!selectedDeal}
        onClose={() => setSelectedDealId(null)}
        dealId={selectedDeal?.id ?? ""}
        title={selectedDeal?.product_title ?? ""}
        description={selectedDeal?.product_description ?? ""}
        publicPrice={selectedDeal?.product_price_public ?? 0}
      />

      <ImprovePriceModal
        open={!!selectedPriceDeal}
        onClose={() => setSelectedPriceDealId(null)}
        dealId={selectedPriceDeal?.id ?? ""}
        title={selectedPriceDeal?.product_title ?? ""}
        description={selectedPriceDeal?.product_description ?? ""}
        publicPrice={selectedPriceDeal?.product_price_public ?? 0}
        finalPrice={selectedPriceDeal?.final_price ?? 0}
        action={selectedPriceAction}
      />
    </>
  );
}
"use client";

import { useState } from "react";

type ImprovePriceModalProps = {
  open: boolean;
  onClose: () => void;
  dealId: string;
  title: string;
  description?: string | null;
  publicPrice?: number | null;
  finalPrice?: number | null;
  action?: "subir_precio" | "bajar_precio" | "mantener_estrategia" | null;
};

function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `$${Number(n).toLocaleString("es-CL")}`;
}

export default function ImprovePriceModal({
  open,
  onClose,
  dealId,
  title,
  description,
  publicPrice,
  finalPrice,
  action,
}: ImprovePriceModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [tips, setTips] = useState<string[]>([]);

  if (!open) return null;

  async function generateSuggestion() {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/improve-price", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          publicPrice,
          finalPrice,
          action,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error ?? "No se pudo generar sugerencia de precio.");
      }

      setSuggestedPrice(json.suggestedPrice ?? null);
      setReason(json.reason ?? "");
      setTips(json.tips ?? []);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "No se pudo generar sugerencia de precio.");
    } finally {
      setLoading(false);
    }
  }

  async function applySuggestedPrice() {
    if (!suggestedPrice || !dealId) {
      setErrorMsg("Primero genera un precio sugerido.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/update-product-price", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dealId,
          publicPrice: suggestedPrice,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error ?? "No se pudo actualizar el precio.");
      }

      setSuccessMsg("✅ Precio actualizado en el producto.");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "No se pudo actualizar el precio.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2100,
        padding: 16,
      }}
      onClick={() => {
        if (!loading && !saving) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 760,
          maxHeight: "90vh",
          overflow: "auto",
          padding: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 900, fontSize: 22 }}>
          🤖 Sugerencia de precio
        </div>

        <div className="small" style={{ marginTop: 6, opacity: 0.8 }}>
          Producto: {title}
        </div>

        <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
          <div className="small">Precio actual: <b>{money(publicPrice)}</b></div>
          {finalPrice ? (
            <div className="small">Último cierre de referencia: <b>{money(finalPrice)}</b></div>
          ) : null}
        </div>

        <div className="btnRow" style={{ marginTop: 16 }}>
          <button className="btn" disabled={loading || saving} onClick={generateSuggestion}>
            {loading ? "Generando…" : "Generar precio sugerido"}
          </button>

          <button className="btnGhost" disabled={loading || saving} onClick={onClose}>
            Cerrar
          </button>
        </div>

        {errorMsg ? (
          <div className="small" style={{ marginTop: 12 }}>{errorMsg}</div>
        ) : null}

        {successMsg ? (
          <div className="small" style={{ marginTop: 12 }}>{successMsg}</div>
        ) : null}

        {suggestedPrice ? (
          <>
            <div style={{ marginTop: 22 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Precio sugerido</div>
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: "rgba(59,130,246,.10)",
                  border: "1px solid rgba(59,130,246,.20)",
                  fontWeight: 900,
                  fontSize: 28,
                }}
              >
                {money(suggestedPrice)}
              </div>
            </div>

            {reason ? (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Motivo</div>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    background: "rgba(255,255,255,.05)",
                    lineHeight: 1.7,
                  }}
                >
                  {reason}
                </div>
              </div>
            ) : null}

            <div className="btnRow" style={{ marginTop: 12 }}>
              <button className="btn" disabled={saving} onClick={applySuggestedPrice}>
                {saving ? "Aplicando…" : "Aplicar precio sugerido"}
              </button>
            </div>

            {tips.length > 0 ? (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Tips</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {tips.map((tip, index) => (
                    <div
                      key={`${tip}-${index}`}
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        background: "rgba(255,255,255,.05)",
                      }}
                    >
                      <span className="small">{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
"use client";

import { useState } from "react";

type ImproveDescriptionModalProps = {
  open: boolean;
  onClose: () => void;
  dealId: string;
  title: string;
  description?: string | null;
  publicPrice?: number | null;
};

export default function ImproveDescriptionModal({
  open,
  onClose,
  dealId,
  title,
  description,
  publicPrice,
}: ImproveDescriptionModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [improvedDescription, setImprovedDescription] = useState<string>("");
  const [tips, setTips] = useState<string[]>([]);

  if (!open) return null;

  async function generateImprovement() {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/improve-description", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          publicPrice,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error ?? "No se pudo mejorar la descripción.");
      }

      setImprovedDescription(json.improvedDescription ?? "");
      setTips(json.tips ?? []);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "No se pudo mejorar la descripción.");
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(improvedDescription);
      setSuccessMsg("Texto copiado.");
      setErrorMsg(null);
    } catch {
      setErrorMsg("No se pudo copiar el texto.");
    }
  }

  async function saveInProduct() {
    if (!improvedDescription.trim()) {
      setErrorMsg("Primero genera una descripción mejorada.");
      return;
    }

    if (!dealId.trim()) {
      setErrorMsg("No se encontró el producto a actualizar.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/update-product-description", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dealId,
          description: improvedDescription,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error ?? "No se pudo guardar la descripción.");
      }

      setSuccessMsg("✅ Descripción guardada en el producto.");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "No se pudo guardar la descripción.");
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
        zIndex: 2000,
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
          🤖 Mejorar descripción
        </div>

        <div className="small" style={{ marginTop: 6, opacity: 0.8 }}>
          Producto: {title}
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            Descripción actual
          </div>
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: "rgba(255,255,255,.05)",
              whiteSpace: "pre-wrap",
              lineHeight: 1.6,
            }}
          >
            {description?.trim() || "Sin descripción actual."}
          </div>
        </div>

        <div className="btnRow" style={{ marginTop: 16 }}>
          <button
            className="btn"
            disabled={loading || saving}
            onClick={generateImprovement}
          >
            {loading ? "Generando…" : "Generar mejora con IA"}
          </button>

          <button
            className="btnGhost"
            disabled={loading || saving}
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>

        {errorMsg ? (
          <div className="small" style={{ marginTop: 12, opacity: 0.9 }}>
            {errorMsg}
          </div>
        ) : null}

        {successMsg ? (
          <div className="small" style={{ marginTop: 12, opacity: 0.9 }}>
            {successMsg}
          </div>
        ) : null}

        {improvedDescription ? (
          <>
            <div style={{ marginTop: 22 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                Descripción sugerida
              </div>
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: "rgba(59,130,246,.10)",
                  border: "1px solid rgba(59,130,246,.20)",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.7,
                }}
              >
                {improvedDescription}
              </div>
            </div>

            <div className="btnRow" style={{ marginTop: 12 }}>
              <button
                className="btnGhost"
                disabled={saving}
                onClick={copyToClipboard}
              >
                Copiar texto
              </button>

              <button
                className="btn"
                disabled={saving}
                onClick={saveInProduct}
              >
                {saving ? "Guardando…" : "Guardar en el producto"}
              </button>
            </div>

            {tips.length > 0 ? (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>
                  Tips de mejora
                </div>
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
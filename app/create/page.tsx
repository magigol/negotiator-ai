"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Urgency = "low" | "medium" | "high";

export default function CreateDealPage() {
  const router = useRouter();

  // 🔧 Ajusta esto si tu bucket tiene otro nombre
  // (por ejemplo: "product-images", "product_images", etc.)
  const STORAGE_BUCKET =
    process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? "product-images";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Producto
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pricePublic, setPricePublic] = useState<number>(0);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Términos vendedor
  const [sellerInitial, setSellerInitial] = useState<number>(0);
  const [sellerMin, setSellerMin] = useState<number>(0);
  const [sellerUrgency, setSellerUrgency] = useState<Urgency>("medium");

  // Crea token de vendedor (recomendado)
  const [createSellerToken, setCreateSellerToken] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        router.push("/login");
        return;
      }
      setLoading(false);
    })();
  }, [router]);

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;
    if (pricePublic <= 0) return false;
    if (sellerInitial <= 0) return false;
    if (sellerMin <= 0) return false;
    if (sellerMin > sellerInitial) return false; // regla típica
    if (!file) return false; // si quieres permitir sin imagen, cambia esto
    return true;
  }, [title, pricePublic, sellerInitial, sellerMin, file]);

  function resetForm() {
    setTitle("");
    setDescription("");
    setPricePublic(0);
    setSellerInitial(0);
    setSellerMin(0);
    setSellerUrgency("medium");
    setFile(null);
    setPreviewUrl(null);
    setErrorMsg(null);
  }

  async function uploadImageOrThrow(userId: string, dealId: string, f: File) {
    // Nombre único
    const ext = f.name.split(".").pop() || "jpg";
    const path = `${userId}/${dealId}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, f, {
        upsert: true,
        contentType: f.type || "image/jpeg",
        cacheControl: "3600",
      });

    if (upErr) throw new Error(`Error subiendo imagen: ${upErr.message}`);

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    const publicUrl = data?.publicUrl;

    if (!publicUrl) throw new Error("No se pudo obtener la URL pública de la imagen.");

    return publicUrl;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!canSubmit) {
      setErrorMsg(
        "Revisa el formulario: título, precio público, términos del vendedor (min <= inicial) e imagen."
      );
      return;
    }

    setSaving(true);

    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw new Error(authErr.message);
      if (!auth?.user) {
        router.push("/login");
        return;
      }

      const userId = auth.user.id;

      // 1) Crear deal (sin imagen todavía)
      const { data: dealInserted, error: dealErr } = await supabase
        .from("deals")
        .insert({
          status: "active",
          approval_required: false, // ajusta si lo usas
          product_title: title.trim(),
          product_description: description.trim() || null,
          product_price_public: pricePublic,
          product_image_url: null, // lo actualizamos después del upload
          owner_user_id: userId,
        })
        .select("id")
        .single();

      if (dealErr) throw new Error(dealErr.message);
      const dealId = dealInserted.id as string;

      // 2) Subir imagen y actualizar el deal con product_image_url
      const imageUrl = await uploadImageOrThrow(userId, dealId, file!);

      const { error: updErr } = await supabase
        .from("deals")
        .update({ product_image_url: imageUrl })
        .eq("id", dealId);

      if (updErr) throw new Error(`No se pudo guardar la URL de la imagen: ${updErr.message}`);

      // 3) Insertar deal_terms (1 fila por deal)
      const { error: termsErr } = await supabase.from("deal_terms").insert({
        deal_id: dealId,
        seller_initial: sellerInitial,
        seller_min: sellerMin,
        seller_min_current: sellerMin, // importante
        seller_urgency: sellerUrgency,
        // buyer_* quedan null (aún no hay comprador)
      });

      if (termsErr) {
        // intento rollback simple (puede fallar por RLS si no tienes policy de delete)
        await supabase.from("deals").delete().eq("id", dealId);
        throw new Error(
          `Se creó el deal pero falló deal_terms: ${termsErr.message}. Intenté revertir el deal.`
        );
      }

      // 4) (Opcional) Insertar participante vendedor con token
      if (createSellerToken) {
        const token =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

        const { error: partErr } = await supabase.from("deal_participants").insert({
          deal_id: dealId,
          role: "seller",
          token,
        });

        // Si esto falla, NO rompemos el flujo (el deal ya existe)
        if (partErr) {
          // solo avisamos
          console.warn("No se pudo crear deal_participants seller:", partErr.message);
        }
      }

      // ✅ Listo: navega al deal por ID
      router.push(`/deal/${dealId}`);
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Error desconocido creando la publicación.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="container">Cargando…</main>;

  return (
    <main className="container">
      <div className="header">
        <div>
          <h1 className="h1">Crear publicación</h1>
          <div className="sub">Sube tu producto y define tus términos como vendedor.</div>
        </div>
        <div className="btnRow">
          <a className="btnGhost" href="/dashboard">Dashboard</a>
        </div>
      </div>

      {errorMsg && (
        <div className="card" style={{ marginTop: 12, border: "1px solid rgba(255,0,0,.25)" }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Error</div>
          <div className="small" style={{ opacity: 0.9 }}>{errorMsg}</div>
        </div>
      )}

      <form onSubmit={onSubmit} className="grid" style={{ marginTop: 12, gap: 12 }}>
        {/* Producto */}
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Producto</div>

          <label className="small">Título</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Zapatilla Samba Adidas Original..."
          />

          <div style={{ height: 10 }} />

          <label className="small">Descripción</label>
          <textarea
            className="textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Estado, detalles, etc."
            rows={4}
          />

          <div style={{ height: 10 }} />

          <label className="small">Precio publicado</label>
          <input
            className="input"
            type="number"
            value={pricePublic}
            onChange={(e) => setPricePublic(Number(e.target.value))}
            min={0}
          />

          <div style={{ height: 10 }} />

          <label className="small">Imagen (archivo)</label>
          <input
            className="input"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (previewUrl) URL.revokeObjectURL(previewUrl);
              setPreviewUrl(f ? URL.createObjectURL(f) : null);
            }}
          />

          <div style={{ height: 10 }} />

          {previewUrl ? (
            <img
              src={previewUrl}
              alt="preview"
              className="productImg"
              style={{ width: 220, height: 220, objectFit: "cover", borderRadius: 16 }}
            />
          ) : (
            <div className="muted small">Preview local (se sube al crear)</div>
          )}
        </div>

        {/* Términos */}
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Términos del vendedor</div>

          <label className="small">Precio inicial (interno)</label>
          <input
            className="input"
            type="number"
            value={sellerInitial}
            onChange={(e) => setSellerInitial(Number(e.target.value))}
            min={0}
          />

          <div style={{ height: 10 }} />

          <label className="small">Precio mínimo (interno)</label>
          <input
            className="input"
            type="number"
            value={sellerMin}
            onChange={(e) => setSellerMin(Number(e.target.value))}
            min={0}
          />
          {sellerMin > 0 && sellerInitial > 0 && sellerMin > sellerInitial ? (
            <div className="small" style={{ color: "salmon", marginTop: 6 }}>
              El mínimo no puede ser mayor que el inicial.
            </div>
          ) : null}

          <div style={{ height: 10 }} />

          <label className="small">Urgencia</label>
          <select
            className="input"
            value={sellerUrgency}
            onChange={(e) => setSellerUrgency(e.target.value as Urgency)}
          >
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
          </select>

          <div style={{ height: 14 }} />

          <label className="small" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={createSellerToken}
              onChange={(e) => setCreateSellerToken(e.target.checked)}
            />
            Crear token de vendedor (recomendado)
          </label>

          <div style={{ height: 16 }} />

          <div className="btnRow">
            <button className="btn" type="submit" disabled={!canSubmit || saving}>
              {saving ? "Creando…" : "Crear publicación"}
            </button>
            <button
              type="button"
              className="btnGhost"
              onClick={resetForm}
              disabled={saving}
            >
              Limpiar
            </button>
          </div>

          <div className="small muted" style={{ marginTop: 10 }}>
            Bucket usado: <b>{STORAGE_BUCKET}</b> (si no coincide con el tuyo, cámbialo).
          </div>
        </div>
      </form>
    </main>
  );
}
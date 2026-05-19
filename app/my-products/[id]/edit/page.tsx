"use client";

/*
 * File: app/my-products/[id]/edit/page.tsx
 * Purpose: Archivo de código personalizado

 */


import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type DealRow = {
  id: string;
  owner_user_id: string | null;
  product_title: string | null;
  product_description: string | null;
  product_price_public: number | null;
  product_image_url: string | null;
  status: string;
};

// Función auxiliar: isUuid.
function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

// Página/Componente exportado: EditMyProductPage.
export default function EditMyProductPage() {
  const router = useRouter();
  const params = useParams<{ id: string | string[] }>();
  const dealIdRaw = params?.id;
  const dealId = Array.isArray(dealIdRaw) ? dealIdRaw[0] : dealIdRaw;

  const STORAGE_BUCKET =
    process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? "product-images";

// Estado local de React para datos de UI y formularios.
  const [loading, setLoading] = useState(true);
// Estado local de React para datos de UI y formularios.
  const [saving, setSaving] = useState(false);
// Estado local de React para datos de UI y formularios.
  const [uploadingImage, setUploadingImage] = useState(false);
// Estado local de React para datos de UI y formularios.
  const [archiving, setArchiving] = useState(false);
// Estado local de React para datos de UI y formularios.
  const [reactivating, setReactivating] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

// Estado local de React para datos de UI y formularios.
  const [title, setTitle] = useState("");
// Estado local de React para datos de UI y formularios.
  const [description, setDescription] = useState("");
  const [pricePublic, setPricePublic] = useState<number>(0);
  const [status, setStatus] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

// Efecto de React que se ejecuta cuando cambian las dependencias.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

// Efecto de React que se ejecuta cuando cambian las dependencias.
  useEffect(() => {
    (async () => {
      // Carga inicial del deal para que el usuario pueda editarlo.
      setLoading(true);
      setErrorMsg(null);

      if (!dealId || typeof dealId !== "string" || !isUuid(dealId)) {
        setErrorMsg("ID inválido.");
        setLoading(false);
        return;
      }

      const { data: auth } = await supabase.auth.getUser();

      if (!auth?.user?.id) {
        router.push(
          `/login?next=${encodeURIComponent(`/my-products/${dealId}/edit`)}`
        );
        return;
      }

      const { data, error } = await supabase
        .from("deals")
        .select(
          "id,owner_user_id,product_title,product_description,product_price_public,product_image_url,status"
        )
        .eq("id", dealId)
        .maybeSingle();

      if (error || !data) {
        setErrorMsg(error?.message ?? "Producto no encontrado.");
        setLoading(false);
        return;
      }

      if (data.owner_user_id && data.owner_user_id !== auth.user.id) {
        setErrorMsg("No tienes permiso para editar este producto.");
        setLoading(false);
        return;
      }

      setTitle(data.product_title ?? "");
      setDescription(data.product_description ?? "");
      setPricePublic(Number(data.product_price_public ?? 0));
      setStatus(data.status ?? "");
      setImageUrl(data.product_image_url ?? "");
      setLoading(false);
    })();
  }, [dealId, router]);

  async function uploadImageOrThrow(
    userId: string,
    currentDealId: string,
    file: File
  ) {
    // Sube la nueva imagen al bucket y devuelve la URL pública para asociarla al deal.
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${currentDealId}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, {
        upsert: true,
        contentType: file.type || "image/jpeg",
        cacheControl: "3600",
      });

    if (uploadErr) {
      throw new Error(`No se pudo subir la imagen: ${uploadErr.message}`);
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    const publicUrl = data?.publicUrl;

    if (!publicUrl) {
      throw new Error("No se pudo obtener la URL pública de la imagen.");
    }

    return publicUrl;
  }

  async function handleImageUpdate() {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!dealId || typeof dealId !== "string") {
      setErrorMsg("ID inválido.");
      return;
    }

    if (!newImageFile) {
      setErrorMsg("Selecciona una nueva imagen.");
      return;
    }

    setUploadingImage(true);

    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();

      if (authErr) throw authErr;
      if (!auth?.user?.id) {
        router.push(
          `/login?next=${encodeURIComponent(`/my-products/${dealId}/edit`)}`
        );
        return;
      }

      const publicUrl = await uploadImageOrThrow(
        auth.user.id,
        dealId,
        newImageFile
      );

      const res = await fetch("/api/update-product-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dealId,
          imageUrl: publicUrl,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error ?? "No se pudo actualizar la imagen.");
      }

      setImageUrl(publicUrl);
      setNewImageFile(null);

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      setPreviewUrl(null);
      setSuccessMsg("✅ Imagen actualizada.");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "No se pudo actualizar la imagen.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validación de campos antes de enviar la actualización de producto.

    if (!dealId || typeof dealId !== "string") {
      setErrorMsg("ID inválido.");
      return;
    }

    if (!title.trim()) {
      setErrorMsg("El título es obligatorio.");
      return;
    }

    if (!Number.isFinite(pricePublic) || pricePublic <= 0) {
      setErrorMsg("El precio debe ser mayor a 0.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/update-product", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dealId,
          product_title: title.trim(),
          product_description: description.trim(),
          product_price_public: pricePublic,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error ?? "No se pudo actualizar el producto.");
      }

      setSuccessMsg("✅ Producto actualizado.");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "No se pudo actualizar el producto.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReactivate() {
    if (!dealId || typeof dealId !== "string") {
      setErrorMsg("ID inválido.");
      return;
    }

    setReactivating(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/reactivate-product", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dealId,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error ?? "No se pudo reactivar el producto.");
      }

      setStatus("active");
      setSuccessMsg("✅ Producto reactivado correctamente.");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "No se pudo reactivar el producto.");
    } finally {
      setReactivating(false);
    }
  }

  async function handleArchive() {
    if (!dealId || typeof dealId !== "string") {
      setErrorMsg("ID inválido.");
      return;
    }

    const confirmed = window.confirm(
      "¿Seguro que quieres archivar este producto? Dejará de aparecer en la tienda."
    );

    if (!confirmed) return;

    setArchiving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/archive-product", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dealId,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error ?? "No se pudo archivar el producto.");
      }

      setStatus("archived");
      setSuccessMsg("🗂️ Producto archivado correctamente.");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "No se pudo archivar el producto.");
    } finally {
      setArchiving(false);
    }
  }

  if (loading) {
    return <main className="container">Cargando producto…</main>;
  }

  if (errorMsg && !title && !description && !pricePublic) {
    return (
      <main className="container">
        <div className="header">
          <div>
            <h1 className="h1">Editar producto</h1>
            <div className="sub">{errorMsg}</div>
          </div>
          <div className="btnRow">
            <button className="btnGhost" onClick={() => router.push("/my-products")}>
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
          <h1 className="h1">Editar producto</h1>
          <div className="sub">
            Estado actual:{" "}
            {status === "active"
              ? "Disponible"
              : status === "negotiating"
              ? "En negociación"
              : status === "closed"
              ? "Cerrado"
              : status === "archived"
              ? "Archivado"
              : status || "—"}
          </div>
        </div>

        <div className="btnRow">
          <button className="btnGhost" onClick={() => router.push("/my-products")}>
            Volver
          </button>
          {dealId ? (
            <button className="btnGhost" onClick={() => router.push(`/deal/${dealId}`)}>
              Ver deal
            </button>
          ) : null}
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "1.2fr .8fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        <form onSubmit={handleSave} className="card">
          <div style={{ fontWeight: 800, marginBottom: 12 }}>Datos del producto</div>

          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label className="small">Título</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título del producto"
              />
            </div>

            <div>
              <label className="small">Descripción</label>
              <textarea
                className="textarea"
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe tu producto"
              />
            </div>

            <div>
              <label className="small">Precio publicado</label>
              <input
                className="input"
                type="number"
                min={1}
                value={pricePublic}
                onChange={(e) => setPricePublic(Number(e.target.value))}
              />
            </div>
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

          <div className="btnRow" style={{ marginTop: 16 }}>
            <button
              className="btn"
              type="submit"
              disabled={saving || status === "archived"}
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>

            {status !== "archived" ? (
              <button
                type="button"
                className="btnGhost"
                disabled={archiving || status === "closed"}
                onClick={handleArchive}
              >
                {archiving ? "Archivando…" : "Archivar producto"}
              </button>
            ) : (
              <button
                type="button"
                className="btnGhost"
                disabled={reactivating}
                onClick={handleReactivate}
              >
                {reactivating ? "Reactivando…" : "Reactivar producto"}
              </button>
            )}
          </div>
        </form>

        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 12 }}>Imagen del producto</div>

          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Nueva preview"
              style={{
                width: "100%",
                height: 280,
                objectFit: "cover",
                borderRadius: 16,
              }}
            />
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt="Imagen actual"
              style={{
                width: "100%",
                height: 280,
                objectFit: "cover",
                borderRadius: 16,
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: 280,
                borderRadius: 16,
                background: "rgba(255,255,255,.06)",
              }}
            />
          )}

          <div style={{ marginTop: 12 }}>
            <label className="small">Seleccionar nueva imagen</label>
            <input
              className="input"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setNewImageFile(file);

                if (previewUrl) {
                  URL.revokeObjectURL(previewUrl);
                }

                setPreviewUrl(file ? URL.createObjectURL(file) : null);
              }}
            />
          </div>

          <div className="btnRow" style={{ marginTop: 14 }}>
            <button
              type="button"
              className="btn"
              disabled={uploadingImage}
              onClick={handleImageUpdate}
            >
              {uploadingImage ? "Subiendo…" : "Actualizar imagen"}
            </button>
          </div>

          <div className="small" style={{ marginTop: 10, opacity: 0.75 }}>
            Bucket usado: <b>{STORAGE_BUCKET}</b>
          </div>
        </div>
      </div>
    </main>
  );
}
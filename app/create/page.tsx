"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type UrgencyUI = "Baja" | "Media" | "Alta";
type UrgencyDb = "low" | "medium" | "high";

function mapUrgencyToDb(u: UrgencyUI): UrgencyDb {
  if (u === "Baja") return "low";
  if (u === "Alta") return "high";
  return "medium";
}

export default function CreatePage() {
  const router = useRouter();

  const supabase = useMemo(() => {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }, []);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [publicPrice, setPublicPrice] = useState<number>(0);

  const [sellerInitial, setSellerInitial] = useState<number>(0);
  const [sellerMin, setSellerMin] = useState<number>(0);
  const [urgencyUI, setUrgencyUI] = useState<UrgencyUI>("Media");

  const [file, setFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function ensureSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      // Si no hay sesión, manda a login (ajusta si tu login está en otra ruta)
      router.push("/login");
      return null;
    }
    return data.session;
  }

  async function uploadImageOrNull(userId: string) {
    if (!file) return { imagePath: null as string | null };

    // IMPORTANT: pon aquí el nombre real de tu bucket (el que ya te funcionó en local)
    const BUCKET = "product-images";

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const path = `${userId}/${fileName}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg",
      });

    if (upErr) throw upErr;

    return { imagePath: path };
  }

  async function onCreate() {
    setErrorMsg(null);
    setLoading(true);

    try {
      const session = await ensureSession();
      if (!session) return;

      const userId = session.user.id;

      // 1) Subir imagen (si viene)
      const { imagePath } = await uploadImageOrNull(userId);

      // 2) Crear deal
      // Ajusta nombres según tu tabla "deals"
      // Recomendación: tenga owner_user_id, title, description, public_price, image_path, status, created_at
      const { data: dealRow, error: dealErr } = await supabase
        .from("deals")
        .insert({
          owner_user_id: userId,
          title,
          description,
          public_price: publicPrice,
          image_path: imagePath,
          status: "active",
        })
        .select("id, token, public_token")
        .single();

      if (dealErr) throw dealErr;

      // 3) Crear deal_terms (con tus columnas reales)
      const { error: termsErr } = await supabase.from("deal_terms").insert({
        deal_id: dealRow.id,
        seller_initial: sellerInitial,
        seller_min: sellerMin,
        seller_urgency: mapUrgencyToDb(urgencyUI),
        // estos quedan null al crear (tu tabla los tiene)
        buyer_max: null,
        buyer_initial_offer: null,
        buyer_urgency: null,
        seller_min_current: sellerMin,
      });

      if (termsErr) throw termsErr;

      // 4) Generar links (ajusta si tus campos se llaman distinto)
      const sellerToken = dealRow.token || dealRow.id; // fallback
      const buyerToken = dealRow.public_token || dealRow.token || dealRow.id;

      // Puedes mostrar links en UI; aquí redirijo al dashboard del vendedor:
      router.push(`/deal/${sellerToken}`);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 980, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Crear publicación</h1>
      <p style={{ opacity: 0.8, marginBottom: 24 }}>
        Sube tu producto y deja que la IA negocie por ti.
      </p>

      {errorMsg && (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,0,0,0.08)",
            border: "1px solid rgba(255,0,0,0.25)",
            marginBottom: 16,
          }}
        >
          {errorMsg}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Producto */}
        <section
          style={{
            padding: 16,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Producto</h2>

          <label style={{ display: "block", marginBottom: 10 }}>
            <div style={{ marginBottom: 6 }}>Título</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="iPhone 13 128GB"
              style={{ width: "100%", padding: 10, borderRadius: 10 }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 10 }}>
            <div style={{ marginBottom: 6 }}>Descripción</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Estado, detalles, accesorios..."
              rows={5}
              style={{ width: "100%", padding: 10, borderRadius: 10 }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 10 }}>
            <div style={{ marginBottom: 6 }}>Precio publicado</div>
            <input
              type="number"
              value={publicPrice}
              onChange={(e) => setPublicPrice(Number(e.target.value))}
              style={{ width: "100%", padding: 10, borderRadius: 10 }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 10 }}>
            <div style={{ marginBottom: 6 }}>Imagen (archivo)</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f) setLocalPreviewUrl(URL.createObjectURL(f));
                else setLocalPreviewUrl(null);
              }}
            />
          </label>

          {localPreviewUrl && (
            <div style={{ marginTop: 10 }}>
              <div style={{ opacity: 0.8, marginBottom: 8 }}>
                Preview local (se sube al crear)
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={localPreviewUrl}
                alt="preview"
                style={{
                  width: 260,
                  height: 260,
                  objectFit: "cover",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              />
            </div>
          )}
        </section>

        {/* Términos vendedor */}
        <section
          style={{
            padding: 16,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>
            Términos del vendedor
          </h2>

          <label style={{ display: "block", marginBottom: 10 }}>
            <div style={{ marginBottom: 6 }}>Precio inicial (interno)</div>
            <input
              type="number"
              value={sellerInitial}
              onChange={(e) => setSellerInitial(Number(e.target.value))}
              style={{ width: "100%", padding: 10, borderRadius: 10 }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 10 }}>
            <div style={{ marginBottom: 6 }}>Precio mínimo (interno)</div>
            <input
              type="number"
              value={sellerMin}
              onChange={(e) => setSellerMin(Number(e.target.value))}
              style={{ width: "100%", padding: 10, borderRadius: 10 }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 10 }}>
            <div style={{ marginBottom: 6 }}>Urgencia</div>
            <select
              value={urgencyUI}
              onChange={(e) => setUrgencyUI(e.target.value as UrgencyUI)}
              style={{ width: "100%", padding: 10, borderRadius: 10 }}
            >
              <option>Baja</option>
              <option>Media</option>
              <option>Alta</option>
            </select>
          </label>

          <button
            onClick={onCreate}
            disabled={loading}
            style={{
              marginTop: 10,
              padding: "12px 16px",
              borderRadius: 12,
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {loading ? "Creando..." : "Crear publicación"}
          </button>
        </section>
      </div>
    </main>
  );
}
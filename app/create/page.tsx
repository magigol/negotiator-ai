"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Urgency = "low" | "medium" | "high";

export default function CreatePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [title, setTitle] = useState("iPhone 13 128GB");
  const [description, setDescription] = useState("Excelente estado, batería 88%, con caja.");
  const [pricePublic, setPricePublic] = useState<number>(1000);

  // Términos internos del vendedor (no se muestran al comprador)
  const [priceInitialInternal, setPriceInitialInternal] = useState<number>(1000);
  const [priceMinInternal, setPriceMinInternal] = useState<number>(800);
  const [urgency, setUrgency] = useState<Urgency>("low");

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [sellerLink, setSellerLink] = useState<string | null>(null);
  const [buyerLink, setBuyerLink] = useState<string | null>(null);

  // Preview local
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Guard: exige login
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.push("/login");
        return;
      }
      setUserEmail(data.user.email ?? null);
      setLoading(false);
    })();
  }, [router]);

  const canCreate = useMemo(() => {
    if (!title.trim()) return false;
    if (priceMinInternal <= 0 || priceInitialInternal <= 0 || pricePublic <= 0) return false;
    if (priceMinInternal > priceInitialInternal) return false;
    return true;
  }, [title, priceMinInternal, priceInitialInternal, pricePublic]);

  async function uploadProductImage(dealId: string) {
    if (!file) return null;

    // ✅ OJO: usa el nombre real de tu bucket (el que ya te funciona)
    const BUCKET = "product-images";

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${dealId}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (upErr) throw new Error(`Error subiendo imagen: ${upErr.message}`);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async function onCreate() {
    setErrorMsg(null);
    setSellerLink(null);
    setBuyerLink(null);

    if (!canCreate) {
      setErrorMsg("Revisa los campos: el mínimo no puede ser mayor al inicial, y precios > 0.");
      return;
    }

    setCreating(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        router.push("/login");
        return;
      }

      // 1) Crear deal base (con owner_user_id)
      const { data: dealRow, error: dealErr } = await supabase
        .from("deals")
        .insert({
          owner_user_id: auth.user.id, // ✅ clave para RLS/ownership
          status: "active",
          product_title: title.trim(),
          product_description: description.trim(),
          product_price_public: pricePublic,
          // Si en tu tabla tienes estas columnas, perfecto.
          // Si no las tienes, bórralas.
        })
        .select("id")
        .single();

      if (dealErr || !dealRow?.id) throw new Error(dealErr?.message ?? "No se pudo crear el deal.");

      const dealId = dealRow.id as string;

      // 2) Subir imagen (si hay)
      let imageUrl: string | null = null;
      if (file) {
        imageUrl = await uploadProductImage(dealId);

        // Guardar URL en deals (si tienes columna product_image_url)
        const { error: updErr } = await supabase
          .from("deals")
          .update({ product_image_url: imageUrl })
          .eq("id", dealId);

        if (updErr) throw new Error(updErr.message);
      }

      // 3) Guardar términos internos
      const { error: termsErr } = await supabase.from("deal_terms").insert({
        deal_id: dealId,
        seller_price_initial: priceInitialInternal,
        seller_price_min: priceMinInternal,
        urgency,
      });
      if (termsErr) throw new Error(termsErr.message);

      // 4) Crear tokens (seller + buyer) en deal_participants
      const sellerToken = crypto.randomUUID().replaceAll("-", "");
      const buyerToken = crypto.randomUUID().replaceAll("-", "");

      const { error: partErr } = await supabase.from("deal_participants").insert([
        { deal_id: dealId, role: "seller", token: sellerToken },
        { deal_id: dealId, role: "buyer", token: buyerToken },
      ]);
      if (partErr) throw new Error(partErr.message);

      const s = `${window.location.origin}/deal/${sellerToken}`;
      const b = `${window.location.origin}/join/${buyerToken}`;

      setSellerLink(s);
      setBuyerLink(b);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Error creando publicación.");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <main className="container">Cargando…</main>;

  return (
    <main className="container">
      <div className="header">
        <div>
          <h1 className="h1">Crear publicación</h1>
          <div className="sub">Sube tu producto y deja que la IA negocie por ti.</div>
          {userEmail && <div className="small">Sesión: {userEmail}</div>}
        </div>

        <div className="btnRow">
          <a className="btnGhost" href="/dashboard">Dashboard</a>
          <a className="btnGhost" href="/admin">Admin</a>
        </div>
      </div>

      {errorMsg && <div className="alert">{errorMsg}</div>}

      <div className="grid grid-2" style={{ marginTop: 12 }}>
        <section className="card">
          <h3 className="cardTitle">Producto</h3>

          <label>Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />

          <label style={{ marginTop: 10 }}>Descripción</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />

          <label style={{ marginTop: 10 }}>Precio publicado</label>
          <input
            type="number"
            value={pricePublic}
            onChange={(e) => setPricePublic(Number(e.target.value))}
          />

          <label style={{ marginTop: 10 }}>Imagen (archivo)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />

          {previewUrl && (
            <div style={{ marginTop: 10 }}>
              <img
                src={previewUrl}
                alt="preview"
                style={{ width: 220, height: 220, objectFit: "cover", borderRadius: 16 }}
              />
              <div className="small" style={{ marginTop: 6 }}>
                Preview local (se sube al crear)
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <h3 className="cardTitle">Términos del vendedor</h3>

          <label>Precio inicial (interno)</label>
          <input
            type="number"
            value={priceInitialInternal}
            onChange={(e) => setPriceInitialInternal(Number(e.target.value))}
          />

          <label style={{ marginTop: 10 }}>Precio mínimo (interno)</label>
          <input
            type="number"
            value={priceMinInternal}
            onChange={(e) => setPriceMinInternal(Number(e.target.value))}
          />

          <label style={{ marginTop: 10 }}>Urgencia</label>
          <select value={urgency} onChange={(e) => setUrgency(e.target.value as Urgency)}>
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
          </select>

          <div style={{ marginTop: 14 }}>
            <button className="btnPrimary" disabled={!canCreate || creating} onClick={onCreate}>
              {creating ? "Creando…" : "Crear publicación"}
            </button>
          </div>

          {sellerLink && buyerLink && (
            <div style={{ marginTop: 14 }}>
              <div className="small">Links generados</div>
              <div style={{ marginTop: 8 }}>
                <b>Vendedor:</b> <a href={sellerLink}>{sellerLink}</a>
              </div>
              <div style={{ marginTop: 6 }}>
                <b>Comprador:</b> <a href={buyerLink}>{buyerLink}</a>
              </div>
              <div className="small" style={{ marginTop: 8 }}>
                Abre comprador en incógnito para probar.
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
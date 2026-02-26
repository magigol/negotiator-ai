"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Urgency = "low" | "medium" | "high";
const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? "product-images";

function randToken(len = 32) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  crypto.getRandomValues(new Uint8Array(len)).forEach((n) => (out += chars[n % chars.length]));
  return out;
}

export default function CreatePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  // producto
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [publicPrice, setPublicPrice] = useState<number>(0);

  // términos vendedor (internos)
  const [sellerInitial, setSellerInitial] = useState<number>(0);
  const [sellerMin, setSellerMin] = useState<number>(0);
  const [sellerUrgency, setSellerUrgency] = useState<Urgency>("medium");

  // imagen
  const [file, setFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  // resultado
  const [sellerLink, setSellerLink] = useState<string | null>(null);
  const [buyerLink, setBuyerLink] = useState<string | null>(null);

  const [errMsg, setErrMsg] = useState<string | null>(null);
  const origin = useMemo(() => (typeof window !== "undefined" ? window.location.origin : ""), []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.push("/login");
        return;
      }
      setSessionEmail(data.user.email ?? null);
      setLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    if (!file) {
      setLocalPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function reset() {
    setTitle("");
    setDescription("");
    setPublicPrice(0);
    setSellerInitial(0);
    setSellerMin(0);
    setSellerUrgency("medium");
    setFile(null);
    setLocalPreview(null);
    setSellerLink(null);
    setBuyerLink(null);
    setErrMsg(null);
  }

  async function handleCreate() {
    setErrMsg(null);
    setSellerLink(null);
    setBuyerLink(null);

    // validaciones mínimas
    if (!title.trim()) return setErrMsg("Falta el título.");
    if (!publicPrice || publicPrice <= 0) return setErrMsg("El precio publicado debe ser > 0.");
    if (!sellerInitial || sellerInitial <= 0) return setErrMsg("El precio inicial interno debe ser > 0.");
    if (!sellerMin || sellerMin <= 0) return setErrMsg("El precio mínimo interno debe ser > 0.");
    if (sellerMin > sellerInitial) return setErrMsg("El precio mínimo no puede ser mayor que el inicial.");

    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr) return setErrMsg(authErr.message);
    if (!auth?.user) {
      router.push("/login");
      return;
    }

    // 1) crear deal (sin imagen aún)
    const { data: deal, error: dealErr } = await supabase
      .from("deals")
      .insert({
        status: "active",
        product_title: title.trim(),
        product_description: description.trim() || null,
        product_price_public: publicPrice,
        product_image_url: null,
        owner_user_id: auth.user.id, // ✅ clave para RLS
      })
      .select("id")
      .single();

    if (dealErr) return setErrMsg(dealErr.message);
    const dealId = deal.id as string;

    // 2) subir imagen (opcional) y guardar URL pública
    let publicImageUrl: string | null = null;

    if (file) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `deals/${dealId}/cover.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr) return setErrMsg(`Error subiendo imagen: ${upErr.message}`);

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      publicImageUrl = pub.publicUrl ?? null;

      const { error: updErr } = await supabase
        .from("deals")
        .update({ product_image_url: publicImageUrl })
        .eq("id", dealId);

      if (updErr) return setErrMsg(`Error guardando URL de imagen: ${updErr.message}`);
    }

    // 3) crear términos (deal_terms)
    const { error: termsErr } = await supabase.from("deal_terms").insert({
      deal_id: dealId,
      seller_initial: sellerInitial,
      seller_min: sellerMin,
      seller_min_current: sellerMin,
      seller_urgency: sellerUrgency,
      // buyer_* queda null hasta que entre el buyer
    });

    if (termsErr) return setErrMsg(`Error creando términos: ${termsErr.message}`);

    // 4) crear participantes + tokens (seller y buyer)
    const sellerToken = randToken(40);
    const buyerToken = randToken(40);

    const { error: partErr } = await supabase.from("deal_participants").insert([
      { deal_id: dealId, role: "seller", token: sellerToken },
      { deal_id: dealId, role: "buyer", token: buyerToken },
    ]);

    if (partErr) return setErrMsg(`Error creando links: ${partErr.message}`);

    setSellerLink(`${origin}/deal/${sellerToken}`);
    setBuyerLink(`${origin}/join/${buyerToken}`);
  }

  if (loading) return <main className="container">Cargando…</main>;

  return (
    <main className="container">
      <div className="header">
        <div>
          <h1 className="h1">Crear publicación</h1>
          <div className="sub">Sube tu producto y deja que la IA negocie por ti.</div>
          {sessionEmail && <div className="small">Sesión: {sessionEmail}</div>}
        </div>

        <div className="btnRow">
          <a className="btnGhost" href="/dashboard">Dashboard</a>
          <a className="btnGhost" href="/admin">Admin</a>
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

          <div className="field">
            <label className="label">Título</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="field">
            <label className="label">Descripción</label>
            <textarea
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
            />
          </div>

          <div className="field">
            <label className="label">Precio publicado</label>
            <input
              className="input"
              type="number"
              value={publicPrice}
              onChange={(e) => setPublicPrice(Number(e.target.value))}
            />
          </div>

          <div className="field">
            <label className="label">Imagen (archivo)</label>
            <input
              className="input"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {localPreview && (
            <div style={{ marginTop: 12 }}>
              <div className="small muted" style={{ marginBottom: 8 }}>
                Preview local (se sube al crear)
              </div>
              <img
                src={localPreview}
                alt="preview"
                style={{ width: 240, height: 240, objectFit: "cover", borderRadius: 18 }}
              />
            </div>
          )}
        </div>

        {/* Términos */}
        <div className="card">
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Términos del vendedor</div>

          <div className="field">
            <label className="label">Precio inicial (interno)</label>
            <input
              className="input"
              type="number"
              value={sellerInitial}
              onChange={(e) => setSellerInitial(Number(e.target.value))}
            />
          </div>

          <div className="field">
            <label className="label">Precio mínimo (interno)</label>
            <input
              className="input"
              type="number"
              value={sellerMin}
              onChange={(e) => setSellerMin(Number(e.target.value))}
            />
          </div>

          <div className="field">
            <label className="label">Urgencia</label>
            <select
              className="input"
              value={sellerUrgency}
              onChange={(e) => setSellerUrgency(e.target.value as Urgency)}
            >
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
            </select>
          </div>

          <div className="btnRow" style={{ marginTop: 12 }}>
            <button className="btnPrimary" onClick={handleCreate}>
              Crear publicación
            </button>
            <button className="btnGhost" onClick={reset}>
              Limpiar
            </button>
          </div>

          {(sellerLink || buyerLink) && (
            <div style={{ marginTop: 14 }}>
              <div className="small muted" style={{ marginBottom: 8 }}>
                Links generados
              </div>

              {sellerLink && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 800 }}>Vendedor:</div>
                  <a className="link" href={sellerLink} target="_blank" rel="noreferrer">
                    {sellerLink}
                  </a>
                </div>
              )}

              {buyerLink && (
                <div>
                  <div style={{ fontWeight: 800 }}>Comprador:</div>
                  <a className="link" href={buyerLink} target="_blank" rel="noreferrer">
                    {buyerLink}
                  </a>
                  <div className="small muted" style={{ marginTop: 6 }}>
                    Abre comprador en incógnito para probar.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
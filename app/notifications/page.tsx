"use client";

/*
 * File: app/notifications/page.tsx
 * Purpose: Archivo de código personalizado

 */


import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type NotificationRow = {
  id: string;
  user_id: string;
  deal_id: string | null;
  type: string;
  title: string;
  message: string | null;
  read_at: string | null;
  created_at: string | null;
};

// Página/Componente exportado: NotificationsPage.
export default function NotificationsPage() {
  const router = useRouter();

  const [items, setItems] = useState<NotificationRow[]>([]);
// Estado local de React para datos de UI y formularios.
  const [loading, setLoading] = useState(true);

  async function load() {
    // Carga las notificaciones del usuario actual.
    const { data: auth } = await supabase.auth.getUser();

    if (!auth?.user?.id) {
      router.push(`/login?next=${encodeURIComponent("/notifications")}`);
      return;
    }

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(80);

    setItems((data ?? []) as NotificationRow[]);
    setLoading(false);
  }

  async function markAsRead(id: string) {
    // Marca una notificación individual como leída y recarga la lista.
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);

    await load();
  }

  async function markAllAsRead() {
    // Marca todas las notificaciones no leídas para el usuario actual.
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user?.id) return;

    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", auth.user.id)
      .is("read_at", null);

    await load();
  }

// Efecto de React que se ejecuta cuando cambian las dependencias.
  useEffect(() => {
    // Carga inicial y suscripción a cambios para mantener la lista actualizada.
    load();

    const channel = supabase
      .channel("notifications-page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) return <main className="container">Cargando notificaciones…</main>;

  return (
    <main className="container">
      <div className="header">
        <div>
          <h1 className="h1">Notificaciones</h1>
          <div className="sub">Eventos importantes de tus compras y ventas.</div>
        </div>

        <div className="btnRow">
          <button className="btnGhost" onClick={markAllAsRead}>
            Marcar todas como leídas
          </button>

          <Link className="btnGhost" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="muted">No tienes notificaciones.</div>
        </div>
      ) : (
        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          {items.map((n) => (
            <div
              key={n.id}
              className="card"
              style={{
                border: n.read_at
                  ? "1px solid rgba(255,255,255,.08)"
                  : "1px solid rgba(239,68,68,.26)",
                background: n.read_at
                  ? "rgba(255,255,255,.04)"
                  : "rgba(239,68,68,.08)",
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
                <div>
                  <div style={{ fontWeight: 900 }}>{n.title}</div>

                  {n.message ? (
                    <div className="small" style={{ marginTop: 6, opacity: 0.85 }}>
                      {n.message}
                    </div>
                  ) : null}

                  <div className="small" style={{ marginTop: 6, opacity: 0.65 }}>
                    {n.created_at
                      ? new Date(n.created_at).toLocaleString("es-CL")
                      : "—"}
                  </div>
                </div>

                <div className="btnRow">
                  {n.deal_id ? (
                    <Link className="btnGhost" href={`/shop/${n.deal_id}`}>
                      Ver
                    </Link>
                  ) : null}

                  {!n.read_at ? (
                    <button className="btn" onClick={() => markAsRead(n.id)}>
                      Marcar leída
                    </button>
                  ) : (
                    <span className="small" style={{ opacity: 0.7 }}>
                      Leída
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
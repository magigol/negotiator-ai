"use client";

/*
 * File: components/notifications/page.tsx
 * Purpose: Archivo de código personalizado


 */


import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { parseNotification } from "@/lib/notifications";

type MessageRow = {
  id: string;
  deal_id: string;
  sender_role: string | null;
  content: string | null;
  created_at: string | null;
};

// Página/Componente exportado: NotificationsPage.
export default function NotificationsPage() {
  const [items, setItems] = useState<MessageRow[]>([]);
// Estado local de React para datos de UI y formularios.
  const [loading, setLoading] = useState(true);

  async function load() {
    // Carga las últimas notificaciones de mensajes desde Supabase.
    const { data } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    setItems((data ?? []) as MessageRow[]);
    setLoading(false);
  }

// Efecto de React que se ejecuta cuando cambian las dependencias.
  useEffect(() => {
    // Suscribe el componente para recibir actualizaciones en tiempo real.
    load();

    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) return <main className="container">Cargando…</main>;

  return (
    <main className="container">
      <h1 className="h1">Notificaciones</h1>

      {items.length === 0 ? (
        <div className="card">No tienes notificaciones.</div>
      ) : (
        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          {items.map((n) => {
            const parsed = parseNotification(n.content);

            return (
              <Link
                key={n.id}
                href={`/shop/${n.deal_id}`}
                className="card"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>
                    {parsed?.label ?? "Evento"}
                  </div>

                  <div className="small" style={{ opacity: 0.7 }}>
                    {n.created_at
                      ? new Date(n.created_at).toLocaleString("es-CL")
                      : ""}
                  </div>
                </div>

                <div className="small">Ver</div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
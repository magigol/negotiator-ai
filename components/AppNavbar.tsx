"use client";

/*
 * File: components/AppNavbar.tsx
 * Purpose: Componente de UI reutilizable

 */


import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Función auxiliar: isActive.
function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

// Función auxiliar: NotificationsButton.
function NotificationsButton() {
// Estado local de React para datos de UI y formularios.
  const [count, setCount] = useState(0);

  async function load() {
    // Carga el estado de notificaciones no leídas para el badge.
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user?.id) {
      setCount(0);
      return;
    }

    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", auth.user.id)
      .is("read_at", null);

    setCount(count ?? 0);
  }

// Efecto de React que se ejecuta cuando cambian las dependencias.
  useEffect(() => {
    // Mantiene el contador de notificaciones en tiempo real.
    load();

    const channel = supabase
      .channel("notifications-badge")
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

  return (
    <Link
      href="/notifications"
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        textDecoration: "none",
        fontWeight: 700,
        color: "inherit",
        background: count > 0 ? "rgba(239,68,68,.16)" : "rgba(255,255,255,.04)",
        border:
          count > 0
            ? "1px solid rgba(239,68,68,.28)"
            : "1px solid rgba(255,255,255,.08)",
      }}
    >
      🔔 {count > 0 ? `(${count})` : ""}
    </Link>
  );
}

// Página/Componente exportado: AppNavbar.
export default function AppNavbar() {
  const pathname = usePathname();
  const router = useRouter();

// Estado local de React para datos de UI y formularios.
  const [loadingAuth, setLoadingAuth] = useState(true);
// Estado local de React para datos de UI y formularios.
  const [isLoggedIn, setIsLoggedIn] = useState(false);

// Efecto de React que se ejecuta cuando cambian las dependencias.
  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const { data } = await supabase.auth.getUser();

      if (!mounted) return;

      setIsLoggedIn(!!data?.user);
      setLoadingAuth(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
      setLoadingAuth(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    // Cierra sesión y lleva al usuario a la página de login.
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const linkStyle = (href: string): React.CSSProperties => ({
    padding: "10px 14px",
    borderRadius: 12,
    textDecoration: "none",
    fontWeight: 700,
    color: "inherit",
    background: isActive(pathname, href)
      ? "rgba(59,130,246,.16)"
      : "rgba(255,255,255,.04)",
    border: isActive(pathname, href)
      ? "1px solid rgba(59,130,246,.28)"
      : "1px solid rgba(255,255,255,.08)",
  });

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        backdropFilter: "blur(12px)",
        background: "rgba(10,10,10,.72)",
        borderBottom: "1px solid rgba(255,255,255,.08)",
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          paddingTop: 14,
          paddingBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/"
          style={{
            textDecoration: "none",
            color: "inherit",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 22 }}>Negotiator AI</div>
          <div className="small" style={{ opacity: 0.72 }}>
            Marketplace con negociación asistida
          </div>
        </Link>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Link href="/shop" style={linkStyle("/shop")}>
            Tienda
          </Link>

          {!loadingAuth && isLoggedIn ? (
            <>
              <Link href="/my-products" style={linkStyle("/my-products")}>
                Mis productos
              </Link>

              <Link href="/my-offers" style={linkStyle("/my-offers")}>
                Mis ofertas
              </Link>

              <Link href="/dashboard" style={linkStyle("/dashboard")}>
                Dashboard
              </Link>

              <Link
                href="/create"
                style={{
                  ...linkStyle("/create"),
                  background: "rgba(34,197,94,.16)",
                  border: "1px solid rgba(34,197,94,.28)",
                }}
              >
                + Publicar
              </Link>

              <NotificationsButton />

              <button className="btnGhost" onClick={logout}>
                Salir
              </button>
            </>
          ) : !loadingAuth ? (
            <>
              <Link href="/login" style={linkStyle("/login")}>
                Iniciar sesión
              </Link>

              <Link
                href="/create"
                style={{
                  ...linkStyle("/create"),
                  background: "rgba(34,197,94,.16)",
                  border: "1px solid rgba(34,197,94,.28)",
                }}
              >
                Publicar
              </Link>
            </>
          ) : (
            <div className="small" style={{ opacity: 0.7 }}>
              Cargando…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
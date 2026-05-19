"use client";

/*
 * File: app/login/page.tsx
 * Purpose: Archivo de código personalizado

 */


import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Mode = "login" | "register";

// Función auxiliar: LoginContent.
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>("login");
// Estado local de React para datos de UI y formularios.
  const [loading, setLoading] = useState(true);
// Estado local de React para datos de UI y formularios.
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

// Estado local de React para datos de UI y formularios.
  const [email, setEmail] = useState("");
// Estado local de React para datos de UI y formularios.
  const [password, setPassword] = useState("");
// Estado local de React para datos de UI y formularios.
  const [confirmPassword, setConfirmPassword] = useState("");

  const nextPath = searchParams.get("next") || "/dashboard";

// Efecto de React que se ejecuta cuando cambian las dependencias.
  useEffect(() => {
    (async () => {
      // Si ya hay sesión activa, redirige al siguiente destino.
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        router.push(nextPath);
        return;
      }
      setLoading(false);
    })();
  }, [router, nextPath]);

  const canSubmit = useMemo(() => {
    // Controla si el formulario cumple los requisitos mínimos para enviar.
    if (!email.trim()) return false;
    if (!password.trim()) return false;

    if (mode === "register") {
      if (password.length < 6) return false;
      if (password !== confirmPassword) return false;
    }

    return true;
  }, [email, password, confirmPassword, mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Envía formulario de inicio de sesión o registro según el modo seleccionado.

    if (!canSubmit) {
      setErrorMsg(
        mode === "login"
          ? "Completa correo y contraseña."
          : "Revisa el formulario. La contraseña debe tener al menos 6 caracteres y ambas deben coincidir."
      );
      return;
    }

    setSubmitting(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        router.push(nextPath);
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      if (data.user && !data.session) {
        setSuccessMsg(
          "Cuenta creada. Revisa tu correo para confirmar tu registro antes de iniciar sesión."
        );
        setMode("login");
      } else {
        setSuccessMsg("Cuenta creada correctamente.");
        router.push(nextPath);
        router.refresh();
      }
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Ocurrió un error.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="container">Cargando…</main>;
  }

  return (
    <main className="container" style={{ paddingTop: 40, paddingBottom: 40 }}>
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
        }}
      >
        <div style={{ marginBottom: 18 }}>
          <h1 className="h1" style={{ marginBottom: 8 }}>
            {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </h1>
          <div className="sub">
            {mode === "login"
              ? "Accede para vender tus productos y comprar los de otros."
              : "Crea una cuenta para publicar, ofertar y negociar."}
          </div>
        </div>

        <div className="card">
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 18,
            }}
          >
            <button
              type="button"
              className={mode === "login" ? "btn" : "btnGhost"}
              onClick={() => {
                setMode("login");
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
            >
              Iniciar sesión
            </button>

            <button
              type="button"
              className={mode === "register" ? "btn" : "btnGhost"}
              onClick={() => {
                setMode("register");
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
            >
              Registrarse
            </button>
          </div>

          {errorMsg ? (
            <div
              style={{
                marginBottom: 14,
                padding: 12,
                borderRadius: 12,
                background: "rgba(239,68,68,.10)",
                border: "1px solid rgba(239,68,68,.24)",
              }}
            >
              <div className="small" style={{ opacity: 0.95 }}>
                {errorMsg}
              </div>
            </div>
          ) : null}

          {successMsg ? (
            <div
              style={{
                marginBottom: 14,
                padding: 12,
                borderRadius: 12,
                background: "rgba(34,197,94,.10)",
                border: "1px solid rgba(34,197,94,.24)",
              }}
            >
              <div className="small" style={{ opacity: 0.95 }}>
                {successMsg}
              </div>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="grid" style={{ gap: 12 }}>
            <div>
              <label className="small">Correo</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="small">Contraseña</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>

            {mode === "register" ? (
              <div>
                <label className="small">Confirmar contraseña</label>
                <input
                  className="input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu contraseña"
                  autoComplete="new-password"
                />
              </div>
            ) : null}

            <button className="btn" type="submit" disabled={!canSubmit || submitting}>
              {submitting
                ? mode === "login"
                  ? "Entrando…"
                  : "Creando cuenta…"
                : mode === "login"
                ? "Entrar"
                : "Crear cuenta"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

// Página/Componente exportado: LoginPage.
export default function LoginPage() {
  return (
    <Suspense fallback={<main className="container">Cargando…</main>}>
      <LoginContent />
    </Suspense>
  );
}
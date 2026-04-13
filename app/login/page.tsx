"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const nextPath = searchParams.get("next") || "/dashboard";

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        router.push(nextPath);
        return;
      }
      setLoading(false);
    })();
  }, [router, nextPath]);

  const canSubmit = useMemo(() => {
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
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    // Email+Password (simple)
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });

    if (error) setMsg(error.message);
    else router.push("/dashboard");

    setLoading(false);
  }

  async function signUp() {
    setLoading(true);
    setMsg(null);

    const { error } = await supabase.auth.signUp({ email, password: pw });
    if (error) setMsg(error.message);
    else setMsg("Cuenta creada. Ahora inicia sesión.");

    setLoading(false);
  }

  return (
    <main className="container">
      <div className="header">
        <div>
          <h1 className="h1">Login</h1>
          <div className="sub">Accede a tu dashboard.</div>
        </div>
      </div>

      {msg && <div className="alert">{msg}</div>}

      <div className="card" style={{ maxWidth: 520 }}>
        <form onSubmit={signIn} className="row">
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />

          <label>Password</label>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />

          <div className="btnRow" style={{ marginTop: 10 }}>
            <button className="btnPrimary" disabled={loading} type="submit">
              {loading ? "..." : "Iniciar sesión"}
            </button>
            <button className="btnGhost" disabled={loading} type="button" onClick={signUp}>
              Crear cuenta
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
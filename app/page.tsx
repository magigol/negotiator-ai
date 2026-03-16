import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container">
      {/* Hero principal */}
      <section
        className="card"
        style={{
          marginTop: 24,
          padding: 32,
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "8px 14px",
            borderRadius: 999,
            background: "rgba(59,130,246,.14)",
            fontWeight: 700,
            marginBottom: 18,
          }}
        >
          🤖 Marketplace con negociación asistida por IA
        </div>

        <h1
          className="h1"
          style={{
            fontSize: 46,
            lineHeight: 1.05,
            margin: 0,
          }}
        >
          Publica, negocia y vende
          <br />
          con ayuda de inteligencia artificial
        </h1>

        <p
          className="small"
          style={{
            marginTop: 16,
            fontSize: 18,
            opacity: 0.85,
            maxWidth: 780,
            marginInline: "auto",
            lineHeight: 1.65,
          }}
        >
          Negotiator AI te permite publicar productos, recibir ofertas,
          generar contraofertas automáticas y cerrar ventas de forma más
          inteligente, rápida y estratégica.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            marginTop: 24,
            flexWrap: "wrap",
          }}
        >
          <Link className="btn" href="/shop">
            Explorar tienda
          </Link>

          <Link className="btnGhost" href="/create">
            Publicar producto
          </Link>

          <Link className="btnGhost" href="/dashboard">
            Ir al dashboard
          </Link>
        </div>
      </section>

      {/* Bloques de valor */}
      <section
        style={{
          marginTop: 20,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        <div className="card">
          <div style={{ fontSize: 28, marginBottom: 10 }}>📈</div>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
            Negociación inteligente
          </div>
          <div className="small" style={{ opacity: 0.85, lineHeight: 1.6 }}>
            La IA analiza las ofertas recibidas y propone respuestas más
            estratégicas para acercarte al mejor cierre posible.
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 28, marginBottom: 10 }}>🏪</div>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
            Tienda pública
          </div>
          <div className="small" style={{ opacity: 0.85, lineHeight: 1.6 }}>
            Tus productos se muestran en una vitrina tipo marketplace, donde
            los compradores pueden explorar, ofertar y negociar.
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 28, marginBottom: 10 }}>📊</div>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
            Dashboard con métricas
          </div>
          <div className="small" style={{ opacity: 0.85, lineHeight: 1.6 }}>
            Visualiza el estado de tus publicaciones, mejores ofertas,
            ingresos cerrados y comportamiento de negociación.
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="card" style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 900, fontSize: 24, marginBottom: 16 }}>
          Cómo funciona
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>1. Publica</div>
            <div className="small" style={{ opacity: 0.85, lineHeight: 1.6 }}>
              Crea una publicación con imagen, descripción y precio.
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>2. Recibe ofertas</div>
            <div className="small" style={{ opacity: 0.85, lineHeight: 1.6 }}>
              Los compradores proponen precios directamente desde la tienda.
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>3. Negocia con IA</div>
            <div className="small" style={{ opacity: 0.85, lineHeight: 1.6 }}>
              El sistema genera contraofertas automáticas y recomendaciones.
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>4. Cierra ventas</div>
            <div className="small" style={{ opacity: 0.85, lineHeight: 1.6 }}>
              Acepta la mejor oferta y registra el cierre del trato.
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section
        className="card"
        style={{
          marginTop: 20,
          marginBottom: 28,
          textAlign: "center",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 28 }}>
          Empieza a vender de forma más inteligente
        </div>

        <div
          className="small"
          style={{
            marginTop: 10,
            opacity: 0.85,
            fontSize: 16,
          }}
        >
          Publica tu primer producto y deja que la IA te ayude a negociar.
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            marginTop: 18,
            flexWrap: "wrap",
          }}
        >
          <Link className="btn" href="/create">
            Publicar ahora
          </Link>

          <Link className="btnGhost" href="/shop">
            Ver tienda
          </Link>
        </div>
      </section>
    </main>
  );
}
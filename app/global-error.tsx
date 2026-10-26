"use client";

/** Último recurso si falla el layout raíz: no hay estilos globales aquí. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : undefined;
  return (
    <html lang="es">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
        }}
      >
        <title>Error</title>
        <main style={{ maxWidth: 420, padding: 16, textAlign: "center" }}>
          <h1 style={{ fontSize: 18 }}>Algo ha fallado</h1>
          <p style={{ color: "#666", fontSize: 14 }}>Vuelve a intentarlo en unos segundos.</p>
          {digest && (
            <p style={{ color: "#666", fontSize: 12, fontFamily: "monospace" }}>Código: {digest}</p>
          )}
          <button
            onClick={() => retry()}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #ccc",
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}

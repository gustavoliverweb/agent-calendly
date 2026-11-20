/**
 * Marca de la plataforma por defecto: la que se usa mientras no se cambie en
 * /admin → Marca (o si la base de datos no responde). "Cadencia" es un nombre
 * provisional. La marca vigente se lee con marcaPlataforma()
 * (lib/marca-plataforma.ts, solo en el servidor).
 */
export const MARCA_POR_DEFECTO = {
  nombre: "Cadencia",
  descripcion: "Agente de voz con IA que llama a tus leads, conversa con ellos y les agenda la cita en tu calendario.",
  // Contacto que aparece en la web (también en /contacto como alternativa al formulario).
  email: "hola@example.com",
} as const;

export type MarcaPlataforma = {
  nombre: string;
  descripcion: string;
  email: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  /** El email sigue siendo el de ejemplo: no se publica como dato legal. */
  emailProvisional: boolean;
};

/** Etiqueta de la caché de la marca: se invalida al guardarla en /admin. */
export const TAG_MARCA_PLATAFORMA = "marca-plataforma";

/** Destino de «Solicitar una demo»: el formulario de contacto. */
export const enlaceDemo = "/contacto";

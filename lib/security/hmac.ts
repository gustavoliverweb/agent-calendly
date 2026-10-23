import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Compara dos cadenas en tiempo constante (también si difieren en longitud). */
export function igualesSeguro(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

/**
 * Lee 't=…,v1=…' (Calendly) o 't=…,v0=…' (ElevenLabs). Una clave puede
 * repetirse (varias firmas durante una rotación de secreto).
 */
export function leerCabeceraFirma(cabecera: string | null): Record<string, string[]> {
  const campos: Record<string, string[]> = {};
  for (const parte of (cabecera ?? "").split(",")) {
    const i = parte.indexOf("=");
    if (i > 0) (campos[parte.slice(0, i).trim()] ??= []).push(parte.slice(i + 1).trim());
  }
  return campos;
}

export type ResultadoFirma = { ok: true } | { ok: false; motivo: "sin_firma" | "caducada" | "invalida" };

/**
 * Verifica una firma HMAC-SHA256 hex sobre `"<t>.<cuerpo crudo>"`, el
 * esquema de Calendly y ElevenLabs. `toleranciaSeg` limita la antigüedad del
 * timestamp (anti-replay).
 */
export function verificarFirma(opciones: {
  cabecera: string | null;
  cuerpo: string;
  secreto: string;
  version: "v0" | "v1";
  toleranciaSeg: number;
  ahora?: number;
}): ResultadoFirma {
  const campos = leerCabeceraFirma(opciones.cabecera);
  const t = campos.t?.[0];
  const firmas = campos[opciones.version] ?? [];
  if (!t || !firmas.length || !/^\d+$/.test(t)) return { ok: false, motivo: "sin_firma" };

  const ahoraSeg = Math.floor((opciones.ahora ?? Date.now()) / 1000);
  if (Math.abs(ahoraSeg - Number(t)) > opciones.toleranciaSeg) return { ok: false, motivo: "caducada" };

  const esperada = createHmac("sha256", opciones.secreto).update(`${t}.${opciones.cuerpo}`).digest("hex");
  return firmas.some((f) => igualesSeguro(esperada, f.toLowerCase())) ? { ok: true } : { ok: false, motivo: "invalida" };
}

/** Firma un cuerpo como lo haría el emisor (pruebas y scripts de reenvío). */
export function firmar(cuerpo: string, secreto: string, version: "v0" | "v1", t = Math.floor(Date.now() / 1000)) {
  const hmac = createHmac("sha256", secreto).update(`${t}.${cuerpo}`).digest("hex");
  return `t=${t},${version}=${hmac}`;
}

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado de secretos guardados en la BD (tokens de Calendly) con
 * AES-256-GCM. Formato: "v1.<iv>.<tag>.<cifrado>" en base64url. La clave
 * (ENCRYPTION_KEY) son 32 bytes en base64 y solo vive en el servidor.
 *
 * Para rotar la clave, habría que añadir "v2" y descifrar con la anterior.
 */

const VERSION = "v1";

export function claveDesdeBase64(base64: string): Buffer {
  const clave = Buffer.from(base64, "base64");
  if (clave.length !== 32) throw new Error("ENCRYPTION_KEY debe ser de 32 bytes en base64 (openssl rand -base64 32)");
  return clave;
}

export function cifrar(texto: string, clave: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", clave, iv);
  const cifrado = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), cifrado.toString("base64url")].join(".");
}

/** Lanza si el texto está manipulado o se cifró con otra clave. */
export function descifrar(valor: string, clave: Buffer): string {
  const [version, iv, tag, cifrado] = valor.split(".");
  if (version !== VERSION || !iv || !tag || cifrado === undefined) throw new Error("Formato de secreto cifrado no válido");
  const decipher = createDecipheriv("aes-256-gcm", clave, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(cifrado, "base64url")), decipher.final()]).toString("utf8");
}

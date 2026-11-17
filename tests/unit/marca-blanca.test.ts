import { describe, expect, it } from "vitest";
import {
  esApex,
  esHostPlataforma,
  hostsPlataforma,
  normalizarHost,
  slugDeSubdominio,
  validarDominioPropio,
} from "@/lib/dominio/hosts";
import { estiloMarca, textoSobre } from "@/lib/dominio/estilo";
import { firmarPuente, verificarPuente, VIGENCIA_PUENTE_MS } from "@/lib/calendly/puente";
import { formatoImagen, marcaFormSchema } from "@/lib/dominio/marca-form";

const env = { APP_URL: "https://agent-calendly.onrender.com", PLATFORM_HOSTS: "admin.cadencia.test, otro.test", BASE_DOMAIN: "cadencia.app" };

describe("hosts", () => {
  it("normaliza mayúsculas, puerto, punto final y listas de X-Forwarded-Host", () => {
    expect(normalizarHost("Llamadas.Empresa.com:443.")).toBe("llamadas.empresa.com");
    expect(normalizarHost("a.com:8080")).toBe("a.com");
    expect(normalizarHost("uno.com, proxy.interno")).toBe("uno.com");
    expect(normalizarHost(null)).toBe("");
  });

  it("reconoce los dominios de la plataforma", () => {
    expect([...hostsPlataforma(env)]).toEqual(
      expect.arrayContaining(["localhost", "agent-calendly.onrender.com", "admin.cadencia.test", "otro.test", "cadencia.app", "www.cadencia.app"]),
    );
    expect(esHostPlataforma("agent-calendly.onrender.com", env)).toBe(true);
    expect(esHostPlataforma("", env)).toBe(true);
    expect(esHostPlataforma("llamadas.empresa.com", env)).toBe(false);
    expect(esHostPlataforma("empresa-a.cadencia.app", env)).toBe(false);
  });

  it("deduce el slug del subdominio de la plataforma (un nivel, sin www)", () => {
    expect(slugDeSubdominio("empresa-a.cadencia.app", env)).toBe("empresa-a");
    expect(slugDeSubdominio("www.cadencia.app", env)).toBeNull();
    expect(slugDeSubdominio("a.b.cadencia.app", env)).toBeNull();
    expect(slugDeSubdominio("empresa-a.otra.app", env)).toBeNull();
    expect(slugDeSubdominio("empresa-a.cadencia.app", { APP_URL: env.APP_URL })).toBeNull();
  });

  it("valida los dominios propios", () => {
    expect(validarDominioPropio("https://Llamadas.Empresa.com/login", env)).toEqual({ dominio: "llamadas.empresa.com" });
    expect(validarDominioPropio("no es un dominio", env)).toHaveProperty("error");
    expect(validarDominioPropio("agent-calendly.onrender.com", env)).toHaveProperty("error");
    expect(validarDominioPropio("empresa-a.cadencia.app", env)).toHaveProperty("error");
    expect(validarDominioPropio("-mal.com", env)).toHaveProperty("error");
  });

  it("distingue un dominio raíz de un subdominio", () => {
    expect(esApex("empresa.com")).toBe(true);
    expect(esApex("llamadas.empresa.com")).toBe(false);
  });
});

describe("color de marca", () => {
  it("elige el texto con más contraste", () => {
    expect(textoSobre("#ffffff")).toBe("#0a0a0a");
    expect(textoSobre("#facc15")).toBe("#0a0a0a");
    expect(textoSobre("#1d4ed8")).toBe("#ffffff");
    expect(textoSobre("#000000")).toBe("#ffffff");
  });

  it("sin color o con uno no válido no cambia el tema", () => {
    expect(estiloMarca(null)).toBeUndefined();
    expect(estiloMarca("red; background:url(x)")).toBeUndefined();
    expect(estiloMarca("#1d4ed8")).toEqual({ "--primary": "#1d4ed8", "--primary-foreground": "#ffffff", "--ring": "#1d4ed8" });
  });
});

describe("puente de Calendly OAuth", () => {
  const clave = Buffer.alloc(32, 7).toString("base64");
  const otra = Buffer.alloc(32, 8).toString("base64");
  const datos = { e: "11111111-1111-4111-8111-111111111111", u: "22222222-2222-4222-8222-222222222222", o: "https://llamadas.empresa.com" };

  it("verifica un token recién firmado", () => {
    const t = firmarPuente(datos, clave, 1_000);
    expect(verificarPuente(t, clave, 2_000)).toMatchObject(datos);
  });

  it("rechaza tokens caducados, manipulados o firmados con otra clave", () => {
    const t = firmarPuente(datos, clave, 1_000);
    expect(verificarPuente(t, clave, 1_000 + VIGENCIA_PUENTE_MS + 1)).toBeNull();
    expect(verificarPuente(t, otra, 2_000)).toBeNull();
    const [cuerpo, sello] = t.split(".");
    const cambiado = Buffer.from(JSON.stringify({ ...datos, e: "33333333-3333-4333-8333-333333333333", x: 9e15 })).toString("base64url");
    expect(verificarPuente(`${cambiado}.${sello}`, clave, 2_000)).toBeNull();
    expect(verificarPuente(`${cuerpo}`, clave, 2_000)).toBeNull();
    expect(verificarPuente(null, clave)).toBeNull();
  });
});

describe("formulario de marca", () => {
  it("normaliza y deja en null lo vacío", () => {
    const r = marcaFormSchema.parse({ nombre: " Dental Pro ", color: "#1D4ED8", razonSocial: "", nif: "b-1234 5678", domicilio: "", registro: "", email: "" });
    expect(r).toEqual({ nombre: "Dental Pro", color: "#1d4ed8", razonSocial: null, nif: "B12345678", domicilio: null, registro: null, email: null });
  });

  it("rechaza colores y emails mal formados", () => {
    const base = { nombre: "", color: "", razonSocial: "", nif: "", domicilio: "", registro: "", email: "" };
    expect(marcaFormSchema.safeParse({ ...base, color: "rojo" }).success).toBe(false);
    expect(marcaFormSchema.safeParse({ ...base, email: "no-es-email" }).success).toBe(false);
  });

  it("reconoce el formato real de la imagen por sus bytes", () => {
    expect(formatoImagen(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))?.tipo).toBe("image/png");
    expect(formatoImagen(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.tipo).toBe("image/jpeg");
    expect(formatoImagen(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))?.tipo).toBe("image/webp");
    expect(formatoImagen(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
  });
});

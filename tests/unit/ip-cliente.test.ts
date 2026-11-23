import { describe, expect, it } from "vitest";
import { ipCliente } from "@/lib/security/rate-limit";

const peticion = (cabeceras: Record<string, string>) => new Request("https://x.test/", { headers: cabeceras });

describe("ipCliente", () => {
  it("usa la IP que pone Cloudflare, no lo que escribe el cliente en X-Forwarded-For", () => {
    const req = peticion({
      "x-forwarded-for": "203.0.113.7, 198.51.100.8,138.199.50.143, 104.23.122.39",
      "cf-connecting-ip": "138.199.50.143",
      "true-client-ip": "138.199.50.143",
    });
    expect(ipCliente(req)).toBe("138.199.50.143");
  });

  it("sin CF-Connecting-IP usa True-Client-IP", () => {
    expect(ipCliente(peticion({ "true-client-ip": "138.199.50.143" }))).toBe("138.199.50.143");
  });

  it("ignora X-Forwarded-For y X-Real-IP si no hay cabeceras de Cloudflare", () => {
    expect(ipCliente(peticion({ "x-forwarded-for": "203.0.113.7", "x-real-ip": "203.0.113.9" }))).toBe("desconocida");
  });

  it("acepta las cabeceras sueltas (headers() de Next)", () => {
    expect(ipCliente(new Headers({ "cf-connecting-ip": "138.199.50.143" }))).toBe("138.199.50.143");
  });
});

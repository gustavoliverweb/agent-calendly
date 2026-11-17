import type { CSSProperties } from "react";

const HEX = /^#[0-9a-f]{6}$/;

export function esColorValido(color: string): boolean {
  return HEX.test(color);
}

/** Luminancia relativa (WCAG 2) de un color #rrggbb. */
export function luminancia(color: string): number {
  const canal = (i: number) => {
    const c = parseInt(color.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
}

/** Texto blanco o casi negro sobre el color, el que más contraste dé. */
export function textoSobre(color: string): string {
  const l = luminancia(color);
  const contrasteBlanco = 1.05 / (l + 0.05);
  const contrasteNegro = (l + 0.05) / 0.05;
  return contrasteBlanco >= contrasteNegro ? "#ffffff" : "#0a0a0a";
}

/**
 * Variables de tema con el color de la empresa (botones, foco, barras). Se
 * aplican en el contenedor del panel o del login; sin color, el tema por defecto.
 */
export function estiloMarca(color: string | null): CSSProperties | undefined {
  if (!color || !esColorValido(color)) return undefined;
  return {
    "--primary": color,
    "--primary-foreground": textoSobre(color),
    "--ring": color,
  } as CSSProperties;
}

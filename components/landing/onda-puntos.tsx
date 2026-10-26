"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Generador pseudoaleatorio con semilla: el dibujo es igual en cada visita. */
function aleatorio(semilla: number) {
  let s = semilla;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

type Punto = { y: number; r: number; a: number };

/**
 * Onda de voz de puntos: columnas cuya altura sigue una envolvente que
 * "habla". Se pausa fuera de pantalla y queda quieta con reduced-motion.
 */
export function OndaPuntos({
  columnas = 46,
  puntosPorColumna = 34,
  color = "17, 17, 17",
  className,
}: {
  columnas?: number;
  puntosPorColumna?: number;
  /** RGB sin alfa, p. ej. "255, 255, 255" sobre fondo oscuro. */
  color?: string;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const rnd = aleatorio(7);
    const cols: Punto[][] = Array.from({ length: columnas }, () =>
      Array.from({ length: puntosPorColumna }, () => ({
        // Más densidad en el centro de cada columna.
        y: rnd() + rnd() - 1,
        r: 0.5 + rnd() * 1.1,
        a: 0.25 + rnd() * 0.7,
      })),
    );
    const fases = cols.map(() => rnd() * Math.PI * 2);

    let ancho = 0;
    let alto = 0;
    const ajustar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ancho = canvas.clientWidth;
      alto = canvas.clientHeight;
      canvas.width = Math.round(ancho * dpr);
      canvas.height = Math.round(alto * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const dibujar = (t: number) => {
      ctx.clearRect(0, 0, ancho, alto);
      const paso = ancho / columnas;
      for (let i = 0; i < columnas; i++) {
        const x = paso * (i + 0.5);
        const u = i / (columnas - 1);
        // Envolvente: más alta en el centro, con un pico secundario.
        const env = Math.pow(Math.sin(Math.PI * u), 1.1) * (0.8 + 0.2 * Math.sin(u * 9));
        const voz = 0.55 + 0.45 * Math.abs(Math.sin(t * 0.0011 + fases[i]) * Math.cos(t * 0.0007 + u * 5));
        const h = (alto / 2) * 0.95 * Math.max(0.05, env * voz);
        for (const p of cols[i]) {
          ctx.fillStyle = `rgba(${color}, ${p.a})`;
          ctx.beginPath();
          ctx.arc(x + (p.r - 1) * 1.6, alto / 2 + p.y * h, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    ajustar();
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let visible = true;
    const bucle = (t: number) => {
      dibujar(t);
      if (visible && !reducido) frame = requestAnimationFrame(bucle);
    };
    frame = requestAnimationFrame(bucle);

    const io = new IntersectionObserver(([e]) => {
      const antes = visible;
      visible = e.isIntersecting;
      if (visible && !antes && !reducido) frame = requestAnimationFrame(bucle);
    });
    io.observe(canvas);
    const ro = new ResizeObserver(() => {
      ajustar();
      dibujar(performance.now());
    });
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      ro.disconnect();
    };
  }, [columnas, puntosPorColumna, color]);

  return <canvas ref={ref} aria-hidden className={cn("block h-full w-full", className)} />;
}

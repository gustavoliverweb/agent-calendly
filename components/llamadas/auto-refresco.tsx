"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Recarga los datos del servidor cada pocos segundos mientras la llamada sigue abierta. */
export function AutoRefresco({ activo, cadaMs = 5000 }: { activo: boolean; cadaMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!activo) return;
    const id = setInterval(() => router.refresh(), cadaMs);
    return () => clearInterval(id);
  }, [activo, cadaMs, router]);
  return null;
}

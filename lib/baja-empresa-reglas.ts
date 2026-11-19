/** Reglas puras del borrado de una empresa desde /admin (testables sin BD). */

export type CondicionesBorrado = {
  estado: string;
  esPrincipal: boolean;
  llamadasEnCurso: number;
  slug: string;
  confirmacion: string;
};

/** Por qué no se puede borrar la empresa, o null si se puede. */
export function motivoNoBorrable(c: CondicionesBorrado): string | null {
  if (c.esPrincipal) {
    return "La empresa principal no se puede borrar: usa las integraciones de la plataforma (Calendly y línea de entorno) y la siguiente empresa las heredaría.";
  }
  if (c.estado !== "suspendida") return "Suspende la empresa antes de borrarla.";
  if (c.llamadasEnCurso > 0) return "Tiene llamadas en curso. Espera a que terminen.";
  if (c.confirmacion.trim().toLowerCase() !== c.slug.toLowerCase()) {
    return "Escribe el identificador de la empresa para confirmar.";
  }
  return null;
}

export type FilaUso = {
  mes: string;
  llamadas: number;
  contestadas: number;
  citas: number;
  segundos: number | string;
  pruebas: number;
  segundos_pruebas: number | string;
};

/** Uso mensual que se conserva en la auditoría: solo los meses con actividad, sin datos personales. */
export function usoParaConservar(filas: FilaUso[]) {
  return filas
    .filter((f) => f.llamadas > 0 || f.pruebas > 0)
    .map((f) => ({
      mes: f.mes.slice(0, 7),
      llamadas: f.llamadas,
      contestadas: f.contestadas,
      citas: f.citas,
      segundos: Number(f.segundos),
      pruebas: f.pruebas,
      segundos_pruebas: Number(f.segundos_pruebas),
    }));
}

/** Ejecuta `fn` sobre cada elemento con como mucho `n` a la vez; devuelve los que fallaron. */
export async function enParalelo<T>(items: T[], n: number, fn: (item: T) => Promise<unknown>): Promise<T[]> {
  const fallidos: T[] = [];
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < items.length) {
      const item = items[siguiente++];
      try {
        await fn(item);
      } catch {
        fallidos.push(item);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, trabajador));
  return fallidos;
}

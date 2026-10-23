import { fechaMadrid, partesMadrid } from "@/lib/time/madrid";

/** Hora (Madrid) a partir de la cual un hueco cuenta como "tarde". */
const INICIO_TARDE = 14;

type Franja = "manana" | "tarde";

function franja(fecha: Date): Franja {
  return partesMadrid(fecha).hora < INICIO_TARDE ? "manana" : "tarde";
}

/**
 * Elige hasta `n` huecos variados de una lista: primero días distintos
 * (alternando mañana y tarde), luego la otra franja de esos días y, si aún
 * faltan, los más próximos. Determinista; devuelve en orden cronológico.
 */
export function seleccionarHuecos(huecos: Date[], n = 3): Date[] {
  const orden = [...huecos].sort((a, b) => a.getTime() - b.getTime());
  const elegidos: Date[] = [];
  const usados = new Set<number>();
  const elegir = (h: Date) => {
    elegidos.push(h);
    usados.add(h.getTime());
  };

  // 1. Un hueco por día, alternando franja respecto al anterior si se puede.
  const porDia = new Map<string, Date[]>();
  for (const h of orden) {
    const dia = fechaMadrid(h);
    porDia.set(dia, [...(porDia.get(dia) ?? []), h]);
  }
  let anterior: Franja | undefined;
  for (const delDia of porDia.values()) {
    if (elegidos.length >= n) break;
    const h = delDia.find((x) => franja(x) !== anterior) ?? delDia[0];
    elegir(h);
    anterior = franja(h);
  }

  // 2. La franja que falte en los días ya elegidos.
  for (const delDia of porDia.values()) {
    if (elegidos.length >= n) break;
    const yaFranjas = new Set(delDia.filter((x) => usados.has(x.getTime())).map(franja));
    const h = delDia.find((x) => !usados.has(x.getTime()) && !yaFranjas.has(franja(x)));
    if (h) elegir(h);
  }

  // 3. Lo más próximo que quede.
  for (const h of orden) {
    if (elegidos.length >= n) break;
    if (!usados.has(h.getTime())) elegir(h);
  }

  return elegidos.sort((a, b) => a.getTime() - b.getTime());
}

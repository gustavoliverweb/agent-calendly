import { diasEntre, partesMadrid } from "@/lib/time/madrid";

const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Texto de un hueco para que el agente lo lea tal cual, en hora de Madrid:
 * "hoy a las 17:30", "mañana jueves 23 a las 11:00", "jueves 23 a las 11:00"
 * o, si es de otro mes, "lunes 2 de noviembre a las 10:00".
 */
export function formatearHueco(inicio: Date, ahora: Date): string {
  const p = partesMadrid(inicio);
  const hora = `${String(p.hora).padStart(2, "0")}:${String(p.minuto).padStart(2, "0")}`;
  const dias = diasEntre(ahora, inicio);
  if (dias === 0) return `hoy a las ${hora}`;

  const otroMes = partesMadrid(ahora).mes !== p.mes;
  const fecha = `${DIAS[p.diaSemana - 1]} ${p.dia}${otroMes ? ` de ${MESES[p.mes - 1]}` : ""}`;
  return `${dias === 1 ? "mañana " : ""}${fecha} a las ${hora}`;
}

/** "a", "a o b", "a, b o c" */
export function unirOpciones(textos: string[]): string {
  if (textos.length <= 1) return textos[0] ?? "";
  return `${textos.slice(0, -1).join(", ")} o ${textos.at(-1)}`;
}

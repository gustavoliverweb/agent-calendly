/**
 * Instrucciones fijas según a quién se llama (plan SaaS §5), que el agente
 * recibe como {{instrucciones_modo}}. No las edita la empresa: incluyen
 * reglas legales (identificarse como asistente virtual ante cada persona
 * nueva, respetar "no llaméis más").
 */

export type ModoLlamada = "b2b" | "b2c";

export type ContactoModo = { nombre: string; organizacion?: string | null; cargo?: string | null };

export function instruccionesModo(modo: ModoLlamada, c: ContactoModo): string {
  if (modo === "b2c") {
    return [
      `Llamas a un particular: ${c.nombre}.`,
      "Si contesta otra persona, pregunta con educación cuándo puedes encontrar a la persona a la que llamas y no des detalles del motivo.",
    ].join("\n");
  }
  const persona = [c.nombre, c.cargo ? `(${c.cargo})` : null].filter(Boolean).join(" ");
  const empresa = c.organizacion ? ` de ${c.organizacion}` : "";
  return [
    `Llamas a una empresa${empresa}, no a un particular. Quieres hablar con ${persona}.`,
    "- Puede contestar recepción o una centralita: saluda, di tu nombre, de qué negocio llamas y que eres una asistente virtual, y pide que te pasen con esa persona (o con quien se ocupe de ese cargo).",
    "- Con recepción sé breve: explica el motivo en una frase y no des precios ni detalles comerciales.",
    "- Si te pasan con otra persona, vuelve a presentarte: tu nombre, que eres una asistente virtual y que la llamada se transcribe.",
    "- Confirma el nombre y el cargo de quien te atiende. Ofrece la cita solo a la persona que decide o a quien te indiquen.",
    "- Si la persona no está o no puede atenderte: pregunta cuándo es mejor llamar y si hay un teléfono directo o un email, agradece y despídete.",
    "- Si te dan el nombre de otra persona más adecuada, anótalo (nombre, cargo, teléfono directo si lo dan) y despídete.",
    "- Si te piden que no volváis a llamar a la empresa o a esa persona, usa la herramienta no_llamar y despídete.",
  ].join("\n");
}

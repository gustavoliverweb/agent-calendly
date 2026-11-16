/**
 * Huecos que puede ocupar cada empresa en una pasada del dispatcher: los
 * libres de la plataforma a partes iguales entre las empresas con cola.
 * Mínimo 1, para que con pocos huecos vayan entrando por turnos (el orden
 * rota cada minuto); la BD vuelve a comprobar el límite global al reservar.
 */
export function calcularCuota(maximoGlobal: number, activasGlobal: number, empresasConCola: number): number {
  const libres = Math.max(0, maximoGlobal - activasGlobal);
  return Math.max(1, Math.floor(libres / Math.max(1, empresasConCola)));
}

/**
 * «Primeros pasos» del Resumen: lo que una empresa nueva tiene que dejar
 * listo antes de su primera campaña. Cada paso se marca solo a partir de los
 * datos; la tarjeta desaparece cuando están todos hechos.
 */

export type EstadoPrimerosPasos = {
  guionActivo: boolean;
  hayPrueba: boolean;
  calendly: "oauth" | "entorno" | null;
  configuracionRevisada: boolean;
  contactos: number;
  linea: boolean;
  lotes: number;
};

export type Paso = {
  id: "guion" | "prueba" | "calendly" | "configuracion" | "contactos" | "linea" | "lote";
  titulo: string;
  descripcion: string;
  hecho: boolean;
  /** Dónde se hace. Sin enlace: depende de la plataforma, no de la empresa. */
  href?: string;
  /** Solo el propietario puede hacerlo (los operadores lo ven sin enlace). */
  soloPropietario?: boolean;
};

export function construirPasos(e: EstadoPrimerosPasos): Paso[] {
  return [
    {
      id: "guion",
      titulo: "Escribe y activa el guion",
      descripcion: "Qué dice el agente, a quién llama y qué ofrece.",
      hecho: e.guionActivo,
      href: "/app/guion",
      soloPropietario: true,
    },
    {
      id: "prueba",
      titulo: "Prueba el agente en el navegador",
      descripcion: "Habla con él antes de que llame a nadie.",
      hecho: e.hayPrueba,
      href: "/app/guion",
    },
    {
      id: "calendly",
      titulo: "Conecta tu Calendly",
      descripcion:
        e.calendly === "entorno"
          ? "Ahora se usa la agenda provisional de la plataforma; conecta la tuya cuando quieras."
          : "Para que el agente reserve las citas en tu agenda.",
      hecho: e.calendly != null,
      href: "/app/calendly",
      soloPropietario: true,
    },
    {
      id: "configuracion",
      titulo: "Revisa horario y tipo de campaña",
      descripcion: "Franjas en las que se llama, festivos y reintentos.",
      hecho: e.configuracionRevisada,
      href: "/app/configuracion",
    },
    {
      id: "contactos",
      titulo: "Importa tus contactos",
      descripcion: "Desde un CSV o uno a uno.",
      hecho: e.contactos > 0,
      href: "/app/contactos/importar",
    },
    {
      id: "linea",
      titulo: "Línea telefónica",
      descripcion: "La damos de alta nosotros con los datos de tu operador. Mientras tanto puedes preparar todo lo demás.",
      hecho: e.linea,
    },
    {
      id: "lote",
      titulo: "Lanza tu primer lote",
      descripcion: "Elige a quién llamar y el agente se encarga dentro de tu horario.",
      hecho: e.lotes > 0,
      href: "/app/lotes",
    },
  ];
}

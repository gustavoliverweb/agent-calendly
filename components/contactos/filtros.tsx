"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ESTADOS, ETIQUETA_ESTADO, type ContactoEstado } from "@/lib/contacts/estados";

export function FiltrosContactos({ totales }: { totales: Partial<Record<ContactoEstado, number>> }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const estados = (searchParams.get("estado") ?? "").split(",").filter(Boolean);
  const seguimiento = searchParams.get("seguimiento") === "1";

  function navegar(cambios: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(cambios)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    params.delete("pagina");
    startTransition(() => router.replace(`${pathname}?${params}`, { scroll: false }));
  }

  // Búsqueda con espera de 300 ms tras dejar de escribir.
  useEffect(() => {
    if (q === (searchParams.get("q") ?? "")) return;
    const t = setTimeout(() => navegar({ q: q.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function toggleEstado(estado: string) {
    const nuevos = estados.includes(estado) ? estados.filter((e) => e !== estado) : [...estados, estado];
    navegar({ estado: nuevos.join(",") || null });
  }

  const chip = (activo: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
      activo ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
    );

  return (
    <div className={cn("flex flex-col gap-3", pending && "opacity-70")}>
      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, teléfono o email"
          className="pl-8"
          aria-label="Buscar contactos"
        />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
        {ESTADOS.map((estado) => (
          <button
            key={estado}
            type="button"
            className={chip(estados.includes(estado))}
            aria-pressed={estados.includes(estado)}
            onClick={() => toggleEstado(estado)}
          >
            {ETIQUETA_ESTADO[estado]}
            <span className="tabular-nums opacity-70">{totales[estado] ?? 0}</span>
          </button>
        ))}
        <button
          type="button"
          className={chip(seguimiento)}
          aria-pressed={seguimiento}
          onClick={() => navegar({ seguimiento: seguimiento ? null : "1" })}
        >
          Requiere seguimiento
        </button>
      </div>
    </div>
  );
}

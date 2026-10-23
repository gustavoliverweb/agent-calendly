"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  UsersIcon,
  PhoneIcon,
  ListOrderedIcon,
  SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Resumen", icon: LayoutDashboardIcon },
  { href: "/contactos", label: "Contactos", icon: UsersIcon },
  { href: "/llamadas", label: "Llamadas", icon: PhoneIcon },
  { href: "/lotes", label: "Lotes", icon: ListOrderedIcon },
  { href: "/configuracion", label: "Configuración", icon: SettingsIcon },
] as const;

/** Resalta la sección activa. Usa la URL: renderizar dentro de <Suspense>. */
export function PanelNav() {
  return <NavLinks pathname={usePathname()} />;
}

/** Mismo menú sin sección activa, para el fallback del <Suspense>. */
export function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav className="flex gap-1 md:flex-col">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              active && "bg-muted text-foreground",
            )}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

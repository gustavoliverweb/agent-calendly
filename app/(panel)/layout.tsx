import { Suspense } from "react";
import Link from "next/link";
import { PhoneOutgoingIcon } from "lucide-react";
import { NavLinks, PanelNav } from "@/components/panel/nav";
import { UserMenu } from "@/components/panel/user-menu";

export default function PanelLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <PhoneOutgoingIcon className="size-5" />
          Agente de voz
        </Link>
        <Suspense fallback={<div className="h-7 w-40 animate-pulse rounded bg-muted" />}>
          <UserMenu />
        </Suspense>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="border-b p-2 md:w-56 md:border-r md:border-b-0 md:p-3">
          <Suspense fallback={<NavLinks pathname={null} />}>
            <PanelNav />
          </Suspense>
        </aside>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

import { Card, CardContent } from "@/components/ui/card";

/** Marcador para secciones que se construyen en fases posteriores del plan. */
export function ComingSoon({ fase, children }: { fase: number; children: React.ReactNode }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">En construcción (fase {fase})</p>
        <p className="mt-1">{children}</p>
      </CardContent>
    </Card>
  );
}

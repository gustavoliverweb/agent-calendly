"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { DownloadIcon, FileUpIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  aplicarMapeo,
  CAMPOS,
  decodificar,
  detectarMapeo,
  ETIQUETAS,
  generarCsv,
  parsearCsv,
  type CsvParseado,
  type Mapeo,
} from "@/lib/contacts/csv";
import {
  ETIQUETA_AVISO,
  ETIQUETA_ESTADO_FILA,
  MAX_FILAS,
  resumir,
  validarFilas,
  type EstadoFila,
  type FilaValidada,
} from "@/lib/contacts/import";
import { normalizePhone } from "@/lib/contacts/phone";
import { buscarExistentes, importarContactos, type ResultadoImportacion } from "@/app/(panel)/contactos/importar/actions";

const MAX_BYTES = 3 * 1024 * 1024;
const FILAS_VISTA = 200;

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const COLOR_FILA: Record<EstadoFila, string> = {
  valido: "text-green-700 dark:text-green-300",
  telefono_invalido: "text-red-700 dark:text-red-300",
  falta_nombre: "text-red-700 dark:text-red-300",
  duplicado_en_archivo: "text-amber-700 dark:text-amber-300",
  duplicado_en_bd: "text-amber-700 dark:text-amber-300",
};

type Paso = "subir" | "mapear" | "revisar" | "hecho";

function descargar(nombre: string, contenido: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
  a.click();
  URL.revokeObjectURL(url);
}

function csvDeRechazadas(filas: Pick<FilaValidada, "linea" | "estado" | "original">[]) {
  return generarCsv(
    filas.map((f) => ({
      linea: f.linea,
      motivo: ETIQUETA_ESTADO_FILA[f.estado],
      ...Object.fromEntries(CAMPOS.map((c) => [c, f.original[c] ?? ""])),
    })),
  );
}

export function ImportarWizard() {
  const [paso, setPaso] = useState<Paso>("subir");
  const [archivo, setArchivo] = useState<string>("");
  const [csv, setCsv] = useState<CsvParseado | null>(null);
  const [mapeo, setMapeo] = useState<Mapeo>({});
  const [validadas, setValidadas] = useState<FilaValidada[]>([]);
  const [filtro, setFiltro] = useState<EstadoFila | "todas">("todas");
  const [modo, setModo] = useState<"ignorar" | "completar">("ignorar");
  const [resultado, setResultado] = useState<Exclude<ResultadoImportacion, { error: string }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const resumen = useMemo(() => resumir(validadas), [validadas]);

  async function leerArchivo(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) return setError("El archivo es demasiado grande (máximo 3 MB).");
    const parsed = parsearCsv(decodificar(await file.arrayBuffer()));
    if (!parsed.headers.length || !parsed.filas.length) {
      return setError("No se han encontrado filas. Revisa que el archivo tenga cabecera y datos.");
    }
    if (parsed.filas.length > MAX_FILAS) {
      return setError(`El archivo tiene ${parsed.filas.length} filas; el máximo es ${MAX_FILAS}. Divídelo en varios.`);
    }
    setArchivo(file.name);
    setCsv(parsed);
    setMapeo(detectarMapeo(parsed.headers));
    setPaso("mapear");
  }

  function revisar() {
    if (!csv) return;
    setError(null);
    startTransition(async () => {
      const entrada = aplicarMapeo(csv.filas, mapeo);
      const telefonos = entrada.flatMap((f) => {
        const r = normalizePhone(f.telefono);
        return r.ok ? [r.e164] : [];
      });
      const existentes = new Set(await buscarExistentes(telefonos));
      setValidadas(validarFilas(entrada, existentes));
      setFiltro("todas");
      setPaso("revisar");
    });
  }

  function importar() {
    if (!csv) return;
    setError(null);
    startTransition(async () => {
      const r = await importarContactos({ filas: aplicarMapeo(csv.filas, mapeo), modoDuplicados: modo });
      if ("error" in r) return setError(r.error);
      setResultado(r);
      setPaso("hecho");
    });
  }

  function reiniciar() {
    setPaso("subir");
    setCsv(null);
    setValidadas([]);
    setResultado(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const errorAlert = error && (
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );

  if (paso === "subir") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>1. Sube el archivo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label
            className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center hover:bg-muted/50"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) void leerArchivo(file);
            }}
          >
            <FileUpIcon className="size-8 text-muted-foreground" />
            <span className="font-medium">Arrastra un CSV o pulsa para elegirlo</span>
            <span className="text-sm text-muted-foreground">
              Separado por comas o punto y coma. Columnas: nombre, teléfono, email, consentimiento… (máx. {MAX_FILAS} filas)
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void leerArchivo(file);
              }}
            />
          </label>
          {errorAlert}
        </CardContent>
      </Card>
    );
  }

  if (paso === "mapear" && csv) {
    const faltan = !mapeo.nombre || !mapeo.telefono;
    return (
      <Card>
        <CardHeader>
          <CardTitle>2. Comprueba las columnas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {archivo}: {csv.filas.length} filas. Hemos detectado estas columnas; corrígelas si hace falta.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {CAMPOS.map((campo) => (
              <label key={campo} className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">
                  {ETIQUETAS[campo]}
                  {(campo === "nombre" || campo === "telefono") && " *"}
                </span>
                <select
                  className={selectClass}
                  value={mapeo[campo] ?? ""}
                  onChange={(e) => setMapeo({ ...mapeo, [campo]: e.target.value || undefined })}
                >
                  <option value="">— No importar —</option>
                  {csv.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {errorAlert}
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={reiniciar}>
              Elegir otro archivo
            </Button>
            <Button onClick={revisar} disabled={faltan || pending}>
              {pending ? "Comprobando…" : faltan ? "Falta nombre o teléfono" : "Ver vista previa"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (paso === "revisar") {
    const filas = filtro === "todas" ? validadas : validadas.filter((f) => f.estado === filtro);
    const rechazadas = validadas.filter((f) => f.estado !== "valido");
    const tarjetas: [EstadoFila | "todas", string, number][] = [
      ["todas", "Total", resumen.total],
      ["valido", "Se importarán", resumen.valido],
      ["duplicado_en_bd", "Ya existen", resumen.duplicado_en_bd],
      ["duplicado_en_archivo", "Duplicados en el archivo", resumen.duplicado_en_archivo],
      ["telefono_invalido", "Teléfono inválido", resumen.telefono_invalido],
      ["falta_nombre", "Sin nombre", resumen.falta_nombre],
    ];

    return (
      <Card>
        <CardHeader>
          <CardTitle>3. Revisa e importa</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {tarjetas.map(([clave, etiqueta, n]) => (
              <button
                key={clave}
                type="button"
                onClick={() => setFiltro(clave)}
                aria-pressed={filtro === clave}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                  filtro === clave && "border-primary ring-1 ring-primary",
                )}
              >
                <div className="text-2xl font-semibold tabular-nums">{n}</div>
                <div className="text-xs text-muted-foreground">{etiqueta}</div>
              </button>
            ))}
          </div>

          {resumen.sinConsentimiento > 0 && (
            <Alert>
              <AlertDescription>
                {resumen.sinConsentimiento} contactos válidos no tienen consentimiento. Se importarán, pero si la
                campaña es comercial no se les podrá llamar.
              </AlertDescription>
            </Alert>
          )}

          <div className="max-h-[28rem] overflow-auto rounded-xl border">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Línea</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden md:table-cell">Avisos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.slice(0, FILAS_VISTA).map((f) => (
                  <TableRow key={f.linea}>
                    <TableCell className="tabular-nums text-muted-foreground">{f.linea}</TableCell>
                    <TableCell className={cn("font-medium whitespace-nowrap", COLOR_FILA[f.estado])}>
                      {ETIQUETA_ESTADO_FILA[f.estado]}
                    </TableCell>
                    <TableCell>{f.contacto.nombre ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="tabular-nums whitespace-nowrap">
                      {f.contacto.telefono ?? <span className="text-red-700 dark:text-red-300">{f.original.telefono || "—"}</span>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{f.contacto.email ?? "—"}</TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      {f.avisos.map((a) => ETIQUETA_AVISO[a]).join(" · ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filas.length > FILAS_VISTA && (
              <p className="p-3 text-center text-xs text-muted-foreground">
                Mostrando {FILAS_VISTA} de {filas.length} filas.
              </p>
            )}
          </div>

          {resumen.duplicado_en_bd > 0 && (
            <fieldset className="flex flex-col gap-2 text-sm">
              <legend className="mb-1 font-medium">Contactos que ya existen</legend>
              <label className="flex items-center gap-2">
                <input type="radio" name="modo" checked={modo === "ignorar"} onChange={() => setModo("ignorar")} />
                Ignorarlos (no se cambia nada)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="modo" checked={modo === "completar"} onChange={() => setModo("completar")} />
                Completar solo los datos que les falten (email, notas, consentimiento)
              </label>
            </fieldset>
          )}

          {errorAlert}
          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setPaso("mapear")} disabled={pending}>
                Volver
              </Button>
              {rechazadas.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => descargar("contactos-con-errores.csv", csvDeRechazadas(rechazadas))}
                >
                  <DownloadIcon data-icon="inline-start" />
                  Descargar filas no importables
                </Button>
              )}
            </div>
            <Button onClick={importar} disabled={pending || (resumen.valido === 0 && modo === "ignorar")}>
              {pending ? "Importando…" : `Importar ${resumen.valido} contactos`}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (paso === "hecho" && resultado) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Importación terminada</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <ul className="flex flex-col gap-1">
            <li>
              <strong className="tabular-nums">{resultado.importados}</strong> contactos nuevos importados
            </li>
            {resultado.completados > 0 && (
              <li>
                <strong className="tabular-nums">{resultado.completados}</strong> contactos existentes completados
              </li>
            )}
            <li>
              <strong className="tabular-nums">{resultado.rechazadas.length}</strong> filas no importadas
            </li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Link href="/contactos" className={buttonVariants()}>
              Ver contactos
            </Link>
            {resultado.rechazadas.length > 0 && (
              <Button
                variant="outline"
                onClick={() => descargar("contactos-no-importados.csv", csvDeRechazadas(resultado.rechazadas))}
              >
                <DownloadIcon data-icon="inline-start" />
                Descargar filas no importadas
              </Button>
            )}
            <Button variant="ghost" onClick={reiniciar}>
              Importar otro archivo
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

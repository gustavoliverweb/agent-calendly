import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { marcaPlataforma } from "@/lib/marca-plataforma";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const marca = await marcaPlataforma();
  return {
    title: {
      default: `${marca.nombre} · Agente de voz que agenda citas`,
      template: `%s · ${marca.nombre}`,
    },
    description: marca.descripcion,
    ...(process.env.APP_URL ? { metadataBase: new URL(process.env.APP_URL) } : {}),
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Relativa: detrás del proxy de Render, la URL de la petición lleva el host
  // interno (localhost:10000), no el público.
  return new NextResponse(null, { status: 303, headers: { Location: "/login" } });
}

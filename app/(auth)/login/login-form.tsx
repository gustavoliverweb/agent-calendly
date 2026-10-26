"use client";

import { startTransition, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { iniciarSesion, recuperarContrasena, type LoginState } from "./actions";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/app";
  const linkError =
    searchParams.get("error") === "enlace_invalido"
      ? "El enlace no es válido o ha caducado. Pide una invitación nueva o recupera la contraseña."
      : undefined;
  const [loginState, loginAction, loginPending] = useActionState<LoginState, FormData>(
    iniciarSesion,
    {},
  );
  const [recState, recAction, recPending] = useActionState<LoginState, FormData>(
    recuperarContrasena,
    {},
  );
  const error = loginState.error ?? recState.error ?? linkError;

  return (
    <form
      // Envío manual para que un error de contraseña no borre el email escrito.
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter;
        const data = new FormData(e.currentTarget, submitter);
        const action = submitter?.dataset.accion === "recuperar" ? recAction : loginAction;
        startTransition(() => action(data));
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {recState.info && (
        <Alert>
          <AlertDescription>{recState.info}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" size="lg" className="rounded-full" disabled={loginPending}>
        {loginPending ? "Entrando…" : "Entrar"}
      </Button>
      <Button
        type="submit"
        variant="link"
        data-accion="recuperar"
        formNoValidate
        disabled={recPending}
      >
        He olvidado mi contraseña
      </Button>
    </form>
  );
}

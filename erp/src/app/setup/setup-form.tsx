"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { setupAction } from "../login/actions";
import { Field } from "@/components/app/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SetupForm({ needsCode }: { needsCode: boolean }) {
  const [state, action, pending] = useActionState(setupAction, {});
  return (
    <form action={action} className="mt-6 grid gap-4">
      {needsCode && (
        <Field label="Setup code" ml="സെറ്റപ്പ് കോഡ്" htmlFor="code" hint="The ERP_SETUP_CODE you saved in Vercel">
          <Input id="code" name="code" type="password" required autoFocus />
        </Field>
      )}
      <Field label="Your name" ml="പേര്" htmlFor="name">
        <Input id="name" name="name" placeholder="e.g. Sahim KT" required autoFocus={!needsCode} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="PIN (6 digits)" ml="പിൻ" htmlFor="pin">
          <Input id="pin" name="pin" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} required />
        </Field>
        <Field label="Repeat PIN" htmlFor="pin2">
          <Input id="pin2" name="pin2" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} required />
        </Field>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} Create login & start
      </Button>
    </form>
  );
}

"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/app/field";
import { ListSelect } from "@/components/app/search-select";
import { saveCustomer, type CustomerInput } from "@/lib/actions/customers";

export type CustomerLite = { id: number; code: string; name: string; phone: string | null; place: string | null; /** Other wearers' names, comma separated */ people?: string | null };

export function CustomerDialog({
  open,
  onOpenChange,
  initial,
  types,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Partial<CustomerInput>;
  types: string[];
  onSaved?: (c: CustomerLite) => void;
}) {
  const [v, setV] = React.useState<CustomerInput>({ name: "", type: "Walk-in", ...initial });
  const [pending, start] = React.useTransition();
  React.useEffect(() => {
    if (open) setV({ name: "", type: "Walk-in", ...initial });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof CustomerInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await saveCustomer(v);
      if (!r.ok) return void toast.error(r.error);
      toast.success(v.id ? "Customer updated" : `Customer ${r.data.code} added`);
      onSaved?.(r.data);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{v.id ? "Edit customer" : "New customer"}</DialogTitle>
          <DialogDescription>കസ്റ്റമർ വിവരം</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" ml="പേര്" required htmlFor="c-name">
              <Input id="c-name" value={v.name} onChange={set("name")} autoFocus required />
            </Field>
            <Field label="Phone" ml="ഫോൺ" htmlFor="c-phone" hint="Abroad? Type + and country code">
              <Input id="c-phone" value={v.phone ?? ""} onChange={set("phone")} inputMode="tel" placeholder="98461 86713 or +971501234567" />
            </Field>
            <Field label="Second number" ml="രണ്ടാം നമ്പർ" htmlFor="c-phone2" hint="Optional — e.g. Gulf WhatsApp">
              <Input id="c-phone2" value={v.altPhone ?? ""} onChange={set("altPhone")} inputMode="tel" placeholder="+971…" />
            </Field>
            <Field label="Place" ml="സ്ഥലം" htmlFor="c-place">
              <Input id="c-place" value={v.place ?? ""} onChange={set("place")} />
            </Field>
            <Field label="Type" ml="തരം">
              <ListSelect items={types} value={v.type} onChange={(t) => setV((s) => ({ ...s, type: t }))} />
            </Field>
          </div>
          <Field label="Remarks" ml="കുറിപ്പ്" htmlFor="c-rem">
            <Textarea id="c-rem" value={v.remarks ?? ""} onChange={set("remarks")} rows={2} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

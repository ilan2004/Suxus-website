"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/app/field";
import { saveSupplier, type SupplierInput } from "@/lib/actions/purchases";

export function SupplierDialog({ value, onClose, onSaved }: { value: SupplierInput | null; onClose: () => void; onSaved: (id: number) => void }) {
  const [v, setV] = React.useState<SupplierInput | null>(value);
  const [pending, start] = React.useTransition();
  React.useEffect(() => setV(value), [value]);
  if (!v) return <Dialog open={false} />;
  const f = (k: keyof SupplierInput, label: string, ml?: string, cls?: string) => (
    <Field label={label} ml={ml} className={cls}>
      <Input value={(v[k] as string | null | undefined) ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} required={k === "name"} />
    </Field>
  );
  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{v.id ? "Edit supplier" : "New supplier"}</DialogTitle>
          <DialogDescription>സപ്ലയർ വിവരം</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveSupplier(v);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Saved");
              onSaved(r.data.id);
              onClose();
            });
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          {f("name", "Name", "പേര്", "sm:col-span-2")}
          {f("type", "Type", "തരം")}
          {f("place", "Place", "സ്ഥലം")}
          {f("phone", "Phone", "ഫോൺ")}
          {f("upi", "UPI ID")}
          {f("bank", "Bank A/c & IFSC", "ബാങ്ക്", "sm:col-span-2")}
          {f("gstNo", "GST no.", "ജി.എസ്.ടി")}
          {f("supplies", "Supplies", "എന്ത് സാധനം")}
          <Field label="Notes" ml="കുറിപ്പ്" className="sm:col-span-2">
            <Textarea value={v.notes ?? ""} onChange={(e) => setV({ ...v, notes: e.target.value })} rows={3} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
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

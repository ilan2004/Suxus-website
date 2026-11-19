"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { changeMyPin } from "@/lib/actions/users";

const clean = (v: string) => v.replace(/\D/g, "").slice(0, 6);

/** Any signed-in user can change their own PIN (needs the current one). */
export function ChangePinDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [current, setCurrent] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [pin2, setPin2] = React.useState("");
  const [pending, start] = React.useTransition();
  React.useEffect(() => {
    if (open) {
      setCurrent("");
      setPin("");
      setPin2("");
    }
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change my PIN</DialogTitle>
          <DialogDescription>You stay signed in here; other devices will ask for the new PIN.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await changeMyPin({ current, pin, pin2 });
              if (!r.ok) return void toast.error(r.error);
              toast.success("PIN changed");
              onOpenChange(false);
            });
          }}
        >
          <Field label="Current PIN" htmlFor="cp-cur">
            <Input id="cp-cur" type="password" inputMode="numeric" autoComplete="current-password" value={current} onChange={(e) => setCurrent(clean(e.target.value))} required autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="New PIN (6 digits)" htmlFor="cp-new">
              <Input id="cp-new" type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPin(clean(e.target.value))} required />
            </Field>
            <Field label="Repeat new PIN" htmlFor="cp-new2">
              <Input id="cp-new2" type="password" inputMode="numeric" autoComplete="new-password" value={pin2} onChange={(e) => setPin2(clean(e.target.value))} required />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !current || pin.length !== 6 || pin !== pin2}>
              {pending && <Loader2 className="animate-spin" />} Change PIN
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

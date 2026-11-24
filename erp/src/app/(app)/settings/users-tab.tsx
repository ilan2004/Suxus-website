"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Lock, Pencil, Plus, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/app/field";
import { addUser, removeUserAccess, resetUserPin, unlockUser, updateUser, type UserRow } from "@/lib/actions/users";
import { ROLE_LABEL, type Role } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { MergeStaff } from "./merge-staff";
import { Switch } from "@/components/ui/switch";
import { setSimpleMode } from "@/lib/actions/profile";

const ROLES: { key: Role; label: string; hint: string }[] = [
  { key: "owner", label: "Owner", hint: "Everything" },
  { key: "partner", label: "Partner", hint: "Work side — no setup expenses, capital, costs, supplier balances, summary or settings" },
  { key: "staff", label: "Staff", hint: "Daily entry — like Partner, without Staff pages or deleting" },
];

type Dlg = { kind: "add" } | { kind: "edit"; u: UserRow } | { kind: "pin"; u: UserRow } | null;

export function UsersTab({ users, meId, simpleAvailable = false }: { users: UserRow[]; meId: number; /** the database has simple mode */ simpleAvailable?: boolean }) {
  const router = useRouter();
  const [dlg, setDlg] = React.useState<Dlg>(null);
  const withLogin = users.filter((u) => u.role);
  const done = (msg: string) => {
    toast.success(msg);
    setDlg(null);
    router.refresh();
  };

  return (
    <div className="grid max-w-3xl gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-card p-5">
        <div className="text-sm">
          <p className="font-medium">
            Users <span className="ml">ഉപയോക്താക്കൾ</span>
          </p>
          <p className="max-w-lg text-muted-foreground">Who can sign in, and what they see. PINs are 6 digits and stored only as a hash. 5 wrong PINs lock that login for 15 minutes.</p>
        </div>
        <Button onClick={() => setDlg({ kind: "add" })}>
          <Plus /> Add user
        </Button>
      </div>

      <ul className="grid gap-2">
        {withLogin.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{(u.displayName || u.name).slice(0, 2).toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{u.name}</span>
                {u.displayName && <span className="text-sm text-muted-foreground">“{u.displayName}”</span>}
                <Badge variant={u.role === "owner" ? "gold" : "secondary"}>{ROLE_LABEL[u.role!]}</Badge>
                {u.id === meId && <span className="text-xs text-muted-foreground">(you)</span>}
                {u.status !== "Active" && <Badge variant="destructive">Left</Badge>}
                {u.lockedUntil && (
                  <Badge variant="destructive">
                    <Lock /> Locked
                  </Badge>
                )}
              </div>
              {u.job && u.job !== ROLE_LABEL[u.role!] && <p className="text-xs text-muted-foreground">{u.job}</p>}
              {simpleAvailable && <label className="mt-1.5 flex w-fit cursor-pointer items-center gap-2 text-xs">
                <Switch
                  checked={u.simple}
                  aria-label={`Simple measurement mode for ${u.name}`}
                  onCheckedChange={async (on) => {
                    const r = await setSimpleMode(on, u.id);
                    if (!r.ok) return void toast.error(r.error);
                    done(`Simple measurement mode ${on ? "on" : "off"} for ${u.displayName || u.name}`);
                  }}
                />
                Simple measurement mode <span className="ml">ലളിതമായ അളവ് രീതി</span>
              </label>}
            </div>
            <div className="flex flex-wrap gap-1">
              {u.lockedUntil && (
                <Button size="sm" variant="outline" onClick={async () => { const r = await unlockUser(u.id); if (!r.ok) return void toast.error(r.error); done(`${u.name} unlocked`); }}>
                  Unlock
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setDlg({ kind: "edit", u })}>
                <Pencil /> Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDlg({ kind: "pin", u })}>
                <KeyRound /> {u.id === meId ? "Change PIN" : "Reset PIN"}
              </Button>
              {u.id !== meId && (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove sign-in for ${u.name}`}
                  onClick={async () => {
                    if (!confirm(`Remove ${u.name}'s sign-in? Their staff record, orders and wages stay.`)) return;
                    const r = await removeUserAccess(u.id);
                    if (!r.ok) return void toast.error(r.error);
                    done(`${u.name} can no longer sign in`);
                  }}
                >
                  <UserMinus className="text-destructive" />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <MergeStaff users={users} meId={meId} />

      {dlg?.kind === "add" && <AddDialog staffWithoutLogin={users.filter((u) => !u.role && u.status === "Active").map((u) => u.name)} onClose={() => setDlg(null)} onDone={done} />}
      {dlg?.kind === "edit" && <EditDialog u={dlg.u} onClose={() => setDlg(null)} onDone={done} />}
      {dlg?.kind === "pin" && <PinDialog u={dlg.u} onClose={() => setDlg(null)} onDone={done} />}
    </div>
  );
}

function RolePicker({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <div className="grid gap-1.5">
      {ROLES.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onChange(r.key)}
          className={cn("rounded-lg border p-2.5 text-left text-sm", value === r.key ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card hover:bg-muted/50")}
        >
          <span className="font-medium">{r.label}</span>
          <span className="block text-xs text-muted-foreground">{r.hint}</span>
        </button>
      ))}
    </div>
  );
}

function PinFields({ pin, pin2, setPin, setPin2 }: { pin: string; pin2: string; setPin: (v: string) => void; setPin2: (v: string) => void }) {
  const clean = (v: string) => v.replace(/\D/g, "").slice(0, 6);
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="PIN (6 digits)" ml="പിൻ" htmlFor="u-pin">
        <Input id="u-pin" type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPin(clean(e.target.value))} required minLength={6} maxLength={6} />
      </Field>
      <Field label="Repeat PIN" htmlFor="u-pin2">
        <Input id="u-pin2" type="password" inputMode="numeric" autoComplete="new-password" value={pin2} onChange={(e) => setPin2(clean(e.target.value))} required minLength={6} maxLength={6} />
      </Field>
    </div>
  );
}

function AddDialog({ staffWithoutLogin, onClose, onDone }: { staffWithoutLogin: string[]; onClose: () => void; onDone: (m: string) => void }) {
  const [name, setName] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [role, setRole] = React.useState<Role>("partner");
  const [pin, setPin] = React.useState("");
  const [pin2, setPin2] = React.useState("");
  const [pending, start] = React.useTransition();
  const linked = staffWithoutLogin.find((n) => n.toLowerCase().replace(/\s+/g, " ") === name.trim().toLowerCase().replace(/\s+/g, " "));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>Type the PIN here and tell it to the person — it is never shown again.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await addUser({ name, displayName, role, pin, pin2 });
              if (!r.ok) return void toast.error(r.error);
              onDone(`${name} can now sign in`);
            });
          }}
        >
          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <Field label="Name" ml="പേര്" htmlFor="u-name" hint={linked ? "Already in Staff — the sign-in is added to that record" : undefined}>
              <Input id="u-name" list="u-staff" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="e.g. Krishnankutty" />
              <datalist id="u-staff">
                {staffWithoutLogin.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </Field>
            <Field label="Display name" ml="ചുരുക്കപ്പേര്" htmlFor="u-short">
              <Input id="u-short" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={20} placeholder="e.g. GK" />
            </Field>
          </div>
          <Field label="Role" ml="റോൾ">
            <RolePicker value={role} onChange={setRole} />
          </Field>
          <PinFields pin={pin} pin2={pin2} setPin={setPin} setPin2={setPin2} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || pin.length !== 6 || pin !== pin2 || name.trim().length < 2}>
              {pending && <Loader2 className="animate-spin" />} Add user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ u, onClose, onDone }: { u: UserRow; onClose: () => void; onDone: (m: string) => void }) {
  const [displayName, setDisplayName] = React.useState(u.displayName ?? "");
  const [role, setRole] = React.useState<Role>(u.role!);
  const [pending, start] = React.useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {u.name}</DialogTitle>
          <DialogDescription>A role change applies straight away, on every device.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await updateUser({ id: u.id, displayName, role });
              if (!r.ok) return void toast.error(r.error);
              onDone("Saved");
            });
          }}
        >
          <Field label="Display name" ml="ചുരുക്കപ്പേര്" htmlFor="u-short" hint="Shown at the top and on records, e.g. “by GK”">
            <Input id="u-short" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={20} />
          </Field>
          <Field label="Role" ml="റോൾ">
            <RolePicker value={role} onChange={setRole} />
          </Field>
          <DialogFooter>
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

function PinDialog({ u, onClose, onDone }: { u: UserRow; onClose: () => void; onDone: (m: string) => void }) {
  const [pin, setPin] = React.useState("");
  const [pin2, setPin2] = React.useState("");
  const [pending, start] = React.useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New PIN for {u.name}</DialogTitle>
          <DialogDescription>They are signed out on every device and use the new PIN next time.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await resetUserPin({ id: u.id, pin, pin2 });
              if (!r.ok) return void toast.error(r.error);
              onDone(`New PIN set for ${u.name}`);
            });
          }}
        >
          <PinFields pin={pin} pin2={pin2} setPin={setPin} setPin2={setPin2} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || pin.length !== 6 || pin !== pin2}>
              {pending && <Loader2 className="animate-spin" />} Set PIN
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

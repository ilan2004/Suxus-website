"use client";

import { ROLE_LABEL, type Role } from "@/lib/permissions";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type ColumnDef } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Field } from "@/components/app/field";
import { ListSelect } from "@/components/app/search-select";
import { saveStaff, type StaffInput } from "@/lib/actions/staff";
import { cn, rupees } from "@/lib/utils";

type Row = {
  id: number;
  code: string;
  name: string;
  role: string | null;
  phone: string | null;
  joinDate: string | null;
  payType: string | null;
  monthlySalary: number | null;
  pieceRate: number | null;
  incentive: boolean;
  ownIncentivePct: number | null;
  status: string;
  remarks: string | null;
  access: string;
  hasPin: boolean;
};

export function StaffView({ rows, lists }: { rows: Row[]; lists: { staffRole: string[]; payType: string[] } }) {
  const router = useRouter();
  const [edit, setEdit] = React.useState<(StaffInput & { hasPin?: boolean; code?: string }) | null>(null);

  const columns: ColumnDef<Row>[] = [
    { accessorKey: "code", header: "ID", cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span> },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div>
          <Link href={`/staff/${row.original.id}`} data-no-row-click className={cn("font-medium hover:underline", row.original.status === "Left" && "text-muted-foreground line-through")}>
            {row.original.name}
          </Link>
          <div className="text-xs text-muted-foreground">{row.original.phone}</div>
        </div>
      ),
    },
    { accessorKey: "role", header: "Role" },
    { accessorKey: "payType", header: "Pay type", cell: ({ row }) => <span className="text-xs">{row.original.payType}</span> },
    {
      id: "pay",
      header: "Pay",
      meta: { align: "right" },
      cell: ({ row }) =>
        row.original.monthlySalary ? `${rupees(row.original.monthlySalary)}/mo` : row.original.pieceRate ? `${rupees(row.original.pieceRate)}/pc` : "—",
    },
    {
      accessorKey: "access",
      header: "Login",
      cell: ({ row }) =>
        row.original.access === "none" ? (
          <span className="text-xs text-muted-foreground">No login</span>
        ) : (
          <Badge variant={row.original.access === "owner" || row.original.access === "partner" ? "gold" : "secondary"}>
            <KeyRound /> {row.original.access}
          </Badge>
        ),
    },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge variant={row.original.status === "Active" ? "success" : "outline"}>{row.original.status}</Badge> },
    {
      id: "profile",
      header: "",
      cell: ({ row }) => (
        <Button asChild variant="ghost" size="sm" data-no-row-click>
          <Link href={`/staff/${row.original.id}`}>Profile →</Link>
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        onRowClick={(r) => setEdit({ ...r, status: r.status === "Left" ? "Left" : "Active", access: r.access as "owner" | "partner" | "staff" | "none" })}
        toolbar={
          <Button onClick={() => setEdit({ name: "", status: "Active", access: "none", incentive: false })}>
            <Plus /> Add staff
          </Button>
        }
      />
      <StaffSheet value={edit} onClose={() => setEdit(null)} lists={lists} onSaved={() => router.refresh()} />
    </>
  );
}

function StaffSheet({
  value,
  onClose,
  lists,
  onSaved,
}: {
  value: (StaffInput & { hasPin?: boolean; code?: string }) | null;
  onClose: () => void;
  lists: { staffRole: string[]; payType: string[] };
  onSaved: () => void;
}) {
  const [v, setV] = React.useState(value);
  const [pending, start] = React.useTransition();
  React.useEffect(() => setV(value ? { ...value, pin: "" } : null), [value]);
  if (!v) return <Sheet open={false} />;
  const set = <K extends keyof StaffInput>(k: K, val: StaffInput[K]) => setV((s) => (s ? { ...s, [k]: val } : s));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      let r = await saveStaff(v);
      // Add staff: same name or phone already in Staff → ask before creating a second record
      if (!r.ok && r.error.startsWith("DUPLICATE: ")) {
        if (!confirm(r.error.slice("DUPLICATE: ".length))) return;
        r = await saveStaff({ ...v, allowDuplicate: true });
      }
      if (!r.ok) return void toast.error(r.error);
      toast.success("Saved");
      onSaved();
      onClose();
    });
  };

  return (
    <Sheet open={!!value} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>{v.id ? `${v.code} · ${v.name}` : "Add staff"}</SheetTitle>
            <SheetDescription>ജീവനക്കാരുടെ വിവരം</SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Name" ml="പേര്" required className="sm:col-span-2">
              <Input value={v.name} onChange={(e) => set("name", e.target.value)} required autoFocus />
            </Field>
            <Field label="Role" ml="ജോലി">
              <ListSelect items={lists.staffRole} value={v.role} onChange={(x) => set("role", x)} />
            </Field>
            <Field label="Phone" ml="ഫോൺ">
              <Input value={v.phone ?? ""} onChange={(e) => set("phone", e.target.value)} inputMode="tel" />
            </Field>
            <Field label="Join date" ml="ചേർന്ന തീയതി">
              <Input type="date" value={v.joinDate ?? ""} onChange={(e) => set("joinDate", e.target.value)} />
            </Field>
            <Field label="Pay type" ml="ശമ്പള രീതി">
              <ListSelect items={lists.payType} value={v.payType} onChange={(x) => set("payType", x)} />
            </Field>
            <Field label="Monthly salary" ml="മാസ ശമ്പളം">
              <Input type="number" min={0} value={v.monthlySalary ?? ""} onChange={(e) => set("monthlySalary", e.target.value === "" ? null : Number(e.target.value))} />
            </Field>
            <Field label="Piece rate (₹)" ml="പീസ് റേറ്റ്">
              <Input type="number" min={0} value={v.pieceRate ?? ""} onChange={(e) => set("pieceRate", e.target.value === "" ? null : Number(e.target.value))} />
            </Field>
            <Label className="sm:col-span-1">
              <Switch checked={!!v.incentive} onCheckedChange={(c) => set("incentive", c)} /> Gets incentive
            </Label>
            <Field label="Own incentive %" ml="സ്വന്തം %" hint="Overrides the slab (e.g. 4 for commission-only)">
              <Input type="number" min={0} max={100} step="0.1" value={v.ownIncentivePct ?? ""} onChange={(e) => set("ownIncentivePct", e.target.value === "" ? null : Number(e.target.value))} />
            </Field>
            <Field label="Status" ml="സ്ഥിതി">
              <ListSelect items={["Active", "Left"]} value={v.status} onChange={(x) => set("status", (x as "Active" | "Left") ?? "Active")} />
            </Field>
            <Field label="Remarks" ml="കുറിപ്പ്" className="sm:col-span-2">
              <Textarea value={v.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} rows={2} />
            </Field>

            <div className="flex items-start gap-2 rounded-xl border bg-muted/30 p-4 text-sm sm:col-span-2">
              <KeyRound className="mt-0.5 size-4 shrink-0" />
              <p>
                <span className="font-medium">App sign-in:</span> {v.access && v.access !== "none" ? ROLE_LABEL[v.access as Role] : "none"}.{" "}
                <span className="text-muted-foreground">Sign-ins, roles and PINs are managed by the Owner in Settings → Users.</span>
              </p>
            </div>
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Save
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type ColumnDef } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import { MeasurementDialog, type MeasurementRow } from "@/components/forms/measurement-dialog";
import type { CustomerLite } from "@/components/forms/customer-dialog";
import { deleteMeasurement } from "@/lib/actions/measurements";
import { GARMENTS } from "@/lib/measurements";
import { fmtDate } from "@/lib/utils";

type Row = MeasurementRow & { customerName: string; phone: string | null };

export function MeasurementsView({
  rows,
  customers,
  lists,
}: {
  rows: Row[];
  customers: CustomerLite[];
  lists: { customerType: string[]; fit: string[] };
}) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<Partial<MeasurementRow> | null>(null);

  const columns: ColumnDef<Row>[] = [
    {
      accessorKey: "customerName",
      header: "Customer",
      cell: ({ row }) => (
        <Link href={`/customers/${row.original.customerId}`} className="font-medium hover:underline">
          {row.original.customerName}
          <span className="block text-xs font-normal text-muted-foreground">{row.original.phone}</span>
        </Link>
      ),
    },
    { accessorKey: "garmentType", header: "Garment" },
    { accessorKey: "size", header: "Size" },
    { accessorKey: "fit", header: "Fit" },
    {
      id: "values",
      header: "Measurements (in)",
      cell: ({ row }) => {
        const f = GARMENTS[row.original.garmentType] ?? [];
        return (
          <span className="text-xs text-muted-foreground">
            {f
              .filter((x) => row.original.values[x.en] != null)
              .map((x) => `${x.en} ${row.original.values[x.en]}`)
              .join(" · ")}
          </span>
        );
      },
    },
    { accessorKey: "date", header: "Date", cell: ({ row }) => fmtDate(row.original.date) },
    {
      id: "del",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete"
          onClick={async () => {
            if (!confirm("Delete these measurements?")) return;
            const r = await deleteMeasurement(row.original.id);
            if (!r.ok) return void toast.error(r.error);
            router.refresh();
          }}
        >
          <Trash2 className="text-muted-foreground" />
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Search customer, garment…"
        onRowClick={(r) => setDialog(r)}
        toolbar={
          <Button onClick={() => setDialog({})}>
            <Plus /> Add measurements
          </Button>
        }
        empty="No measurements saved yet."
      />
      <MeasurementDialog
        open={!!dialog}
        onOpenChange={(o) => {
          if (!o) {
            setDialog(null);
            router.refresh();
          }
        }}
        initial={dialog ?? undefined}
        customers={customers}
        customerTypes={lists.customerType}
        fits={lists.fit}
        history={rows}
      />
    </>
  );
}

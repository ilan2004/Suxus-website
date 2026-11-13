"use client";

import * as React from "react";
import { SearchSelect } from "@/components/app/search-select";
import { CustomerDialog, type CustomerLite } from "./customer-dialog";

/** Pick an existing customer (search by name / phone / code) or add a new one inline. */
export function CustomerPicker({
  customers: initial,
  value,
  onChange,
  types,
  id,
}: {
  customers: CustomerLite[];
  value: number | null | undefined;
  onChange: (c: CustomerLite | null) => void;
  types: string[];
  id?: string;
}) {
  const [list, setList] = React.useState(initial);
  const [creating, setCreating] = React.useState<{ name?: string; phone?: string } | null>(null);

  return (
    <>
      <SearchSelect
        id={id}
        options={list.map((c) => ({
          value: String(c.id),
          label: c.name,
          sub: [c.phone, c.place].filter(Boolean).join(" · "),
          keywords: [c.code],
        }))}
        value={value ? String(value) : null}
        onChange={(v) => onChange(v ? list.find((c) => String(c.id) === v) ?? null : null)}
        placeholder="Search name, phone or code…"
        searchPlaceholder="Name / phone / C-0001"
        allowClear
        onCreate={(q) => setCreating(/^\+?\d[\d\s-]{5,}$/.test(q) ? { phone: q } : { name: q })}
        createLabel="New customer"
      />
      <CustomerDialog
        open={!!creating}
        onOpenChange={(o) => !o && setCreating(null)}
        initial={creating ?? undefined}
        types={types}
        onSaved={(c) => {
          setList((l) => [...l, c].sort((a, b) => a.name.localeCompare(b.name)));
          onChange(c);
        }}
      />
    </>
  );
}

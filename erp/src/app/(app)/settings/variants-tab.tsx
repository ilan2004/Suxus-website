"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateSetting } from "@/lib/actions/settings";
import { DEFAULT_VARIANTS, kindOf, variantsFor, type VariantLists } from "@/lib/variants";

/**
 * Settings → Variants (തരം): what can be chosen as the variant of each garment on an order item. Shirt and Pant
 * lists are used by every shirt / pant item that has no list of its own (School Shirt, Uniform Pant …).
 */
export function VariantsTab({ value, items }: { value: VariantLists; items: string[] }) {
  const router = useRouter();
  const names = [...new Set(["Shirt", "Pant", ...items])];
  const [text, setText] = React.useState<Record<string, string>>(() => Object.fromEntries(names.map((n) => [n, (value[n] ?? []).join(", ")])));
  const [pending, start] = React.useTransition();
  const parsed = (): VariantLists =>
    Object.fromEntries(
      Object.entries(text)
        .map(([k, v]): [string, string[]] => [k, [...new Set(v.split(",").map((x) => x.trim()).filter(Boolean))]])
        .filter(([, v]) => v.length),
    );
  const dirty = JSON.stringify(parsed()) !== JSON.stringify(Object.fromEntries(Object.entries(value).filter(([, v]) => v.length)));

  const save = () =>
    start(async () => {
      const v = parsed();
      if (!v.Shirt?.length || !v.Pant?.length) return void toast.error("Shirt and Pant need at least one variant each");
      const r = await updateSetting("variants", v);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Variants saved");
      router.refresh();
    });

  return (
    <div className="grid max-w-3xl gap-4">
      <div className="rounded-xl border bg-card p-5 text-sm">
        <p className="font-medium">
          Variants <span className="ml">തരം</span>
        </p>
        <p className="text-muted-foreground">
          Chosen on every order item — never worked out from the measurements. Required for shirts and pants. Separate the variants with commas. A shirt or pant item left empty
          uses the Shirt / Pant list.
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="p-2">Garment</th>
              <th className="p-2">Variants (comma separated)</th>
            </tr>
          </thead>
          <tbody>
            {names.map((n) => {
              const inherited = !text[n]?.trim() && n !== "Shirt" && n !== "Pant" && kindOf(n);
              return (
                <tr key={n} className="border-b last:border-0">
                  <td className="p-2 align-middle font-medium whitespace-nowrap">
                    {n}
                    {kindOf(n) && <span className="ml-1 text-[10px] font-normal text-muted-foreground">required</span>}
                  </td>
                  <td className="p-2">
                    <Input
                      aria-label={`${n} variants`}
                      value={text[n] ?? ""}
                      placeholder={inherited ? `uses ${kindOf(n) === "shirt" ? "Shirt" : "Pant"}: ${variantsFor(n, { ...DEFAULT_VARIANTS, ...value }).join(", ")}` : "no variants"}
                      onChange={(e) => setText((t) => ({ ...t, [n]: e.target.value }))}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={!dirty || pending}>
          {pending && <Loader2 className="animate-spin" />} Save
        </Button>
      </div>
    </div>
  );
}

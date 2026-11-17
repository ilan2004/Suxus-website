"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, FileUp, Loader2, Search, Trash2, Undo2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addContactsAsCustomers, clearContactList, setContactStatus, uploadContacts } from "@/lib/actions/contacts";
import { parseContactFile } from "@/lib/contact-parse";
import { cn } from "@/lib/utils";
import { formatPhone } from "@/lib/phone";

type Contact = { id: number; name: string; phone: string | null; phone2: string | null; rawPhone: string | null; status: string; customerId: number | null };
type View = "pending" | "added" | "skipped";

const PAGE = 200;
const VIEWS: { key: View; label: string }[] = [
  { key: "pending", label: "Not yet reviewed" },
  { key: "added", label: "Added" },
  { key: "skipped", label: "Skipped" },
];
const nf = (n: number) => n.toLocaleString("en-IN");

export function ContactImportView({ contacts, customerPhones, canClear }: { contacts: Contact[]; customerPhones: [string, number][]; canClear: boolean }) {
  const router = useRouter();
  const customers = React.useMemo(() => new Map(customerPhones), [customerPhones]);
  const [view, setView] = React.useState<View>("pending");
  const [q, setQ] = React.useState("");
  const query = React.useDeferredValue(q);
  const [picked, setPicked] = React.useState<Set<number>>(new Set());
  const [limit, setLimit] = React.useState(PAGE);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [showBad, setShowBad] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const readable = React.useMemo(() => contacts.filter((c) => c.phone), [contacts]);
  const unreadable = React.useMemo(() => contacts.filter((c) => !c.phone), [contacts]);
  const counts = React.useMemo(() => {
    const r = { pending: 0, added: 0, skipped: 0 };
    for (const c of readable) if (c.status in r) r[c.status as View]++;
    return r;
  }, [readable]);
  const custOf = React.useCallback((c: Contact) => (c.phone ? customers.get(c.phone) : undefined) ?? (c.phone2 ? customers.get(c.phone2) : undefined), [customers]);
  const isCustomer = React.useCallback((c: Contact) => c.status !== "added" && custOf(c) != null, [custOf]);

  // Filter: status tab + search on name or number. "Already a customer" rows go to the end.
  const list = React.useMemo(() => {
    const text = query.trim().toLowerCase();
    const digits = text.replace(/\D/g, "");
    const rows = readable.filter((c) => {
      if (c.status !== view) return false;
      if (!text) return true;
      return c.name.toLowerCase().includes(text) || (digits.length >= 2 && (c.phone!.includes(digits) || !!c.phone2?.includes(digits)));
    });
    return view === "added" ? rows : [...rows.filter((c) => !isCustomer(c)), ...rows.filter(isCustomer)];
  }, [readable, view, query, isCustomer]);
  const selectable = React.useMemo(() => list.filter((c) => !isCustomer(c) && c.status !== "added"), [list, isCustomer]);

  React.useEffect(() => setLimit(PAGE), [view, query]);
  // Ticks only make sense inside one tab
  React.useEffect(() => setPicked(new Set()), [view]);

  const toggle = (id: number) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const upload = async (file: File) => {
    setBusy("upload");
    try {
      const parsed = await parseContactFile(file);
      if (!parsed.length) return void toast.error("No contacts found in that file. It needs Name and Phone columns (or a .vcf).");
      const total = { added: 0, alreadyInList: 0, unreadable: 0 };
      for (let i = 0; i < parsed.length; i += 1000) {
        const r = await uploadContacts({ source: file.name, contacts: parsed.slice(i, i + 1000) });
        if (!r.ok) return void toast.error(r.error);
        total.added += r.data.added;
        total.alreadyInList += r.data.alreadyInList;
        total.unreadable += r.data.unreadable;
      }
      toast.success(`${nf(total.added)} new contact${total.added === 1 ? "" : "s"} saved`, {
        description: [total.alreadyInList && `${nf(total.alreadyInList)} ${total.alreadyInList === 1 ? "was" : "were"} already in the list`, total.unreadable && `${nf(total.unreadable)} could not be read`].filter(Boolean).join(" · ") || undefined,
      });
      setView("pending");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const run = async (kind: "add" | "skip" | "back") => {
    const ids = [...picked];
    if (!ids.length) return;
    setBusy(kind);
    if (kind === "add") {
      const r = await addContactsAsCustomers(ids);
      setBusy(null);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${nf(r.data.added)} added, ${nf(r.data.alreadyPresent)} already present`);
    } else {
      const r = await setContactStatus(ids, kind === "skip" ? "skipped" : "pending");
      setBusy(null);
      if (!r.ok) return void toast.error(r.error);
      toast.success(kind === "skip" ? `${nf(r.data.changed)} skipped` : `${nf(r.data.changed)} moved back to Not yet reviewed`);
    }
    setPicked(new Set());
    router.refresh();
  };

  return (
    <div className="grid gap-4">
      {/* Upload */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 text-sm">
          {readable.length ? (
            <p>
              <span className="font-medium">{nf(readable.length)} contacts saved</span>
              <span className="text-muted-foreground">
                {" "}
                · {nf(counts.pending)} not yet reviewed · {nf(counts.added)} added · {nf(counts.skipped)} skipped
              </span>
            </p>
          ) : (
            <p className="font-medium">Upload your contacts</p>
          )}
          <p className="text-xs text-muted-foreground">.xlsx or .csv with Name and Phone columns (and Second number, if you have it), or a .vcf exported from the phone. Foreign numbers need their + country code, e.g. +971501234567. Uploading again only adds new numbers. Nothing is written back to the phone.</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.csv,.vcf,.vcard,text/csv,text/vcard,text/x-vcard"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        <div className="flex gap-2">
          <Button onClick={() => fileRef.current?.click()} disabled={busy === "upload"} variant={readable.length ? "outline" : "default"}>
            {busy === "upload" ? <Loader2 className="animate-spin" /> : <FileUp />} {readable.length ? "Upload more" : "Choose file"}
          </Button>
          {canClear && contacts.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Forget the uploaded list"
              title="Forget the uploaded list (customers already added stay)"
              onClick={async () => {
                if (!confirm("Forget the whole uploaded contact list? Customers already added are kept.")) return;
                const r = await clearContactList();
                if (!r.ok) return void toast.error(r.error);
                toast.success("List cleared");
                router.refresh();
              }}
            >
              <Trash2 className="text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      {readable.length > 0 && (
        <>
          {/* Toolbar */}
          <div className="sticky top-14 z-10 -mx-1 grid gap-2 rounded-xl border bg-background/95 p-2 shadow-xs backdrop-blur md:top-16">
            <div className="flex gap-1 overflow-x-auto">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setView(v.key)}
                  className={cn("h-8 shrink-0 rounded-md px-3 text-sm", view === v.key ? "bg-primary font-medium text-primary-foreground" : "hover:bg-muted")}
                >
                  {v.label} <span className={cn("ml-1 tabular-nums", view === v.key ? "opacity-80" : "text-muted-foreground")}>{nf(counts[v.key])}</span>
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or number…" className="h-10 pr-9 pl-9" inputMode="search" />
              {q && (
                <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted">
                  <X className="size-4" />
                </button>
              )}
            </div>
            {view !== "added" && (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setPicked((s) => new Set([...s, ...selectable.map((c) => c.id)]))} disabled={!selectable.length}>
                  Select all{query ? " shown" : ""}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())} disabled={!picked.size}>
                  Clear
                </Button>
                <span className="text-sm font-medium tabular-nums">{nf(picked.size)} selected</span>
                <span className="ml-auto flex gap-2">
                  {view === "pending" ? (
                    <Button size="sm" variant="outline" onClick={() => run("skip")} disabled={!picked.size || !!busy}>
                      {busy === "skip" && <Loader2 className="animate-spin" />} Skip
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => run("back")} disabled={!picked.size || !!busy}>
                      {busy === "back" ? <Loader2 className="animate-spin" /> : <Undo2 />} Not reviewed
                    </Button>
                  )}
                  <Button size="sm" onClick={() => run("add")} disabled={!picked.size || !!busy}>
                    {busy === "add" ? <Loader2 className="animate-spin" /> : <UserPlus />} Add selected
                  </Button>
                </span>
              </div>
            )}
          </div>

          {/* List */}
          <div className="overflow-hidden rounded-xl border bg-card">
            {list.length === 0 && (
              <p className="p-8 text-center text-sm text-muted-foreground">
                {query ? "No contact matches that search." : view === "pending" ? "All contacts reviewed 🎉" : `Nothing ${view} yet.`}
              </p>
            )}
            <ul className="divide-y">
              {list.slice(0, limit).map((c) => {
                const already = isCustomer(c);
                const disabled = already || c.status === "added";
                const custId = c.customerId ?? custOf(c);
                return (
                  <li key={c.id}>
                    <label className={cn("flex items-center gap-3 px-3 py-2.5", disabled ? "cursor-default" : "cursor-pointer hover:bg-muted/50", already && "opacity-60")}>
                      {view !== "added" && (
                        <input
                          type="checkbox"
                          className="size-5 shrink-0 accent-[var(--primary)] disabled:opacity-40"
                          checked={!disabled && picked.has(c.id)}
                          disabled={disabled}
                          onChange={() => toggle(c.id)}
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{c.name}</span>
                        <span className="block truncate font-mono text-xs text-muted-foreground">
                          {formatPhone(c.phone)}
                          {c.phone2 && <span className="opacity-75"> · {formatPhone(c.phone2)}</span>}
                        </span>
                      </span>
                      {already && custId && (
                        <Link href={`/customers/${custId}`} className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground hover:underline">
                          Already a customer
                        </Link>
                      )}
                      {c.status === "added" && custId && (
                        <Link href={`/customers/${custId}`} className="shrink-0 text-xs text-primary hover:underline">
                          Open
                        </Link>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
            {list.length > limit && (
              <div className="border-t p-3 text-center">
                <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
                  Show more · {nf(list.length - limit)} left
                </Button>
                <p className="text-[11px] text-muted-foreground">Tip: search for a name or number to find someone quickly.</p>
              </div>
            )}
          </div>
        </>
      )}

      {unreadable.length > 0 && (
        <div className="rounded-xl border bg-card">
          <button type="button" onClick={() => setShowBad((s) => !s)} className="flex w-full items-center gap-2 p-3 text-left text-sm">
            <AlertTriangle className="size-4 text-warning" />
            <span className="font-medium">Could not read ({nf(unreadable.length)})</span>
            <span className="text-xs text-muted-foreground">— not a 10-digit Indian mobile and no + country code</span>
            <ChevronDown className={cn("ml-auto size-4 transition-transform", showBad && "rotate-180")} />
          </button>
          {showBad && (
            <ul className="divide-y border-t">
              {unreadable.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="truncate">{c.name}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{c.rawPhone || "no number"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

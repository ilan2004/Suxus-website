"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, GitMerge, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mergeStaff, moveSignIn, previewStaffMerge, type UserRow } from "@/lib/actions/users";
import { ROLE_LABEL } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type Preview = Awaited<ReturnType<typeof previewStaffMerge>> extends { ok: true; data: infer D } | { ok: false } ? D : never;

/**
 * Merge two staff records for the same person: 1) copy the sign-in to the record being kept,
 * 2) sign in as that record, 3) move every reference and delete the duplicate (one transaction).
 */
export function MergeStaff({ users, meId }: { users: UserRow[]; meId: number }) {
  const router = useRouter();
  const [sourceId, setSourceId] = React.useState<number | null>(null);
  const [targetId, setTargetId] = React.useState<number | null>(null);
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ total: number; moved: { label: string; count: number }[]; name: string } | null>(null);
  const src = users.find((u) => u.id === sourceId);
  const dst = users.find((u) => u.id === targetId);
  const label = (u: UserRow) => `${u.code} · ${u.name}${u.phone ? ` · ${u.phone}` : ""}${u.role ? ` · sign-in: ${ROLE_LABEL[u.role]}` : ""}`;

  React.useEffect(() => {
    setPreview(null);
    if (!sourceId || !targetId || sourceId === targetId) return;
    previewStaffMerge({ sourceId, targetId }).then((r) => (r.ok ? setPreview(r.data) : toast.error(r.error)));
  }, [sourceId, targetId, users]);

  const step1Done = !!preview && (!preview.sourceHasLogin || preview.targetHasLogin);
  const signedInAsSource = sourceId === meId;

  return (
    <div className="grid gap-3 rounded-xl border bg-card p-5 text-sm">
      <div>
        <p className="flex items-center gap-2 font-medium">
          <GitMerge className="size-4" /> Merge duplicate staff records
        </p>
        <p className="text-muted-foreground">For one person who appears twice. Nothing changes until you press a step button.</p>
      </div>

      {result ? (
        <div className="grid gap-2 rounded-lg border border-success/40 bg-success/5 p-3">
          <p className="flex items-center gap-2 font-medium text-success">
            <CheckCircle2 className="size-4" /> Merged into {result.name} — {result.total} reference{result.total === 1 ? "" : "s"} moved, duplicate deleted.
          </p>
          {result.moved.length > 0 && (
            <ul className="grid gap-0.5 text-xs text-muted-foreground">
              {result.moved.map((m) => (
                <li key={m.label}>
                  {m.label}: {m.count}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">Remove this record (the duplicate)</span>
              <select className="h-9 rounded-md border border-input bg-card px-2" value={sourceId ?? ""} onChange={(e) => setSourceId(Number(e.target.value) || null)}>
                <option value="">Choose…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {label(u)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">Keep this record</span>
              <select className="h-9 rounded-md border border-input bg-card px-2" value={targetId ?? ""} onChange={(e) => setTargetId(Number(e.target.value) || null)}>
                <option value="">Choose…</option>
                {users
                  .filter((u) => u.id !== sourceId)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {label(u)}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          {src && dst && preview && (
            <div className="grid gap-3">
              <div className="rounded-lg bg-muted/50 p-3 text-xs">
                <p className="mb-1 font-medium text-foreground">
                  {src.code} {src.name} is used in {preview.total} place{preview.total === 1 ? "" : "s"}:
                </p>
                <ul className="grid gap-0.5 text-muted-foreground sm:grid-cols-2">
                  {preview.refs.filter((r) => r.count > 0).map((r) => (
                    <li key={r.label}>
                      {r.label}: <b className="text-foreground">{r.count}</b>
                    </li>
                  ))}
                  {preview.total === 0 && <li>Nothing refers to it.</li>}
                </ul>
              </div>

              <Step n={1} done={step1Done} title={`Move the sign-in to ${dst.code} ${dst.name}`} hint={preview.sourceHasLogin ? `${dst.name} gets ${src.name}'s role and the same PIN. ${src.name} keeps it for now, so nobody is signed out.` : `${src.name} has no sign-in — nothing to move.`}>
                {preview.sourceHasLogin && !preview.targetHasLogin && (
                  <Button
                    size="sm"
                    disabled={!!busy}
                    onClick={async () => {
                      setBusy("1");
                      const r = await moveSignIn({ sourceId: src.id, targetId: dst.id });
                      setBusy(null);
                      if (!r.ok) return void toast.error(r.error);
                      toast.success(`${r.data.name} can now sign in with the same PIN`);
                      router.refresh();
                    }}
                  >
                    {busy === "1" && <Loader2 className="animate-spin" />} Step 1: move sign-in
                  </Button>
                )}
              </Step>

              <Step n={2} done={step1Done && !signedInAsSource} title={`Sign in as ${dst.code} ${dst.name}`} hint={signedInAsSource ? `You are signed in as ${src.name}, the record being removed. Sign out, then choose “${dst.name}” on the sign-in screen and use your usual PIN. Come back here to finish.` : `You are not signed in as ${src.name} — fine.`} />

              <Step n={3} done={false} title={`Move ${preview.total} reference${preview.total === 1 ? "" : "s"} to ${dst.name} and delete ${src.code}`} hint="All in one go — if anything fails, nothing changes.">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={!!busy || !step1Done || signedInAsSource}
                  onClick={async () => {
                    if (!confirm(`Move ${preview.total} reference(s) from ${src.code} ${src.name} to ${dst.code} ${dst.name}, then delete ${src.code}? This cannot be undone.`)) return;
                    setBusy("3");
                    const r = await mergeStaff({ sourceId: src.id, targetId: dst.id });
                    setBusy(null);
                    if (!r.ok) return void toast.error(r.error);
                    setResult({ ...r.data, name: `${dst.code} ${dst.name}` });
                    router.refresh();
                  }}
                >
                  {busy === "3" && <Loader2 className="animate-spin" />} Step 3: merge and delete {src.code}
                </Button>
              </Step>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Step({ n, done, title, hint, children }: { n: number; done: boolean; title: string; hint: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-lg border p-3">
      <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold", done ? "bg-success text-white" : "bg-muted text-foreground")}>{done ? "✓" : n}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  );
}

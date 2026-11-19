"use client";

import * as React from "react";
import { Delete, Loader2 } from "lucide-react";
import { loginAction } from "./actions";
import { cn } from "@/lib/utils";

type U = { id: number; name: string; role: string };

/** PINs are 6 digits: six dots, Enter only once all six are typed. */
const PIN_LENGTH = 6;

export function LoginForm({ users }: { users: U[] }) {
  const [userId, setUserId] = React.useState<number | null>(users.length === 1 ? users[0].id : null);
  const [pin, setPin] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  const submit = React.useCallback(
    (p: string) => {
      if (!userId || p.length < PIN_LENGTH) return;
      start(async () => {
        const res = await loginAction(userId, p);
        if (res?.error) {
          setError(res.error);
          setPin("");
        }
      });
    },
    [userId],
  );

  const press = (d: string) => {
    setError(null);
    setPin((p) => (p.length >= PIN_LENGTH ? p : p + d));
  };

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // preventDefault: a keypad button focused by an earlier tap must not also fire (Enter would add that digit again)
      if (/^\d$/.test(e.key)) (e.preventDefault(), press(e.key));
      else if (e.key === "Backspace") (e.preventDefault(), setPin((p) => p.slice(0, -1)));
      else if (e.key === "Enter") (e.preventDefault(), submit(pin));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pin, submit]);

  return (
    <div className="mt-6 grid gap-6">
      <div className="grid grid-cols-2 gap-2">
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => {
              setUserId(u.id);
              setPin("");
              setError(null);
            }}
            className={cn(
              "flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:border-primary/40",
              userId === u.id && "border-primary ring-2 ring-primary/20",
            )}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
              {u.name.slice(0, 1)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{u.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{u.role}</span>
            </span>
          </button>
        ))}
      </div>

      <div className={cn("grid gap-4 transition-opacity", !userId && "pointer-events-none opacity-40")}>
        <div className="flex justify-center gap-3">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span key={i} className={cn("size-3.5 rounded-full border-2 border-primary/40", i < pin.length && "border-primary bg-primary")} />
          ))}
        </div>
        <p className={cn("h-5 text-center text-sm text-destructive", !error && "invisible")}>{error ?? "."}</p>
        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <Key key={d} onClick={() => press(d)}>
              {d}
            </Key>
          ))}
          <Key onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Delete">
            <Delete className="size-5" />
          </Key>
          <Key onClick={() => press("0")}>0</Key>
          <button
            onClick={() => submit(pin)}
            disabled={pin.length < PIN_LENGTH || pending}
            className="grid h-14 place-items-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {pending ? <Loader2 className="size-5 animate-spin" /> : "Enter"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Key(props: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className="grid h-14 place-items-center rounded-xl border bg-card font-display text-xl font-medium transition-colors hover:bg-accent active:scale-[0.97]"
    />
  );
}

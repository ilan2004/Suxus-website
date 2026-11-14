"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Building2, LogOut, Menu, Moon, Plus, Search, Sun, Scissors, ShoppingBag, UserPlus } from "lucide-react";
import { NAV, type NavItem } from "@/lib/nav";
import { Logo } from "./logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/login/actions";
import { globalSearch, type SearchHit } from "@/lib/actions/search";

type User = { name: string; role: "partner" | "staff" };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

function NavList({ user, onNavigate }: { user: User; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-5 px-3 py-4">
      {NAV.map((group) => {
        const items = group.items.filter((i) => !i.partner || user.role === "partner");
        if (!items.length) return null;
        return (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.16em] text-sidebar-muted uppercase">{group.label}</p>
            <ul className="grid gap-0.5">
              {items.map((item) => (
                <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} onNavigate={onNavigate} />
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  const inner = (
    <>
      <Icon className={cn("size-[18px] shrink-0", active ? "text-gold" : "text-sidebar-muted group-hover:text-sidebar-foreground")} />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate">{item.en}</span>
        <span className="truncate font-[family-name:var(--font-ml)] text-[10.5px] text-sidebar-muted">{item.ml}</span>
      </span>
      {item.soon && <span className="rounded bg-sidebar-border px-1.5 py-0.5 text-[9px] tracking-wide text-sidebar-muted uppercase">Soon</span>}
    </>
  );
  const cls = cn(
    "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors",
    active ? "bg-sidebar-accent font-medium text-white" : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60",
    item.soon && "pointer-events-none opacity-55",
  );
  return (
    <li>
      {item.soon ? (
        <span className={cls}>{inner}</span>
      ) : (
        <Link href={item.href} className={cls} onClick={onNavigate}>
          {inner}
        </Link>
      )}
    </li>
  );
}

function useTheme() {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  };
  return { dark, toggle };
}

function CommandPalette({ user, open, setOpen }: { user: User; open: boolean; setOpen: (o: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  React.useEffect(() => {
    if (!open) setQ("");
  }, [open]);
  React.useEffect(() => {
    if (q.trim().length < 2) return setHits([]);
    let live = true;
    const t = setTimeout(async () => {
      const r = await globalSearch(q);
      if (live) setHits(r);
    }, 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);
  const groups = hits.reduce<Record<string, SearchHit[]>>((a, h) => ((a[h.type] ??= []).push(h), a), {});
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Quick search</DialogTitle>
        <Command shouldFilter={q.trim().length < 2}>
          <CommandInput placeholder="Search customer, phone, SO- / FS- / BO- no., fabric, supplier… or a page" value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>{q.trim().length >= 2 ? "Nothing found." : "No results."}</CommandEmpty>
            {Object.entries(groups).map(([type, items]) => (
              <CommandGroup key={type} heading={type}>
                {items.map((h) => (
                  <CommandItem key={h.href} value={`${h.label} ${h.sub} ${h.href}`} onSelect={() => go(h.href)}>
                    {h.type === "Fabric" &&
                      (h.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={h.thumb} alt="" className="size-8 shrink-0 rounded object-cover" loading="lazy" />
                      ) : (
                        <span className="size-8 shrink-0 rounded bg-muted" />
                      ))}
                    <span className="truncate font-medium">{h.label}</span>
                    <span className="ml-auto truncate text-xs text-muted-foreground">{h.sub}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {q.trim().length < 2 && <CommandGroup heading="Quick actions">
              <CommandItem onSelect={() => go("/sales/new")}>
                <ShoppingBag /> New fabric sale <span className="ml">പുതിയ ബിൽ</span>
              </CommandItem>
              <CommandItem onSelect={() => go("/orders/new")}>
                <Scissors /> New stitching order <span className="ml">പുതിയ ഓർഡർ</span>
              </CommandItem>
              <CommandItem onSelect={() => go("/bulk/new")}>
                <Building2 /> New bulk / institution order
              </CommandItem>
              <CommandItem onSelect={() => go("/customers?new=1")}>
                <UserPlus /> New customer
              </CommandItem>
            </CommandGroup>}
            {q.trim().length < 2 && NAV.map((g) => (
              <CommandGroup key={g.label} heading={g.label}>
                {g.items
                  .filter((i) => !i.soon && (!i.partner || user.role === "partner"))
                  .map((i) => (
                    <CommandItem key={i.href} value={`${i.en} ${i.ml}`} onSelect={() => go(i.href)}>
                      <i.icon /> {i.en} <span className="ml">{i.ml}</span>
                    </CommandItem>
                  ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

export function Shell({ user, children }: { user: User; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [cmdOpen, setCmdOpen] = React.useState(false);
  const { dark, toggle } = useTheme();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-dvh flex-col overflow-y-auto bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-5">
          <Link href="/">
            <Logo />
          </Link>
        </div>
        <NavList user={user} />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="border-sidebar-border bg-sidebar p-0 text-sidebar-foreground" hideClose>
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="flex h-16 items-center border-b border-sidebar-border px-5">
            <Logo />
          </div>
          <NavList user={user} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-16 min-w-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu />
          </Button>
          <button
            onClick={() => setCmdOpen(true)}
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border bg-card px-3 text-sm text-muted-foreground shadow-xs hover:bg-accent/50 sm:max-w-sm"
          >
            <Search className="size-4" />
            <span className="truncate"><span className="sm:hidden">Search…</span><span className="hidden sm:inline">Search customer, SO-/FS- no., fabric…</span></span>
            <kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="gold" className="hidden sm:inline-flex">
                  <Plus /> New
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/sales/new">
                    <ShoppingBag /> Fabric sale
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/orders/new">
                    <Scissors /> Stitching order
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/bulk/new">
                    <Building2 /> Bulk order
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/customers?new=1">
                    <UserPlus /> Customer
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/cash-book">
                    <BookOpen /> Cash entry
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {dark ? <Sun /> : <Moon />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {user.name.slice(0, 1).toUpperCase()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  <span className="block text-sm font-medium text-foreground">{user.name}</span>
                  <span className="capitalize">{user.role}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <form action={logoutAction}>
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full">
                      <LogOut /> Sign out
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
      <CommandPalette user={user} open={cmdOpen} setOpen={setCmdOpen} />
    </div>
  );
}

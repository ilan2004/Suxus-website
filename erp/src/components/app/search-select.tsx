"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type Option = { value: string; label: string; sub?: string; keywords?: string[] };

/** Searchable dropdown (combobox). Optional "create new" row. */
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Type to search…",
  onCreate,
  createLabel = "Add new",
  className,
  id,
  disabled,
  allowClear,
}: {
  options: Option[];
  value: string | null | undefined;
  onChange: (value: string | null, option?: Option) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  onCreate?: (query: string) => void;
  createLabel?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  allowClear?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-50",
            className,
          )}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground/70")}>
            {selected ? (
              <>
                {selected.label}
                {selected.sub && <span className="ml-1.5 text-xs text-muted-foreground">{selected.sub}</span>}
              </>
            ) : (
              placeholder
            )}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No match.</CommandEmpty>
            <CommandGroup>
              {allowClear && value && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className="text-muted-foreground"
                >
                  Clear selection
                </CommandItem>
              )}
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.sub ?? ""} ${(o.keywords ?? []).join(" ")} ${o.value}`}
                  onSelect={() => {
                    onChange(o.value, o);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check className={cn("size-4", value === o.value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o.label}</span>
                  {o.sub && <span className="ml-auto truncate text-xs text-muted-foreground">{o.sub}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
            {onCreate && (
              <CommandGroup>
                <CommandItem
                  value={`__create__ ${query}`}
                  onSelect={() => {
                    onCreate(query);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="text-primary"
                >
                  <Plus className="!text-primary" />
                  {createLabel}
                  {query && <span className="font-medium">“{query}”</span>}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Simple list-backed select (for dropdown lists from Settings). */
export function ListSelect({
  items,
  value,
  onChange,
  placeholder,
  id,
  allowClear,
  className,
}: {
  items: string[];
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  placeholder?: string;
  id?: string;
  allowClear?: boolean;
  className?: string;
}) {
  return (
    <SearchSelect
      id={id}
      className={className}
      options={items.map((i) => ({ value: i, label: i }))}
      value={value}
      onChange={(v) => onChange(v)}
      placeholder={placeholder}
      allowClear={allowClear}
    />
  );
}

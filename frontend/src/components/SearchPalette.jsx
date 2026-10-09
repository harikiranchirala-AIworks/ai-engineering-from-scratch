import { useState, useEffect, useMemo } from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BookOpen } from "lucide-react";
import { ALL_TOPICS } from "../data/curriculum";

// Flattened, searchable index of every topic across all modules.
const INDEX = ALL_TOPICS.map((t, i) => ({
  moduleId: t.moduleId,
  moduleCode: t.moduleCode,
  moduleTitle: t.moduleTitle,
  term: t.term,
  definition: t.definition,
  section: t.section,
  gi: i,
  hay: `${t.term} ${t.definition} ${t.moduleTitle} ${t.section}`.toLowerCase(),
}));

const MAX_RESULTS = 40;

export const SearchPalette = ({ open, setOpen, onJump }) => {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [setOpen]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? INDEX.filter((i) => i.hay.includes(q)) : INDEX;
    // rank exact term-prefix matches first when searching
    if (q) {
      base.sort((a, b) => {
        const at = a.term.toLowerCase().startsWith(q) ? 0 : 1;
        const bt = b.term.toLowerCase().startsWith(q) ? 0 : 1;
        return at - bt;
      });
    }
    return base.slice(0, MAX_RESULTS);
  }, [query]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <div data-testid="search-palette">
        <DialogTitle className="sr-only">Search topics and modules</DialogTitle>
        <DialogDescription className="sr-only">
          Search across every topic and definition, then jump to its module.
        </DialogDescription>
        <CommandInput
          data-testid="search-input"
          value={query}
          onValueChange={setQuery}
          placeholder="Search 766 topics, definitions, modules..."
        />
        <CommandList className="max-h-[420px]">
          <CommandEmpty>No topics found.</CommandEmpty>
          <CommandGroup heading={query ? `${results.length} result${results.length === 1 ? "" : "s"}` : "Browse topics"}>
            {results.map((i) => (
              <CommandItem
                key={`${i.moduleId}-${i.gi}`}
                value={`${i.gi}`}
                data-testid={`search-result-${i.moduleId}-${i.gi}`}
                onSelect={() => {
                  onJump(i.moduleId);
                  setOpen(false);
                }}
                className="rounded-none border-b border-neutral-200 !py-3 cursor-pointer"
              >
                <BookOpen size={15} className="text-[#002FA7]" />
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-sm">
                    {i.term}
                    <span className="ml-2 text-xs font-normal text-neutral-400">{i.moduleCode}</span>
                  </span>
                  <span className="text-xs text-neutral-500 line-clamp-1">{i.definition}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </div>
    </CommandDialog>
  );
};

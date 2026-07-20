import { useState } from "react";
import { ChevronDown, Plus, Copy, Pencil, Trash2, LayoutDashboard } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import type { DashboardLayout } from "@/lib/dashboardLayout";

type PromptKind = "create" | "rename" | "duplicate" | null;

export function LayoutSwitcher({
  layouts, activeLayout, onSelect, onCreate, onRename, onDuplicate, onDelete,
}: {
  layouts: DashboardLayout[];
  activeLayout: DashboardLayout;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [prompt, setPrompt] = useState<PromptKind>(null);
  const [draftName, setDraftName] = useState("");

  const openPrompt = (kind: PromptKind, initial = "") => {
    setDraftName(initial);
    setPrompt(kind);
  };

  const submitPrompt = () => {
    const name = draftName.trim();
    if (!name) return;
    if (prompt === "create") onCreate(name);
    if (prompt === "rename") onRename(activeLayout.id, name);
    if (prompt === "duplicate") onDuplicate(activeLayout.id, name);
    setPrompt(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground hover:bg-accent transition-colors">
            <LayoutDashboard className="w-3.5 h-3.5" />
            {activeLayout.name}
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Layouts</DropdownMenuLabel>
          {layouts.map((l) => (
            <DropdownMenuItem key={l.id} onClick={() => onSelect(l.id)} className="justify-between">
              <span className={l.id === activeLayout.id ? "font-bold text-primary" : ""}>{l.name}</span>
              {l.builtIn && <span className="text-[10px] text-muted-foreground">Preset</span>}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openPrompt("create", "My Dashboard")}>
            <Plus className="w-3.5 h-3.5" /> New layout
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openPrompt("duplicate", `${activeLayout.name} copy`)}>
            <Copy className="w-3.5 h-3.5" /> Duplicate current
          </DropdownMenuItem>
          {!activeLayout.builtIn && (
            <>
              <DropdownMenuItem onClick={() => openPrompt("rename", activeLayout.name)}>
                <Pencil className="w-3.5 h-3.5" /> Rename current
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(activeLayout.id)} className="text-red-500 focus:text-red-500">
                <Trash2 className="w-3.5 h-3.5" /> Delete current
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={prompt !== null} onOpenChange={(open) => !open && setPrompt(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {prompt === "create" && "New layout"}
              {prompt === "rename" && "Rename layout"}
              {prompt === "duplicate" && "Duplicate layout"}
            </DialogTitle>
          </DialogHeader>
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitPrompt()}
            placeholder="Layout name"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <DialogFooter>
            <DialogClose asChild>
              <button className="px-3 py-1.5 rounded-lg border border-border text-xs font-bold hover:bg-accent">Cancel</button>
            </DialogClose>
            <button onClick={submitPrompt} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90">
              Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

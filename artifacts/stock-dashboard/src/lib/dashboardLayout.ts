import { useCallback, useEffect, useState } from "react";
import { generateId } from "@/lib/utils";

export type WidgetId = "ai-decision" | "alerts" | "gift-nifty" | "movers-sectors" | "global-markets";

export interface WidgetMeta {
  id: WidgetId;
  title: string;
}

/** Every widget the General Dashboard can show. Add a widget by adding one entry here. */
export const WIDGETS: WidgetMeta[] = [
  { id: "ai-decision",     title: "AI Decision Panel" },
  { id: "alerts",          title: "Alert System" },
  { id: "gift-nifty",      title: "Gift Nifty Chart" },
  { id: "movers-sectors",  title: "Market Movers & Sectors" },
  { id: "global-markets",  title: "Global Markets" },
];

export interface WidgetConfig {
  id: WidgetId;
  visible: boolean;
}

export interface DashboardLayout {
  id: string;
  name: string;
  /** Order matters — this is the display order. */
  widgets: WidgetConfig[];
  /** Built-in presets can't be renamed or deleted, only duplicated into a custom copy. */
  builtIn?: boolean;
}

const DEFAULT_ORDER: WidgetId[] = ["ai-decision", "alerts", "gift-nifty", "movers-sectors", "global-markets"];

function allVisible(order: WidgetId[]): WidgetConfig[] {
  return order.map((id) => ({ id, visible: true }));
}

export const BUILT_IN_LAYOUTS: DashboardLayout[] = [
  {
    id: "default",
    name: "Full Overview",
    builtIn: true,
    widgets: allVisible(DEFAULT_ORDER),
  },
  {
    id: "trading-focus",
    name: "Trading Focus",
    builtIn: true,
    widgets: [
      { id: "ai-decision", visible: true },
      { id: "alerts", visible: true },
      { id: "gift-nifty", visible: true },
      { id: "movers-sectors", visible: false },
      { id: "global-markets", visible: false },
    ],
  },
  {
    id: "minimal",
    name: "Minimal",
    builtIn: true,
    widgets: [
      { id: "ai-decision", visible: true },
      { id: "movers-sectors", visible: true },
      { id: "alerts", visible: false },
      { id: "gift-nifty", visible: false },
      { id: "global-markets", visible: false },
    ],
  },
];

const STORAGE_KEY = "mp-dashboard-layouts";
const ACTIVE_KEY = "mp-dashboard-active-layout";

interface StoredState {
  customLayouts: DashboardLayout[];
}

function loadStored(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredState;
      if (Array.isArray(parsed.customLayouts)) return parsed;
    }
  } catch { /* ignore malformed storage */ }
  return { customLayouts: [] };
}

function loadActiveId(): string {
  try {
    return localStorage.getItem(ACTIVE_KEY) ?? "default";
  } catch {
    return "default";
  }
}

/**
 * Manages the General Dashboard's saved layouts. Persisted to localStorage
 * today; shaped so a backend-synced version (per-account layouts) can swap
 * in later without changing any consumer of this hook.
 */
export function useDashboardLayouts() {
  const [customLayouts, setCustomLayouts] = useState<DashboardLayout[]>(() => loadStored().customLayouts);
  const [activeLayoutId, setActiveLayoutIdState] = useState<string>(() => loadActiveId());
  const [isLoading] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ customLayouts }));
    } catch { /* ignore quota errors */ }
  }, [customLayouts]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_KEY, activeLayoutId);
    } catch { /* ignore quota errors */ }
  }, [activeLayoutId]);

  const layouts = [...BUILT_IN_LAYOUTS, ...customLayouts];
  const activeLayout = layouts.find((l) => l.id === activeLayoutId) ?? BUILT_IN_LAYOUTS[0];

  const setActiveLayoutId = useCallback((id: string) => setActiveLayoutIdState(id), []);

  const updateActiveWidgets = useCallback((updater: (widgets: WidgetConfig[]) => WidgetConfig[]) => {
    setCustomLayouts((prev) => {
      const isCustom = prev.some((l) => l.id === activeLayoutId);
      if (isCustom) {
        return prev.map((l) => (l.id === activeLayoutId ? { ...l, widgets: updater(l.widgets) } : l));
      }
      // Editing a built-in preset forks it into a custom layout so the
      // shipped presets always stay available in their original form.
      const builtIn = BUILT_IN_LAYOUTS.find((l) => l.id === activeLayoutId);
      if (!builtIn) return prev;
      const forked: DashboardLayout = {
        id: generateId(),
        name: `${builtIn.name} (Custom)`,
        widgets: updater(builtIn.widgets),
      };
      setActiveLayoutIdState(forked.id);
      return [...prev, forked];
    });
  }, [activeLayoutId]);

  /**
   * `newVisibleOrder` is just the visible subset in its new drag order.
   * Hidden widgets keep their existing array position — only the visible
   * ones get shuffled into place — so hiding never leaks into reordering.
   */
  const reorderWidgets = useCallback((newVisibleOrder: WidgetId[]) => {
    updateActiveWidgets((widgets) => {
      const byId = new Map(widgets.map((w) => [w.id, w]));
      const visibleQueue = newVisibleOrder.map((id) => byId.get(id)!).filter(Boolean);
      let i = 0;
      return widgets.map((w) => (w.visible ? visibleQueue[i++] : w));
    });
  }, [updateActiveWidgets]);

  const toggleWidgetVisibility = useCallback((id: WidgetId) => {
    updateActiveWidgets((widgets) => widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)));
  }, [updateActiveWidgets]);

  const createLayout = useCallback((name: string) => {
    const layout: DashboardLayout = { id: generateId(), name, widgets: allVisible(DEFAULT_ORDER) };
    setCustomLayouts((prev) => [...prev, layout]);
    setActiveLayoutIdState(layout.id);
  }, []);

  const duplicateLayout = useCallback((sourceId: string, name: string) => {
    const source = layouts.find((l) => l.id === sourceId);
    if (!source) return;
    const layout: DashboardLayout = { id: generateId(), name, widgets: source.widgets.map((w) => ({ ...w })) };
    setCustomLayouts((prev) => [...prev, layout]);
    setActiveLayoutIdState(layout.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layouts]);

  const renameLayout = useCallback((id: string, name: string) => {
    setCustomLayouts((prev) => prev.map((l) => (l.id === id ? { ...l, name } : l)));
  }, []);

  const deleteLayout = useCallback((id: string) => {
    setCustomLayouts((prev) => prev.filter((l) => l.id !== id));
    setActiveLayoutIdState((current) => (current === id ? "default" : current));
  }, []);

  const resetActiveToDefault = useCallback(() => {
    if (BUILT_IN_LAYOUTS.some((l) => l.id === activeLayoutId)) {
      // Already a built-in preset — nothing to reset, just re-select "Full Overview".
      setActiveLayoutIdState("default");
      return;
    }
    setCustomLayouts((prev) => prev.map((l) => (l.id === activeLayoutId ? { ...l, widgets: allVisible(DEFAULT_ORDER) } : l)));
  }, [activeLayoutId]);

  return {
    layouts,
    activeLayout,
    activeLayoutId,
    isLoading,
    setActiveLayoutId,
    reorderWidgets,
    toggleWidgetVisibility,
    createLayout,
    duplicateLayout,
    renameLayout,
    deleteLayout,
    resetActiveToDefault,
  };
}

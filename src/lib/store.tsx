import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { demoData } from "./demo";
import {
  editableSchemas,
  daySchema,
  defaults,
  type Settings,
  type Entry,
  type Kind,
  type DataByKind,
  type EditableKind,
} from "./domain";
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    credentials: "same-origin",
    cache: "no-store",
  });
  const result = (await response.json()) as {
    error?: string | { message?: string };
    message?: string;
  };
  if (!response.ok)
    throw new Error(
      (typeof result.error === "object"
        ? result.error.message
        : result.error) ||
        result.message ||
        "Request failed",
    );
  return result as T;
}
type Store = {
  demo: boolean;
  settings: Settings;
  entries: Entry[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  save: <K extends EditableKind>(
    kind: K,
    date: string,
    data: DataByKind[K],
    id?: string,
    requestId?: string,
  ) => Promise<Entry>;
  remove: (id: string) => Promise<void>;
  saveSettings: (value: Settings) => Promise<void>;
  loadMore: (kind: Kind) => Promise<void>;
  hasMore: (kind: Kind) => boolean;
  reset: () => void;
};
const Context = createContext<Store | null>(null);
const kinds: Kind[] = [
  "meal",
  "recipe",
  "weight",
  "water",
  "measurement",
  "plan",
  "session",
  "wellness",
  "activity",
];
export function DataProvider({
  demo,
  children,
}: {
  demo: boolean;
  children: ReactNode;
}) {
  const [initial] = useState(() =>
    demo ? demoData() : { settings: defaults, entries: [] },
  );
  const [settings, setSettings] = useState(initial.settings);
  const [entries, setEntries] = useState<Entry[]>(initial.entries);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  const [cursors, setCursors] = useState<Partial<Record<Kind, string | null>>>(
    {},
  );
  const refresh = useCallback(async () => {
    if (demo) return;
    setLoading(true);
    setError("");
    try {
      const [profile, ...pages] = await Promise.all([
        api<Settings>("/settings"),
        ...kinds.map((kind) =>
          api<{ items: Entry[]; cursor: string | null }>(
            `/records?kind=${kind}&limit=200`,
          ),
        ),
      ]);
      setSettings(profile as Settings);
      const list = pages as { items: Entry[]; cursor: string | null }[];
      setEntries(list.flatMap((p) => p.items));
      setCursors(Object.fromEntries(kinds.map((k, i) => [k, list[i].cursor])));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [demo]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  async function save<K extends EditableKind>(
    kind: K,
    date: string,
    data: DataByKind[K],
    id?: string,
    requestId: string = crypto.randomUUID(),
  ): Promise<Entry> {
    daySchema.parse(date);
    editableSchemas[kind].parse(data);
    const old = entries.find((e) => e.id === id);
    const now = new Date().toISOString();
    const entry: Entry = demo
      ? {
          id: id || crypto.randomUUID(),
          kind,
          date,
          data,
          createdAt: old?.createdAt || now,
          updatedAt: now,
        }
      : await api<Entry>(id ? `/records/${id}` : "/records", {
          method: id ? "PUT" : "POST",
          body: JSON.stringify(
            id
              ? { date, data, updatedAt: old?.updatedAt }
              : { kind, date, data, requestId },
          ),
        });
    setEntries((all) => [entry, ...all.filter((e) => e.id !== entry.id)]);
    return entry;
  }
  async function remove(id: string) {
    if (!demo) await api(`/records/${id}`, { method: "DELETE" });
    setEntries((all) => all.filter((e) => e.id !== id));
  }
  async function saveSettings(value: Settings) {
    if (!demo)
      await api("/settings", { method: "PUT", body: JSON.stringify(value) });
    setSettings(value);
  }
  async function loadMore(kind: Kind) {
    const cursor = cursors[kind];
    if (!cursor || demo) return;
    const page = await api<{ items: Entry[]; cursor: string | null }>(
      `/records?kind=${kind}&limit=200&cursor=${encodeURIComponent(cursor)}`,
    );
    setEntries((all) => [
      ...all,
      ...page.items.filter((p) => !all.some((e) => e.id === p.id)),
    ]);
    setCursors((all) => ({ ...all, [kind]: page.cursor }));
  }
  return (
    <Context.Provider
      value={{
        demo,
        settings,
        entries,
        loading,
        error,
        refresh,
        save,
        remove,
        saveSettings,
        loadMore,
        hasMore: (kind) => !!cursors[kind],
        reset: () => {
          const next = demoData();
          setSettings(next.settings);
          setEntries(next.entries);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useData() {
  const value = useContext(Context);
  if (!value) throw new Error("Data context missing");
  return value;
}
export function useEntries<K extends Kind>(kind: K) {
  return useData()
    .entries.filter((e) => e.kind === kind)
    .sort((a, b) => b.date.localeCompare(a.date)) as Entry<K>[];
}

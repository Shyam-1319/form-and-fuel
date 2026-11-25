import { totals, type Entry } from "./domain";
export type Aggregate = {
  period: string;
  kind: string;
  entries: number;
  loggedDays: number;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  weightKg: number | null;
  waterMl: number | null;
  sleepSeconds: number | null;
  steps: number | null;
  restingHR: number | null;
  rmssd: number | null;
  sdnn: number | null;
};
export function demoAggregate(
  entries: Entry[],
  from: string,
  to: string,
  monthly: boolean,
): Aggregate[] {
  const groups = new Map<string, Entry[]>();
  for (const e of entries.filter((e) => e.date >= from && e.date <= to)) {
    const key = `${monthly ? e.date.slice(0, 7) : e.date}|${e.kind}`;
    groups.set(key, [...(groups.get(key) || []), e]);
  }
  return [...groups]
    .map(([key, items]) => {
      const [period, kind] = key.split("|");
      const a: Aggregate = {
        period,
        kind,
        entries: items.length,
        loggedDays: new Set(items.map((i) => i.date)).size,
        calories: null,
        protein: null,
        carbs: null,
        fat: null,
        fiber: null,
        weightKg: null,
        waterMl: null,
        sleepSeconds: null,
        steps: null,
        restingHR: null,
        rmssd: null,
        sdnn: null,
      };
      if (kind === "meal")
        Object.assign(
          a,
          totals((items as Entry<"meal">[]).flatMap((i) => i.data.foods)),
        );
      if (kind === "weight")
        a.weightKg =
          (items as Entry<"weight">[]).reduce((s, i) => s + i.data.kg, 0) /
          items.length;
      if (kind === "water")
        a.waterMl = (items as Entry<"water">[]).reduce(
          (s, i) => s + i.data.ml,
          0,
        );
      if (kind === "wellness") {
        for (const field of ["sleepSeconds", "steps", "restingHR"] as const) {
          const values = (items as Entry<"wellness">[])
            .map((i) => i.data[field])
            .filter((v) => v !== null);
          a[field] = values.length
            ? values.reduce((s, v) => s + v, 0) / values.length
            : null;
        }
        for (const [key, type] of [
          ["rmssd", "rMSSD"],
          ["sdnn", "SDNN"],
        ] as const) {
          const values = (items as Entry<"wellness">[]).flatMap((i) =>
            i.data.hrv.filter((h) => h.type === type).map((h) => h.value),
          );
          a[key] = values.length
            ? values.reduce((s, v) => s + v, 0) / values.length
            : null;
        }
      }
      return a;
    })
    .sort((a, b) => a.period.localeCompare(b.period));
}

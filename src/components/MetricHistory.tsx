import { useEffect, useState } from "react";
import { useData, api } from "../lib/store";
import { addDays, dayInZone, daySchema } from "../lib/domain";
import { demoAggregate, type Aggregate } from "../lib/progress";
import { Chart, Field, Modal, fmt } from "./ui";

export const historyMetrics = {
  calories: {
    label: "Calories",
    kind: "meal",
    field: "calories",
    unit: "kcal",
    divisor: 1,
  },
  protein: {
    label: "Protein",
    kind: "meal",
    field: "protein",
    unit: "g",
    divisor: 1,
  },
  water: {
    label: "Water",
    kind: "water",
    field: "waterMl",
    unit: "L",
    divisor: 1000,
  },
  sleep: {
    label: "Sleep",
    kind: "wellness",
    field: "sleepSeconds",
    unit: "hrs",
    divisor: 3600,
  },
} as const;
export type HistoryMetric = keyof typeof historyMetrics;

export function MetricHistory({
  metric,
  onClose,
}: {
  metric: HistoryMetric;
  onClose: () => void;
}) {
  const { demo, entries, settings } = useData();
  const today = dayInZone(new Date(), settings.timezone);
  const [end, setEnd] = useState(today);
  const [result, setResult] = useState<{
    end: string;
    rows: Aggregate[];
  } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const valid =
    daySchema.safeParse(end).success && end <= today && end >= "1900-01-07";
  const start = valid ? addDays(end, -6) : "";
  const config = historyMetrics[metric];
  useEffect(() => {
    let alive = true;
    setError("");
    if (!valid) return;
    if (demo) {
      setResult({ end, rows: demoAggregate(entries, start, end, false) });
      return;
    }
    void api<Aggregate[]>(`/progress?from=${start}&to=${end}&group=day`)
      .then((rows) => {
        if (alive) setResult({ end, rows });
      })
      .catch((e) => {
        if (alive) {
          setResult(null);
          setError(e.message);
        }
      });
    return () => {
      alive = false;
    };
  }, [demo, entries, end, start, valid, retry]);
  const ready = valid && result?.end === end && !error;
  const points = ready
    ? Array.from({ length: 7 }, (_, i) => {
        const date = addDays(start, i);
        const row = result.rows.find(
          (row) => row.period === date && row.kind === config.kind,
        );
        const raw = row?.[config.field];
        return {
          label: date,
          value: raw == null ? null : raw / config.divisor,
        };
      })
    : [];
  return (
    <Modal title={`${config.label} history`} onClose={onClose}>
      <p>
        Daily records in {settings.timezone}. Choose a week to review previous
        days.
      </p>
      <Field label="Week ending">
        <input
          type="date"
          min="1900-01-07"
          max={today}
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </Field>
      <div className="split">
        <button
          className="button secondary"
          disabled={!valid || start <= "1900-01-07"}
          onClick={() => setEnd(addDays(end, -7))}
        >
          Previous week
        </button>
        <button
          className="button secondary"
          disabled={!valid || end >= today}
          onClick={() =>
            setEnd(addDays(end, 7) > today ? today : addDays(end, 7))
          }
        >
          Next week
        </button>
        <button className="text-button" onClick={() => setEnd(today)}>
          This week
        </button>
      </div>
      {!valid && <p role="alert">Choose a valid date on or before today.</p>}
      {valid && !ready && !error && <p role="status">Loading history…</p>}
      {error && (
        <>
          <p role="alert">Could not load history: {error}</p>
          <button
            className="button secondary"
            onClick={() => setRetry(retry + 1)}
          >
            Try again
          </button>
        </>
      )}
      {ready && (
        <>
          <p>
            {start} to {end}
          </p>
          <Chart
            points={points}
            label={`Daily ${config.label.toLowerCase()}`}
            unit={` ${config.unit}`}
          />
          <div className="table-wrap">
            <table aria-label={`${config.label} daily history`}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>
                    {config.label} ({config.unit})
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...points].reverse().map((point) => (
                  <tr key={point.label}>
                    <td>{point.label}</td>
                    <td>
                      {point.value === null
                        ? "Not recorded"
                        : `${fmt(point.value, 2)} ${config.unit}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {points.every((point) => point.value === null) && (
            <p>No {config.label.toLowerCase()} recorded for this week.</p>
          )}
          <p className="small muted">
            {metric === "sleep"
              ? "Sleep uses the wearable source date. Connect and sync your wearable to import sleep history."
              : "Daily totals include saved entries only."}{" "}
            Missing records are unknown, not zero.
          </p>
        </>
      )}
    </Modal>
  );
}

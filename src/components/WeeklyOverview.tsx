import { useEffect, useState } from "react";
import { useData, api } from "../lib/store";
import { addDays, dayInZone, daySchema, kgToLb } from "../lib/domain";
import { demoAggregate, type Aggregate } from "../lib/progress";
import { Card, Field, fmt } from "./ui";

export function WeeklyOverview() {
  const { settings, demo, entries } = useData();
  const today = dayInZone(new Date(), settings.timezone);
  const [end, setEnd] = useState(today);
  const [result, setResult] = useState<{
    end: string;
    rows: Aggregate[];
  } | null>(null);
  const [error, setError] = useState("");
  const valid =
    daySchema.safeParse(end).success && end >= "1900-01-07" && end <= today;
  const start = valid ? addDays(end, -6) : "";
  useEffect(() => {
    let active = true;
    setError("");
    if (!valid) return;
    if (demo) {
      setResult({ end, rows: demoAggregate(entries, start, end, false) });
      return;
    }
    void api<Aggregate[]>(`/progress?from=${start}&to=${end}&group=day`)
      .then((rows) => {
        if (active) setResult({ end, rows });
      })
      .catch((e) => {
        if (active) {
          setResult(null);
          setError(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, [demo, entries, end, start, valid]);
  const ready = valid && result?.end === end && !error;
  const rows = ready ? result.rows : [];
  const nutrition = rows.filter((r) => r.kind === "meal");
  const weights = rows
    .filter((r) => r.kind === "weight" && r.weightKg !== null)
    .sort((a, b) => a.period.localeCompare(b.period));
  const first = weights[0],
    last = weights.at(-1);
  const unit = settings.units === "metric" ? "kg" : "lb";
  const weight = (kg: number) =>
    settings.units === "metric" ? kg : kgToLb(kg);
  const delta =
    first && last && first.period !== last.period
      ? weight(last.weightKg! - first.weightKg!)
      : null;
  const sum = (field: "calories" | "protein") =>
    nutrition.reduce((s, r) => s + (r[field] ?? 0), 0);
  const sessions = rows
    .filter((r) => r.kind === "session")
    .reduce((s, r) => s + r.entries, 0);
  return (
    <Card>
      <h2>Weekly overview</h2>
      <div className="toolbar">
        <Field label="Overview week ending">
          <input
            type="date"
            min="1900-01-07"
            max={today}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </Field>
        <button
          className="button secondary"
          disabled={!valid || start <= "1900-01-07"}
          onClick={() => setEnd(addDays(end, -7))}
        >
          Earlier week
        </button>
        <button
          className="button secondary"
          disabled={!valid || end >= today}
          onClick={() =>
            setEnd(addDays(end, 7) > today ? today : addDays(end, 7))
          }
        >
          Later week
        </button>
        <button className="text-button" onClick={() => setEnd(today)}>
          Current week
        </button>
      </div>
      {!valid && <p role="alert">Choose a date on or before today.</p>}
      {error && <p role="alert">Could not load weekly overview: {error}</p>}
      {valid && !ready && !error && (
        <p role="status">Loading weekly overview…</p>
      )}
      {ready && (
        <>
          <p>
            {start} to {end} · {settings.timezone}
          </p>
          <div className="exercise-progress-stats">
            <div>
              <span>Calories per logged day</span>
              <strong>
                {nutrition.length
                  ? `${fmt(sum("calories") / nutrition.length)} kcal`
                  : "Not recorded"}
              </strong>
              <small>{nutrition.length} of 7 days logged</small>
            </div>
            <div>
              <span>Protein per logged day</span>
              <strong>
                {nutrition.length
                  ? `${fmt(sum("protein") / nutrition.length, 1)} g`
                  : "Not recorded"}
              </strong>
              <small>Average across days with meals</small>
            </div>
            <div>
              <span>Weight change within week</span>
              <strong>
                {delta === null
                  ? "Not enough data"
                  : `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${fmt(Math.abs(delta), 2)} ${unit}`}
              </strong>
              <small>
                {first && last
                  ? `${fmt(weight(first.weightKg!), 1)} to ${fmt(weight(last.weightKg!), 1)} ${unit} · ${weights.length} days weighed`
                  : "Log weight on two different days"}
              </small>
            </div>
            <div>
              <span>Completed workouts</span>
              <strong>{sessions}</strong>
              <small>
                Saved sessions; wearable activities appear in Health
              </small>
            </div>
          </div>
          <div className="table-wrap">
            <table aria-label="Weekly daily overview">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Calories</th>
                  <th>Protein</th>
                  <th>Weight ({unit})</th>
                  <th>Workouts</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 7 }, (_, i) => {
                  const date = addDays(start, i),
                    meal = rows.find(
                      (r) => r.period === date && r.kind === "meal",
                    ),
                    weigh = rows.find(
                      (r) => r.period === date && r.kind === "weight",
                    ),
                    session = rows.find(
                      (r) => r.period === date && r.kind === "session",
                    );
                  return (
                    <tr key={date}>
                      <td>{date}</td>
                      <td>{meal ? fmt(meal.calories) : "Not recorded"}</td>
                      <td>
                        {meal ? fmt(meal.protein, 1) + " g" : "Not recorded"}
                      </td>
                      <td>
                        {weigh?.weightKg != null
                          ? fmt(weight(weigh.weightKg), 1)
                          : "Not recorded"}
                      </td>
                      <td>{session?.entries ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="small muted">
            Missing nutrition days are excluded from averages. Weight compares
            the mean recorded weight on the first and last weighed days. Logged
            meals may represent only part of a day.
          </p>
        </>
      )}
    </Card>
  );
}

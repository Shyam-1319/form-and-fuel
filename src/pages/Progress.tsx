import { demoAggregate, type Aggregate } from "../lib/progress";
import { WeeklyOverview } from "../components/WeeklyOverview";
import { BodyMap } from "../components/BodyMap";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useData, api } from "../lib/store";
import { dayInZone, addDays } from "../lib/domain";
import { Heading, Card, Chart, Field, Action, fmt } from "../components/ui";
export function Progress() {
  const { settings, demo, entries } = useData();
  const today = dayInZone(new Date(), settings.timezone);
  const [range, setRange] = useState("30");
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<Aggregate[]>([]);
  const [error, setError] = useState("");
  const [review, setReview] = useState("");
  const [consent, setConsent] = useState(false);
  const [reviewId] = useState(crypto.randomUUID());
  const monthly =
    from < "1901-01-01" || (Date.parse(to) - Date.parse(from)) / 86400000 > 90;
  useEffect(() => {
    let alive = true;
    setError("");
    if (demo) {
      setRows(demoAggregate(entries, from, to, monthly));
      return;
    }
    void api<Aggregate[]>(
      `/progress?from=${from}&to=${to}&group=${monthly ? "month" : "day"}`,
    )
      .then((r) => {
        if (alive) setRows(r);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [demo, entries, from, to, monthly]);
  const charts: [string, string, keyof Aggregate, string, number][] = [
    ["Nutrition · calories", "meal", "calories", " kcal", 1],
    ["Protein", "meal", "protein", " g", 1],
    ["Carbohydrates", "meal", "carbs", " g", 1],
    ["Fat", "meal", "fat", " g", 1],
    ["Fiber", "meal", "fiber", " g", 1],
    ["Weight", "weight", "weightKg", " kg", 1],
    ["Water", "water", "waterMl", " ml", 1],
    ["Sleep", "wellness", "sleepSeconds", " h", 1 / 3600],
    ["Steps", "wellness", "steps", " steps", 1],
    ["Resting heart rate", "wellness", "restingHR", " bpm", 1],
    ["HRV · rMSSD", "wellness", "rmssd", " ms", 1],
    ["HRV · SDNN", "wellness", "sdnn", " ms", 1],
    ["Completed sessions", "session", "entries", " sessions", 1],
  ];
  return (
    <>
      <Heading
        eyebrow="THE LONGER VIEW"
        title="Your story, over time."
        description="Notice patterns in the days you’ve recorded. Leave room for the days you haven’t."
      />
      <WeeklyOverview />
      <Card>
        <div className="toolbar">
          <Field label="Date range">
            <select
              value={range}
              onChange={(e) => {
                setRange(e.target.value);
                if (e.target.value !== "custom") {
                  setTo(today);
                  setFrom(
                    e.target.value === "all"
                      ? "1900-01-01"
                      : addDays(today, 1 - Number(e.target.value)),
                  );
                }
              }}
            >
              {[
                ["7", "7 days"],
                ["30", "30 days"],
                ["90", "3 months"],
                ["180", "6 months"],
                ["365", "1 year"],
                ["all", "All time"],
                ["custom", "Custom range"],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From">
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setRange("custom");
              }}
            />
          </Field>
          <Field label="Through">
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setRange("custom");
              }}
            />
          </Field>
        </div>
        <p className="small muted">
          {monthly ? "Monthly" : "Daily"} groups. Nutrition and water display
          totals divided by days with that kind of log. Weight and wellness
          average recorded values only. Missing days are excluded, not treated
          as zero. Daily entries may be incomplete.
        </p>
      </Card>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="two-column">
        {charts.map(([label, kind, field, unit, factor]) => {
          const series = rows.filter((r) => r.kind === kind);
          return (
            <Card key={label}>
              <div className="section-heading">
                <h2>{label}</h2>
                <span className="pill">{monthly ? "Monthly" : "Daily"}</span>
              </div>
              <Chart
                label={label}
                unit={unit}
                points={series.map((r) => ({
                  label: r.period.slice(5) || r.period,
                  value:
                    r[field] == null
                      ? null
                      : (Number(r[field]) * factor) /
                        (["meal", "water"].includes(kind) ? r.loggedDays : 1),
                }))}
              />
              <details>
                <summary>Accessible data table</summary>
                <table>
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Value</th>
                      <th>Logged days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {series.map((r) => (
                      <tr key={r.period}>
                        <td>{r.period}</td>
                        <td>
                          {r[field] == null
                            ? "Not recorded"
                            : fmt(
                                (Number(r[field]) * factor) /
                                  (["meal", "water"].includes(kind)
                                    ? r.loggedDays
                                    : 1),
                                1,
                              ) + unit}
                        </td>
                        <td>{r.loggedDays}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </Card>
          );
        })}
      </div>
      <BodyMap />
      <Card>
        <h2>
          <Sparkles size={19} /> A weekly reflection
        </h2>
        <p className="muted">
          An optional review of your last seven days. It uses a bounded
          selection of relevant saved data and identifies missing information.
          It does not diagnose, prove causes, or change targets.
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          {demo
            ? "Show a fictional simulated review"
            : "Send relevant recent records to Groq for this review"}
        </label>
        <Action
          disabled={!consent}
          onClick={async () => {
            if (demo)
              setReview(
                "Simulated review — fictional data. You recorded meals on most days, with a regular training routine. Sleep and body measurements have gaps. These observations do not establish causes or indicate medical conditions.",
              );
            else {
              const r = await api<{ review: string; limitations: string }>(
                "/ai",
                {
                  method: "POST",
                  body: JSON.stringify({
                    kind: "review",
                    requestId: reviewId,
                    consent,
                  }),
                },
              );
              setReview(`${r.review}\n\nLimitations: ${r.limitations}`);
            }
          }}
        >
          Generate a review
        </Action>
        {review && (
          <div className="notice whitespace">
            {review}
            <p className="small">
              This review is temporary and has not been saved.
            </p>
          </div>
        )}
      </Card>
    </>
  );
}

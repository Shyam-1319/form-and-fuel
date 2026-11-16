import { useState } from "react";
import { useEntries, useData } from "../lib/store";
import {
  Heading,
  Card,
  Stat,
  Chart,
  fmt,
  Action,
  Empty,
} from "../components/ui";
import { LogEditor } from "./Today";
import { kgToLb, type Entry } from "../lib/domain";
export function Health() {
  const { settings, remove, loadMore, hasMore } = useData();
  const wellness = useEntries("wellness"),
    activities = useEntries("activity"),
    weights = useEntries("weight"),
    water = useEntries("water"),
    sessions = useEntries("session");
  const [edit, setEdit] = useState<{
    kind: "weight" | "water";
    entry?: Entry<"weight"> | Entry<"water">;
  } | null>(null);
  const latest = wellness[0];
  const points = [...wellness].reverse().slice(-14);
  const linked = new Set(
    sessions.map((s) => s.data.activityId).filter(Boolean),
  );
  const count =
    sessions.length + activities.filter((a) => !linked.has(a.id)).length;
  return (
    <>
      <Heading
        eyebrow="LISTEN TO YOUR RHYTHM"
        title="A fuller picture of recovery."
        description="Only recorded values. No invented scores, no automatic target changes."
      />
      <div className="stats-grid">
        <Stat
          label="Sleep duration"
          value={
            latest?.data.sleepSeconds == null
              ? "—"
              : fmt(latest.data.sleepSeconds / 3600, 1)
          }
          unit="hrs"
          detail={latest ? `Source date · ${latest.date}` : undefined}
        />
        <Stat
          label="Daily steps"
          value={fmt(latest?.data.steps)}
          detail={latest ? `Source date · ${latest.date}` : undefined}
        />
        <Stat
          label="Resting heart rate"
          value={fmt(latest?.data.restingHR)}
          unit="bpm"
          detail={latest ? `Source date · ${latest.date}` : undefined}
        />
        <Stat
          label="Recorded workouts"
          value={count || "—"}
          detail="Loaded sessions + unlinked wearable activities"
        />
      </div>
      <div className="two-column">
        <Card>
          <h2>Sleep, over time</h2>
          <Chart
            points={points.map((e) => ({
              label: e.date.slice(5),
              value:
                e.data.sleepSeconds == null ? null : e.data.sleepSeconds / 3600,
            }))}
            label="Recorded sleep"
            unit=" h"
          />
          {latest?.data.sleepScore != null && (
            <p>
              Source sleep score: {latest.data.sleepScore} · {latest.date}
            </p>
          )}
          <p className="small muted">
            Sleep timing and stages are unavailable when the provider does not
            supply them.
          </p>
        </Card>
        <Card>
          <h2>Heart rate variability</h2>
          {(["rMSSD", "SDNN"] as const).map((type) => (
            <div key={type}>
              <h3>
                {type} <small>· ms</small>
              </h3>
              <Chart
                points={points.map((e) => ({
                  label: e.date.slice(5),
                  value: e.data.hrv.find((h) => h.type === type)?.value ?? null,
                }))}
                label={`${type} observations`}
                unit=" ms"
              />
            </div>
          ))}
          <p className="small muted">
            rMSSD and SDNN are separate measurements, not interchangeable
            scores.
          </p>
        </Card>
        <Card>
          <h2>Steps & daily movement</h2>
          <Chart
            points={points.map((e) => ({
              label: e.date.slice(5),
              value: e.data.steps,
            }))}
            label="Recorded steps"
          />
          <p className="small muted">
            A missing count means unknown. A recorded zero remains zero.
          </p>
        </Card>
        <Card>
          <h2>Energy, with context</h2>
          <div className="rhythm-row">
            <span>Workout calories</span>
            <strong>
              {activities.some((a) => a.data.workoutCalories != null)
                ? `${fmt(activities.reduce((s, a) => s + (a.data.workoutCalories || 0), 0))} kcal`
                : "Not recorded"}
            </strong>
          </div>
          <div className="rhythm-row">
            <span>Daily active calories</span>
            <strong>Not supplied</strong>
          </div>
          <div className="rhythm-row">
            <span>Total daily expenditure</span>
            <strong>Not supplied</strong>
          </div>
          <p className="small muted">
            Workout calories above sum the loaded wearable activities. Consumed
            calories are in your food diary. These categories are never added
            together, and wearable estimates never increase your nutrition
            targets.
          </p>
        </Card>
      </div>
      <Card>
        <div className="section-heading">
          <h2>Wearable activities</h2>
          <span className="pill">Intervals.icu</span>
        </div>
        {activities.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Activity / source time</th>
                  <th>Duration</th>
                  <th>Distance</th>
                  <th>Heart rate</th>
                  <th>Workout kcal</th>
                  <th>Load</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.data.name}</strong>
                      <br />
                      <small>
                        {a.data.type} · {a.data.start}
                        {linked.has(a.id) ? " · linked to diary" : ""}
                      </small>
                    </td>
                    <td>
                      {a.data.seconds == null
                        ? "—"
                        : fmt(a.data.seconds / 60, 1) + " min"}
                    </td>
                    <td>
                      {a.data.metres == null
                        ? "—"
                        : fmt(a.data.metres / 1000, 2) + " km"}
                    </td>
                    <td>
                      {fmt(a.data.averageHR)} avg / {fmt(a.data.maxHR)} max bpm
                    </td>
                    <td>{fmt(a.data.workoutCalories)}</td>
                    <td>{fmt(a.data.trainingLoad, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>
            Connect your own Intervals.icu account in Settings to import
            available records.
          </Empty>
        )}
        {hasMore("activity") && (
          <Action onClick={() => loadMore("activity")}>
            Load earlier activities
          </Action>
        )}
      </Card>
      <div className="two-column">
        {(["weight", "water"] as const).map((kind) => {
          const entries = kind === "weight" ? weights : water;
          return (
            <Card key={kind}>
              <div className="section-heading">
                <h2>
                  {kind === "weight" ? "Weight journal" : "Water journal"}
                </h2>
                <button
                  className="button secondary"
                  onClick={() => setEdit({ kind })}
                >
                  + Log {kind}
                </button>
              </div>
              {entries.map((e) => (
                <div className="history-row" key={e.id}>
                  <span>{e.date}</span>
                  <strong>
                    {kind === "weight"
                      ? `${fmt(settings.units === "metric" ? (e as Entry<"weight">).data.kg : kgToLb((e as Entry<"weight">).data.kg), 1)} ${settings.units === "metric" ? "kg" : "lb"}`
                      : `${fmt((e as Entry<"water">).data.ml / (settings.units === "metric" ? 1 : 29.5735295625), 1)} ${settings.units === "metric" ? "ml" : "US fl oz"}`}
                  </strong>
                  <button
                    className="text-button"
                    onClick={() => setEdit({ kind, entry: e })}
                  >
                    Edit
                  </button>
                  <Action
                    className="text-button"
                    onClick={async () => {
                      if (confirm(`Delete this ${kind} entry?`))
                        await remove(e.id);
                    }}
                  >
                    Delete
                  </Action>
                </div>
              ))}
              {entries.length === 0 && <Empty>No entries yet.</Empty>}
              {hasMore(kind) && (
                <Action onClick={() => loadMore(kind)}>
                  Load earlier entries
                </Action>
              )}
            </Card>
          );
        })}
      </div>
      <Card>
        <h3>Measurement date and fetch time are different.</h3>
        <p className="muted">
          Latest wellness source date: {latest?.date || "not recorded"}. Website
          fetch: {latest?.data.fetchedAt || "not recorded"}. Fetching old source
          data does not make it fresh. Sync your strap with Zepp first; an API
          fetch cannot force Zepp to upload.
        </p>
        <p className="small muted">
          No BioCharge, readiness, or stress score is inferred. Observations are
          for personal tracking, not medical diagnosis.
        </p>
        {hasMore("wellness") && (
          <Action onClick={() => loadMore("wellness")}>
            Load earlier wellness records
          </Action>
        )}
      </Card>
      {edit && <LogEditor {...edit} onClose={() => setEdit(null)} />}
    </>
  );
}

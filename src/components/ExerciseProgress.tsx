import { useState } from "react";
import { useData, useEntries } from "../lib/store";
import { exerciseProgress, progressExercises } from "../lib/workouts";
import { kgToLb } from "../lib/domain";
import { Action, Card, Empty, Field, fmt } from "./ui";

export function ExerciseProgress() {
  const sessions = useEntries("session");
  const { settings, hasMore, loadMore } = useData();
  const [selected, setSelected] = useState("");
  const choices = progressExercises(sessions);
  const choice = choices.find(([key]) => key === selected) || choices[0];
  const points = choice
    ? exerciseProgress(sessions, choice[1].name, choice[1].mode)
    : [];
  const latest = points.at(-1),
    previous = points.at(-2);
  const loaded = points.filter((p) => p.topKg !== null);
  const best = [...loaded].sort(
    (a, b) => b.topKg! - a.topKg! || b.topReps! - a.topReps!,
  )[0];
  const unit = settings.units === "imperial" ? "lb" : "kg";
  const weight = (kg: number) =>
    settings.units === "imperial" ? kgToLb(kg) : kg;
  const display = (kg: number) => `${fmt(weight(kg), 1)} ${unit}`;
  const delta =
    latest?.topKg != null && previous?.topKg != null
      ? latest.topKg - previous.topKg
      : null;
  return (
    <>
      <Card>
        <h2>Exercise progress</h2>
        <Field label="Exercise to track">
          <select
            value={choice?.[0] || ""}
            onChange={(e) => setSelected(e.target.value)}
            disabled={!choices.length}
          >
            {!choices.length && (
              <option value="">No completed exercises yet</option>
            )}
            {choices.map(([key, e]) => (
              <option key={key} value={key}>
                {e.name} · {e.mode === "strength" ? "Strength" : "Bodyweight"}
              </option>
            ))}
          </select>
        </Field>
        {latest ? (
          <>
            <div className="exercise-progress-stats">
              <div>
                <span>Best recorded set</span>
                <strong>
                  {best
                    ? `${display(best.topKg!)} × ${best.topReps} reps`
                    : `${Math.max(...points.flatMap((p) => p.sets.map((s) => s.reps!)))} reps`}
                </strong>
                <small>{best ? best.date : "Most reps in one set"}</small>
              </div>
              <div>
                <span>Latest session</span>
                <strong>{latest.reps} total reps</strong>
                <small>
                  {latest.date} · {latest.sets.length} completed sets
                </small>
              </div>
              <div>
                <span>Top weight vs previous session</span>
                <strong>
                  {delta === null
                    ? "Not enough weight data"
                    : `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${display(Math.abs(delta))}`}
                </strong>
                <small>
                  {previous
                    ? `Compared with ${previous.date}`
                    : "Log another session to compare"}
                </small>
              </div>
            </div>
            <p className="small muted">
              Best set uses the heaviest recorded external weight, then reps at
              that weight. Compare reps alongside weight; a heavier set alone
              does not measure overall improvement.
            </p>
          </>
        ) : (
          <Empty>
            Log completed reps in a workout to see your progress here.
          </Empty>
        )}
        <p className="small muted">
          Based on loaded sessions. Skipped exercises, skipped sets and sets
          without completed reps are excluded. Unrecorded weights remain
          unknown.
        </p>
      </Card>
      {!!points.length && (
        <Card>
          <h2>Weights & reps over time</h2>
          <div className="table-wrap">
            <table aria-label="Exercise progress history">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Completed sets</th>
                  <th>Total reps</th>
                  <th>External volume ({unit}·reps)</th>
                </tr>
              </thead>
              <tbody>
                {[...points].reverse().map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.date}
                      <br />
                      <small>{p.title}</small>
                    </td>
                    <td>
                      {p.sets.map((s, i) => (
                        <div key={i}>
                          {s.kg === null
                            ? "Weight not recorded"
                            : display(s.kg)}{" "}
                          × {s.reps} reps
                        </div>
                      ))}
                    </td>
                    <td>{p.reps}</td>
                    <td>
                      {p.volume === null ? "—" : fmt(weight(p.volume), 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">
            External volume sums recorded weight × reps for strength sets only.
            Bodyweight and missing weights are excluded.
          </p>
        </Card>
      )}
      {hasMore("session") && (
        <Action onClick={() => loadMore("session")}>
          Load earlier sessions for progress
        </Action>
      )}
    </>
  );
}

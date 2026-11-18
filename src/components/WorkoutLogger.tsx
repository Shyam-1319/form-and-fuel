import { useState } from "react";
import { Play, Check, Plus } from "lucide-react";
import { useData, useEntries } from "../lib/store";
import {
  dayInZone,
  kgToLb,
  lbToKg,
  safeVideoUrl,
  type Entry,
  type Plan,
  type Workout,
} from "../lib/domain";
import {
  emptySet,
  previousExercise,
  sessionFromPlan,
  addWorkbookVideos,
} from "../lib/workouts";
import { readWorkbook, suggestMapping, mapWorkbook } from "../lib/importer";
import { Action, Card, Field, Modal, fmt } from "./ui";

export function PlanWorkout({
  plans,
  onEdit,
  onDelete,
  onUpdatePlan,
  onSave,
}: {
  plans: Entry<"plan">[];
  onEdit: (plan: Entry<"plan">) => void;
  onDelete: (id: string) => Promise<void>;
  onUpdatePlan: (entry: Entry<"plan">, data: Plan) => Promise<void>;
  onSave: (date: string, data: Workout) => Promise<void>;
}) {
  const { settings } = useData();
  const [planId, setPlanId] = useState("");
  const [dayIndex, setDayIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [videoStatus, setVideoStatus] = useState("");
  const [videoError, setVideoError] = useState("");
  const [readingVideos, setReadingVideos] = useState(false);
  const plan = plans.find((p) => p.id === planId) || plans[0];
  if (!plan) return null;
  const index = Math.min(dayIndex, plan.data.days.length - 1);
  const selected = plan.data.days[index];
  const weeks = [...new Set(plan.data.days.map((d) => d.week))];
  function change(action: () => void) {
    if (
      dirty &&
      !confirm("Discard the sets you have entered for this workout?")
    )
      return;
    setDirty(false);
    action();
  }
  return (
    <div className="workout-focus">
      <Card className="workout-selector">
        <Field label="Plan">
          <select
            value={plan.id}
            onChange={(e) =>
              change(() => {
                setPlanId(e.target.value);
                setDayIndex(0);
              })
            }
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.data.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Week">
          <select
            value={selected.week}
            onChange={(e) =>
              change(() =>
                setDayIndex(
                  plan.data.days.findIndex((d) => d.week === e.target.value),
                ),
              )
            }
          >
            {weeks.map((week) => (
              <option key={week} value={week}>
                {week}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Workout">
          <select
            value={index}
            onChange={(e) => change(() => setDayIndex(Number(e.target.value)))}
          >
            {plan.data.days.map(
              (d, i) =>
                d.week === selected.week && (
                  <option key={i} value={i}>
                    {d.day}
                  </option>
                ),
            )}
          </select>
        </Field>
      </Card>
      <WorkoutLogger
        key={`${plan.id}:${plan.updatedAt}:${index}`}
        initial={sessionFromPlan(plan, index)}
        initialDate={dayInZone(new Date(), settings.timezone)}
        inline
        onDirty={setDirty}
        onClose={() => {}}
        onSave={onSave}
      />
      <details className="workout-options">
        <summary>Manage plan</summary>
        <Field
          label="Add demonstration links from workbook"
          hint="Adds missing video links to matching exercise names; your workouts stay the same."
        >
          <input
            type="file"
            accept=".xlsx,.csv"
            disabled={readingVideos}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (
                !file ||
                (dirty &&
                  !confirm(
                    "Discard entered sets before updating the plan's demonstration links?",
                  ))
              )
                return;
              setReadingVideos(true);
              setVideoStatus("");
              setVideoError("");
              try {
                const book = await readWorkbook(file);
                const imported = mapWorkbook(
                  book,
                  book.sheets.map(suggestMapping),
                  "Video links",
                );
                const result = addWorkbookVideos(plan.data, imported);
                if (result.added) {
                  await onUpdatePlan(plan, result.plan);
                  setDirty(false);
                }
                setVideoStatus(
                  result.added
                    ? `Added demonstration links to ${result.added} exercises.`
                    : "No missing links could be matched. Existing links were kept.",
                );
              } catch (error) {
                setVideoError((error as Error).message);
              } finally {
                setReadingVideos(false);
              }
            }}
          />
        </Field>
        {readingVideos && <p role="status">Reading demonstration links…</p>}
        {videoStatus && <p role="status">{videoStatus}</p>}
        {videoError && (
          <p className="error" role="alert">
            {videoError}
          </p>
        )}
        <div className="split">
          <button className="text-button" onClick={() => onEdit(plan)}>
            Edit plan
          </button>
          <Action
            className="text-button danger-text"
            onClick={async () => {
              if (confirm("Delete this plan? Completed workouts are kept."))
                await onDelete(plan.id);
            }}
          >
            Delete plan
          </Action>
        </div>
      </details>
    </div>
  );
}

export function WorkoutLogger({
  initial,
  initialDate,
  editingId,
  inline = false,
  onDirty,
  onClose,
  onSave,
}: {
  initial: Workout;
  initialDate: string;
  editingId?: string;
  inline?: boolean;
  onDirty?: (dirty: boolean) => void;
  onClose: () => void;
  onSave: (date: string, data: Workout) => Promise<void>;
}) {
  const [data, setData] = useState(initial);
  const [date, setDate] = useState(initialDate);
  const [finished, setFinished] = useState(false);
  const sessions = useEntries("session"),
    activities = useEntries("activity");
  const { settings, hasMore, loadMore } = useData();
  const imperial = settings.units === "imperial",
    unit = imperial ? "lb" : "kg";
  const displayWeight = (kg: number) =>
    imperial ? Math.round(kgToLb(kg) * 100) / 100 : kg;
  function update(value: Workout) {
    setData(value);
    onDirty?.(true);
  }
  function updateExercise(
    index: number,
    patch: Partial<Workout["exercises"][number]>,
  ) {
    update({
      ...data,
      exercises: data.exercises.map((e, i) =>
        i === index ? { ...e, ...patch } : e,
      ),
    });
  }
  function updateSet(
    index: number,
    setIndex: number,
    patch: Partial<Workout["exercises"][number]["sets"][number]>,
  ) {
    updateExercise(index, {
      sets: data.exercises[index].sets.map((s, i) =>
        i === setIndex ? { ...s, ...patch } : s,
      ),
    });
  }
  const content = finished ? (
    <Card className="workout-finished">
      <Check size={28} />
      <h2>Workout saved.</h2>
      <button
        className="button secondary"
        onClick={() => {
          setData(structuredClone(initial));
          setFinished(false);
        }}
      >
        Log another workout
      </button>
    </Card>
  ) : (
    <>
      <div className="workout-day-heading">
        <div>
          <p className="eyebrow">YOUR WORKOUT</p>
          <h2>{data.title}</h2>
        </div>
        <span className="muted">{date}</span>
      </div>
      {data.exercises.map((exercise, index) => {
        const planned = data.planned[index];
        const video = safeVideoUrl(planned?.videoUrl);
        const previous = previousExercise(
          sessions,
          exercise.name,
          exercise.mode,
          date,
          editingId,
        );
        return (
          <section
            className={`card workout-exercise${exercise.skipped ? " is-skipped" : ""}`}
            key={index}
            aria-label={exercise.name}
          >
            <div className="workout-exercise-heading">
              <span className="workout-number">{index + 1}</span>
              <h3>{exercise.name}</h3>
              {video ? (
                <a
                  className="workout-play"
                  href={video}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Watch ${exercise.name} demonstration`}
                  title="Watch demonstration"
                >
                  <Play size={19} fill="currentColor" />
                </a>
              ) : (
                <button
                  className="workout-play"
                  disabled
                  aria-label={`No demonstration link for ${exercise.name}`}
                  title="No demonstration link. Re-import your workbook to include its links."
                >
                  <Play size={19} />
                </button>
              )}
            </div>
            {planned?.reps && (
              <span className="workout-target">{planned.reps} reps</span>
            )}
            <table className="workout-set-table">
              <thead>
                <tr>
                  <th scope="col">Set</th>
                  <th scope="col">Previous</th>
                  <th scope="col">
                    Weight <small>({unit})</small>
                  </th>
                  <th scope="col">Reps</th>
                </tr>
              </thead>
              <tbody>
                {exercise.sets.map((set, j) => {
                  const prior = previous?.sets[j];
                  return (
                    <tr key={j} className={set.skipped ? "is-skipped" : ""}>
                      <th scope="row">{j + 1}</th>
                      <td className="workout-previous">
                        {prior &&
                        !prior.skipped &&
                        (prior.kg !== null || prior.reps !== null)
                          ? `${prior.kg === null ? "—" : fmt(displayWeight(prior.kg))} ${unit} × ${prior.reps ?? "—"}`
                          : "—"}
                      </td>
                      <td>
                        <input
                          aria-label={`${exercise.name} set ${j + 1} weight (${unit})`}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="any"
                          placeholder="—"
                          disabled={exercise.skipped || set.skipped}
                          value={set.kg === null ? "" : displayWeight(set.kg)}
                          onChange={(e) =>
                            updateSet(index, j, {
                              kg:
                                e.target.value === ""
                                  ? null
                                  : imperial
                                    ? lbToKg(Number(e.target.value))
                                    : Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`${exercise.name} set ${j + 1} reps`}
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="1"
                          placeholder="—"
                          disabled={exercise.skipped || set.skipped}
                          value={set.reps ?? ""}
                          onChange={(e) =>
                            updateSet(index, j, {
                              reps:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button
              className="workout-add-set"
              disabled={exercise.sets.length >= 100}
              onClick={() =>
                updateExercise(index, { sets: [...exercise.sets, emptySet()] })
              }
            >
              <Plus size={15} /> Add set
            </button>
            <details className="workout-options">
              <summary>Notes & options</summary>
              {planned?.instructions && <p>{planned.instructions}</p>}
              {planned?.alternatives && (
                <p className="muted">Alternatives: {planned.alternatives}</p>
              )}
              <div className="form-grid">
                <Field label="Exercise name">
                  <input
                    value={exercise.name}
                    onChange={(e) =>
                      updateExercise(index, { name: e.target.value })
                    }
                  />
                </Field>
                <Field label="Exercise type">
                  <select
                    value={exercise.mode}
                    onChange={(e) =>
                      updateExercise(index, {
                        mode: e.target.value as typeof exercise.mode,
                      })
                    }
                  >
                    {["strength", "bodyweight", "cardio", "other"].map(
                      (mode) => (
                        <option key={mode}>{mode}</option>
                      ),
                    )}
                  </select>
                </Field>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={exercise.skipped}
                  onChange={(e) =>
                    updateExercise(index, { skipped: e.target.checked })
                  }
                />{" "}
                Skip exercise
              </label>
              {exercise.sets.map((set, j) => (
                <div className="workout-extra-set" key={j}>
                  <strong>Set {j + 1}</strong>
                  <div className="form-grid">
                    {(["seconds", "metres", "effort", "rest"] as const).map(
                      (key) => (
                        <Field
                          key={key}
                          label={key === "effort" ? "RPE / RIR" : key}
                        >
                          <input
                            type={
                              key === "seconds" || key === "metres"
                                ? "number"
                                : "text"
                            }
                            min="0"
                            value={set[key] ?? ""}
                            onChange={(e) =>
                              updateSet(index, j, {
                                [key]:
                                  key === "seconds" || key === "metres"
                                    ? e.target.value === ""
                                      ? null
                                      : Number(e.target.value)
                                    : e.target.value,
                              })
                            }
                          />
                        </Field>
                      ),
                    )}
                  </div>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={set.skipped}
                      onChange={(e) =>
                        updateSet(index, j, { skipped: e.target.checked })
                      }
                    />{" "}
                    Skip set
                  </label>
                </div>
              ))}
            </details>
          </section>
        );
      })}
      <button
        className="text-button"
        onClick={() =>
          update({
            ...data,
            exercises: [
              ...data.exercises,
              {
                name: "New exercise",
                mode: "strength",
                skipped: false,
                sets: [emptySet()],
              },
            ],
          })
        }
      >
        + Add exercise
      </button>
      <details className="workout-options">
        <summary>Workout details</summary>
        <div className="form-grid">
          <Field label="Session title">
            <input
              value={data.title}
              onChange={(e) => update({ ...data, title: e.target.value })}
            />
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                onDirty?.(true);
              }}
            />
          </Field>
        </div>
        <Field label="Session notes">
          <textarea
            value={data.notes}
            onChange={(e) => update({ ...data, notes: e.target.value })}
          />
        </Field>
        <Field label="Link a wearable activity (optional)">
          <select
            value={data.activityId || ""}
            onChange={(e) =>
              update({ ...data, activityId: e.target.value || null })
            }
          >
            <option value="">No linked activity</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.date} · {a.data.name}
              </option>
            ))}
          </select>
        </Field>
        {hasMore("activity") && (
          <Action className="text-button" onClick={() => loadMore("activity")}>
            Load earlier activities
          </Action>
        )}
        {hasMore("session") && (
          <Action className="text-button" onClick={() => loadMore("session")}>
            Load older workout history
          </Action>
        )}
      </details>
      <div className="workout-save">
        <Action
          onClick={async () => {
            await onSave(date, data);
            setFinished(true);
            onDirty?.(false);
          }}
        >
          <Check size={18} /> Save completed session
        </Action>
      </div>
    </>
  );
  return inline ? (
    <div className="workout-logger">{content}</div>
  ) : (
    <Modal title="Your workout" onClose={onClose}>
      {content}
    </Modal>
  );
}

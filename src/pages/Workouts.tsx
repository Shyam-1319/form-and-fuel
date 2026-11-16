import { useState } from "react";
import {
  Plus,
  Upload,
  ArrowUp,
  ArrowDown,
  Copy,
  Play,
  Dumbbell,
  Trash2,
} from "lucide-react";
import { useData, useEntries } from "../lib/store";
import {
  dayInZone,
  emptyExercise,
  planSchema,
  sessionSchema,
  volume,
  type Plan,
  type Workout,
  type Entry,
} from "../lib/domain";
import {
  readWorkbook,
  suggestMapping,
  mapWorkbook,
  columns,
  type Workbook,
  type Mapping,
} from "../lib/importer";
import {
  Card,
  Heading,
  Field,
  Action,
  Modal,
  Empty,
  fmt,
} from "../components/ui";
export function Workouts() {
  const { settings, save, remove, hasMore, loadMore } = useData();
  const plans = useEntries("plan"),
    sessions = useEntries("session"),
    activities = useEntries("activity");
  const [tab, setTab] = useState("plans");
  const [plan, setPlan] = useState<{ id?: string; data: Plan } | null>(null);
  const [session, setSession] = useState<{
    id?: string;
    date: string;
    data: Workout;
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [exercise, setExercise] = useState("");
  const today = dayInZone(new Date(), settings.timezone);
  const history = sessions.filter(
    (s) =>
      !exercise ||
      s.data.exercises.some((e) =>
        e.name.toLowerCase().includes(exercise.toLowerCase()),
      ),
  );
  const best = history.flatMap((s) =>
    s.data.exercises
      .filter(
        (e) =>
          e.mode === "strength" &&
          !e.skipped &&
          (!exercise || e.name.toLowerCase().includes(exercise.toLowerCase())),
      )
      .flatMap((e) =>
        e.sets
          .filter((t) => !t.skipped && (t.reps || 0) > 0 && (t.kg || 0) > 0)
          .map((t) => t.kg!),
      ),
  );
  const start = (p?: Entry<"plan">, dayIndex = 0) =>
    setSession({
      date: today,
      data: {
        title: p
          ? `${p.data.title} · ${p.data.days[dayIndex].day}`
          : "Training session",
        notes: "",
        planId: p?.id || null,
        planned: structuredClone(p?.data.days[dayIndex].exercises || []),
        exercises: (p?.data.days[dayIndex].exercises || []).map((e) => ({
          name: e.name,
          mode: e.mode,
          skipped: false,
          sets: Array.from(
            { length: Math.min(20, parseInt(e.sets) || 1) },
            () => ({
              reps: null,
              kg: null,
              seconds: null,
              metres: null,
              effort: "",
              rest: "",
              skipped: false,
            }),
          ),
        })),
        activityId: null,
      },
    });
  return (
    <>
      <Heading
        eyebrow="MOVE WITH INTENTION"
        title="Make room for movement."
        description="Plan your training. Record what actually happened."
        action={
          <div className="split">
            <button
              className="button secondary"
              onClick={() => setImporting(true)}
            >
              <Upload size={17} /> Import plan
            </button>
            <button className="button" onClick={() => start()}>
              <Plus size={17} /> Log session
            </button>
          </div>
        }
      />
      <div className="toolbar">
        <div className="segmented">
          <button
            className={tab === "plans" ? "selected" : ""}
            onClick={() => setTab("plans")}
          >
            Workout plans
          </button>
          <button
            className={tab === "sessions" ? "selected" : ""}
            onClick={() => setTab("sessions")}
          >
            Completed sessions
          </button>
          <button
            className={tab === "history" ? "selected" : ""}
            onClick={() => setTab("history")}
          >
            Exercise history
          </button>
        </div>
      </div>
      {tab === "plans" ? (
        <>
          <div className="two-column">
            {plans.map((p) => (
              <Card key={p.id}>
                <span className="plan-icon">
                  <Dumbbell size={24} />
                </span>
                <p className="eyebrow">
                  {p.data.days.length} TRAINING DAY
                  {p.data.days.length === 1 ? "" : "S"}
                </p>
                <h2>{p.data.title}</h2>
                <p className="muted">{p.data.notes}</p>
                {p.data.days.map((d, i) => (
                  <div className="plan-day" key={i}>
                    <div>
                      <strong>
                        Week {d.week} · {d.day}
                      </strong>
                      <p>{d.exercises.map((e) => e.name).join(" · ")}</p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={`Start ${d.day}`}
                      onClick={() => start(p, i)}
                    >
                      <Play size={17} />
                    </button>
                  </div>
                ))}
                <div className="split">
                  <button
                    className="text-button"
                    onClick={() =>
                      setPlan({ id: p.id, data: structuredClone(p.data) })
                    }
                  >
                    Edit plan
                  </button>
                  <Action
                    className="text-button danger-text"
                    onClick={async () => {
                      if (
                        confirm(
                          "Delete this plan? Completed sessions keep their original snapshot.",
                        )
                      )
                        await remove(p.id);
                    }}
                  >
                    Delete
                  </Action>
                </div>
                {p.data.sourceNotes.length > 0 && (
                  <details>
                    <summary>Source notes & import warnings</summary>
                    <ul>
                      {p.data.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                    <pre className="source-notes">
                      {p.data.sourceNotes.join("\n")}
                    </pre>
                  </details>
                )}
              </Card>
            ))}
            <button
              className="new-plan"
              onClick={() =>
                setPlan({
                  data: {
                    title: "My training plan",
                    notes: "",
                    days: [
                      {
                        week: "1",
                        day: "Day A",
                        notes: "",
                        exercises: [emptyExercise()],
                      },
                    ],
                    sourceNotes: [],
                    warnings: [],
                  },
                })
              }
            >
              <Plus size={26} />
              <strong>Build your own plan</strong>
              <span>Start with one day. Find your rhythm.</span>
            </button>
          </div>
          {hasMore("plan") && (
            <Action onClick={() => loadMore("plan")}>Load earlier plans</Action>
          )}
        </>
      ) : (
        <>
          {tab === "history" && (
            <Card>
              <Field label="Find an exercise">
                <input
                  placeholder="e.g. Goblet squat"
                  value={exercise}
                  onChange={(e) => setExercise(e.target.value)}
                />
              </Field>
              <p>
                Heaviest recorded external load:{" "}
                <strong>
                  {best.length
                    ? `${fmt(Math.max(...best), 1)} kg`
                    : "Not recorded"}
                </strong>
              </p>
              <p className="small muted">
                Personal best means maximum external load in a non-skipped
                strength set with at least one completed rep. It is not an
                estimated one-rep max. Search one exercise for a meaningful
                comparison.
              </p>
            </Card>
          )}
          {history.map((s) => (
            <Card key={s.id}>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{s.date}</p>
                  <h2>{s.data.title}</h2>
                </div>
                <span className="pill">{fmt(volume(s.data))} kg·reps</span>
              </div>
              <p className="muted">{s.data.notes}</p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Exercise</th>
                      <th>Planned</th>
                      <th>Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.data.exercises.map((e, i) => (
                      <tr key={i}>
                        <td>{e.name}</td>
                        <td>
                          {s.data.planned[i]
                            ? `${s.data.planned[i].sets} × ${s.data.planned[i].reps} · ${s.data.planned[i].load}`
                            : "Unplanned"}
                        </td>
                        <td>
                          {e.skipped
                            ? "Skipped"
                            : e.sets
                                .map((t) =>
                                  t.skipped
                                    ? "Skipped"
                                    : `${t.reps ?? "—"} reps · ${t.kg ?? "—"} kg${t.seconds != null ? ` · ${t.seconds} s` : ""}${t.metres != null ? ` · ${t.metres} m` : ""}`,
                                )
                                .join(" / ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {s.data.activityId && (
                <p className="small muted">
                  Linked wearable activity:{" "}
                  {activities.find((a) => a.id === s.data.activityId)?.data
                    .name || "Previously linked activity"}{" "}
                  · counted once in combined session counts.
                </p>
              )}
              <div className="split">
                <button
                  className="text-button"
                  onClick={() =>
                    setSession({
                      id: s.id,
                      date: s.date,
                      data: structuredClone(s.data),
                    })
                  }
                >
                  Edit actual session
                </button>
                <Action
                  className="text-button danger-text"
                  onClick={async () => {
                    if (confirm("Delete this workout session?"))
                      await remove(s.id);
                  }}
                >
                  Delete
                </Action>
              </div>
            </Card>
          ))}
          {!history.length && (
            <Empty>No completed sessions recorded yet.</Empty>
          )}
          {hasMore("session") && (
            <Action onClick={() => loadMore("session")}>
              Load earlier sessions
            </Action>
          )}
          <p className="small muted">
            Volume sums external kg × completed reps for strength exercises
            only. Cardio, bodyweight movements and skipped sets are excluded.
          </p>
        </>
      )}
      {plan && (
        <PlanEditor
          initial={plan.data}
          onClose={() => setPlan(null)}
          onSave={async (data) => {
            await save("plan", today, planSchema.parse(data), plan.id);
            setPlan(null);
          }}
        />
      )}
      {session && (
        <SessionEditor
          initial={session.data}
          initialDate={session.date}
          onClose={() => setSession(null)}
          onSave={async (date, data) => {
            await save("session", date, sessionSchema.parse(data), session.id);
            setSession(null);
            setTab("sessions");
          }}
        />
      )}
      {importing && (
        <Importer
          onClose={() => setImporting(false)}
          onPreview={(data) => {
            setImporting(false);
            setPlan({ data });
          }}
        />
      )}
    </>
  );
}
function PlanEditor({
  initial,
  onClose,
  onSave,
}: {
  initial: Plan;
  onClose: () => void;
  onSave: (data: Plan) => Promise<void>;
}) {
  const [data, setData] = useState(initial);
  const [day, setDay] = useState(0);
  const selected = data.days[day];
  function changeDay(value: Partial<Plan["days"][number]>) {
    setData({
      ...data,
      days: data.days.map((d, i) => (i === day ? { ...d, ...value } : d)),
    });
  }
  function reorder(index: number, delta: number) {
    const exercises = [...selected.exercises];
    [exercises[index], exercises[index + delta]] = [
      exercises[index + delta],
      exercises[index],
    ];
    changeDay({ exercises });
  }
  return (
    <Modal title="Workout plan editor" onClose={onClose}>
      <Field label="Plan title">
        <input
          value={data.title}
          onChange={(e) => setData({ ...data, title: e.target.value })}
        />
      </Field>
      <Field label="Plan notes">
        <textarea
          value={data.notes}
          onChange={(e) => setData({ ...data, notes: e.target.value })}
        />
      </Field>
      <div className="toolbar">
        <Field label="Training day">
          <select value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {data.days.map((d, i) => (
              <option key={i} value={i}>
                Week {d.week} · {d.day}
              </option>
            ))}
          </select>
        </Field>
        <button
          className="button secondary"
          onClick={() => {
            setData({
              ...data,
              days: [
                ...data.days,
                {
                  week: "1",
                  day: `Day ${data.days.length + 1}`,
                  notes: "",
                  exercises: [],
                },
              ],
            });
            setDay(data.days.length);
          }}
        >
          <Plus size={15} /> Day
        </button>
        <button
          className="button secondary"
          onClick={() => {
            setData({
              ...data,
              days: [
                ...data.days,
                { ...structuredClone(selected), day: selected.day + " copy" },
              ],
            });
            setDay(data.days.length);
          }}
        >
          <Copy size={15} /> Copy day
        </button>
      </div>
      <div className="form-grid">
        <Field label="Week">
          <input
            value={selected.week}
            onChange={(e) => changeDay({ week: e.target.value })}
          />
        </Field>
        <Field label="Day">
          <input
            value={selected.day}
            onChange={(e) => changeDay({ day: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Day instructions">
        <textarea
          value={selected.notes}
          onChange={(e) => changeDay({ notes: e.target.value })}
        />
      </Field>
      {selected.exercises.map((exercise, index) => (
        <div className="exercise-editor" key={index}>
          <div className="section-heading">
            <h3>Exercise {index + 1}</h3>
            <div className="split">
              <button
                className="icon-button"
                disabled={index === 0}
                aria-label="Move exercise up"
                onClick={() => reorder(index, -1)}
              >
                <ArrowUp size={16} />
              </button>
              <button
                className="icon-button"
                disabled={index === selected.exercises.length - 1}
                aria-label="Move exercise down"
                onClick={() => reorder(index, 1)}
              >
                <ArrowDown size={16} />
              </button>
              <button
                className="icon-button"
                aria-label="Remove exercise"
                onClick={() =>
                  changeDay({
                    exercises: selected.exercises.filter((_, i) => i !== index),
                  })
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <div className="form-grid">
            {Object.entries(exercise).map(([key, value]) => (
              <Field
                key={key}
                label={
                  key === "effort"
                    ? "RPE / RIR"
                    : key === "group"
                      ? "Superset / circuit"
                      : key[0].toUpperCase() + key.slice(1)
                }
              >
                {key === "mode" ? (
                  <select
                    value={value}
                    onChange={(e) =>
                      changeDay({
                        exercises: selected.exercises.map((x, i) =>
                          i === index
                            ? { ...x, mode: e.target.value as typeof x.mode }
                            : x,
                        ),
                      })
                    }
                  >
                    {["strength", "bodyweight", "cardio", "other"].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={value}
                    onChange={(e) =>
                      changeDay({
                        exercises: selected.exercises.map((x, i) =>
                          i === index ? { ...x, [key]: e.target.value } : x,
                        ),
                      })
                    }
                  />
                )}
              </Field>
            ))}
          </div>
        </div>
      ))}
      <button
        className="button secondary"
        onClick={() =>
          changeDay({ exercises: [...selected.exercises, emptyExercise()] })
        }
      >
        <Plus size={16} /> Exercise
      </button>
      <p className="small muted">
        Reps and loads preserve expressions such as 8–12, AMRAP, to failure, and
        75%. This plan does not change any previously logged session.
      </p>
      {data.sourceNotes.length > 0 && (
        <details>
          <summary>
            Review all retained source content ({data.sourceNotes.length} lines)
          </summary>
          <ul>
            {data.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <pre className="source-notes">{data.sourceNotes.join("\n")}</pre>
        </details>
      )}
      <Action onClick={() => onSave(data)}>Confirm & save plan</Action>
    </Modal>
  );
}
function SessionEditor({
  initial,
  initialDate,
  onClose,
  onSave,
}: {
  initial: Workout;
  initialDate: string;
  onClose: () => void;
  onSave: (date: string, data: Workout) => Promise<void>;
}) {
  const [data, setData] = useState(initial);
  const [date, setDate] = useState(initialDate);
  const activities = useEntries("activity");
  const { hasMore, loadMore } = useData();
  const emptySet = () => ({
    reps: null,
    kg: null,
    seconds: null,
    metres: null,
    effort: "",
    rest: "",
    skipped: false,
  });
  return (
    <Modal title="Record your actual session" onClose={onClose}>
      <div className="form-grid">
        <Field label="Session title">
          <input
            value={data.title}
            onChange={(e) => setData({ ...data, title: e.target.value })}
          />
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>
      <p className="notice">
        Enter completed values. Planned sets are blank until you record what
        happened. Loads are stored and entered in kg; distance in metres and
        duration in seconds.
      </p>
      {data.exercises.map((exercise, index) => (
        <div className="exercise-editor" key={index}>
          <div className="form-grid">
            <Field label="Exercise">
              <input
                value={exercise.name}
                onChange={(e) =>
                  setData({
                    ...data,
                    exercises: data.exercises.map((x, i) =>
                      i === index ? { ...x, name: e.target.value } : x,
                    ),
                  })
                }
              />
            </Field>
            <Field label="Exercise type">
              <select
                value={exercise.mode}
                onChange={(e) =>
                  setData({
                    ...data,
                    exercises: data.exercises.map((x, i) =>
                      i === index
                        ? { ...x, mode: e.target.value as typeof x.mode }
                        : x,
                    ),
                  })
                }
              >
                {["strength", "bodyweight", "cardio", "other"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={exercise.skipped}
              onChange={(e) =>
                setData({
                  ...data,
                  exercises: data.exercises.map((x, i) =>
                    i === index ? { ...x, skipped: e.target.checked } : x,
                  ),
                })
              }
            />
            Skipped exercise
          </label>
          {exercise.sets.map((set, j) => (
            <div className="set-row" key={j}>
              <strong>{j + 1}</strong>
              {(
                ["reps", "kg", "seconds", "metres", "effort", "rest"] as const
              ).map((key) => (
                <Field key={key} label={key === "effort" ? "RPE/RIR" : key}>
                  <input
                    type={
                      key === "effort" || key === "rest" ? "text" : "number"
                    }
                    min="0"
                    step="any"
                    value={set[key] ?? ""}
                    onChange={(e) =>
                      setData({
                        ...data,
                        exercises: data.exercises.map((x, i) =>
                          i === index
                            ? {
                                ...x,
                                sets: x.sets.map((s, k) =>
                                  k === j
                                    ? {
                                        ...s,
                                        [key]:
                                          key === "effort" || key === "rest"
                                            ? e.target.value
                                            : e.target.value === ""
                                              ? null
                                              : Number(e.target.value),
                                      }
                                    : s,
                                ),
                              }
                            : x,
                        ),
                      })
                    }
                  />
                </Field>
              ))}
              <label className="check">
                <input
                  type="checkbox"
                  checked={set.skipped}
                  onChange={(e) =>
                    setData({
                      ...data,
                      exercises: data.exercises.map((x, i) =>
                        i === index
                          ? {
                              ...x,
                              sets: x.sets.map((s, k) =>
                                k === j
                                  ? { ...s, skipped: e.target.checked }
                                  : s,
                              ),
                            }
                          : x,
                      ),
                    })
                  }
                />
                Skip
              </label>
            </div>
          ))}
          <button
            className="text-button"
            onClick={() =>
              setData({
                ...data,
                exercises: data.exercises.map((x, i) =>
                  i === index ? { ...x, sets: [...x.sets, emptySet()] } : x,
                ),
              })
            }
          >
            + Add set
          </button>
        </div>
      ))}
      <button
        className="button secondary"
        onClick={() =>
          setData({
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
      <Field label="Session notes">
        <textarea
          value={data.notes}
          onChange={(e) => setData({ ...data, notes: e.target.value })}
        />
      </Field>
      <Field label="Link a wearable activity (optional)">
        <select
          value={data.activityId || ""}
          onChange={(e) =>
            setData({ ...data, activityId: e.target.value || null })
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
      <Action onClick={() => onSave(date, data)}>Save completed session</Action>
    </Modal>
  );
}
function Importer({
  onClose,
  onPreview,
}: {
  onClose: () => void;
  onPreview: (data: Plan) => void;
}) {
  const [book, setBook] = useState<Workbook | null>(null);
  const [maps, setMaps] = useState<Mapping[]>([]);
  const [title, setTitle] = useState("Imported workout plan");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <Modal title="Import a workout spreadsheet" onClose={onClose}>
      <p className="muted">
        Excel .xlsx or CSV · max 2 MB. All sheets and source notes are retained
        for review. Formulas are never executed.
      </p>
      <a className="text-button" href="/samples/strength-plan.xlsx" download>
        Download synthetic sample workbook
      </a>
      <Field label="Workout file">
        <input
          type="file"
          accept=".xlsx,.csv"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setError("");
            setLoading(true);
            try {
              const result = await readWorkbook(file);
              setBook(result);
              setMaps(result.sheets.map(suggestMapping));
              setTitle(file.name.replace(/\.[^.]+$/, ""));
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setLoading(false);
            }
          }}
        />
      </Field>
      {loading && <p role="status">Reading workbook…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {book && (
        <>
          <Field label="Plan title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          {book.sheets.map((sheet, index) => (
            <Card key={index}>
              <h3>{sheet.name}</h3>
              <p className="muted">
                {sheet.rows.length} rows · {sheet.merged.length} merged
                heading(s)
              </p>
              <Field label="Header row (1-based)">
                <input
                  type="number"
                  min="1"
                  max={sheet.rows.length}
                  value={maps[index].header + 1}
                  onChange={(e) =>
                    setMaps(
                      maps.map((m, i) =>
                        i === index
                          ? {
                              ...m,
                              header: Math.max(0, Number(e.target.value) - 1),
                            }
                          : m,
                      ),
                    )
                  }
                />
              </Field>
              <div className="form-grid">
                {columns.map((column) => (
                  <Field key={column} label={column}>
                    <select
                      value={maps[index].columns[column] ?? ""}
                      onChange={(e) =>
                        setMaps(
                          maps.map((m, i) =>
                            i === index
                              ? {
                                  ...m,
                                  columns: {
                                    ...m.columns,
                                    [column]:
                                      e.target.value === ""
                                        ? undefined
                                        : Number(e.target.value),
                                  },
                                }
                              : m,
                          ),
                        )
                      }
                    >
                      <option value="">Unmapped · retained as notes</option>
                      {Array.from(
                        {
                          length: Math.max(
                            0,
                            ...sheet.rows.map((r) => r.length),
                          ),
                        },
                        (_, j) => (
                          <option key={j} value={j}>
                            Column {j + 1}:{" "}
                            {sheet.rows[maps[index].header]?.[j] || "(blank)"}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>
                ))}
              </div>
              <details>
                <summary>View all source rows</summary>
                <pre className="source-notes">
                  {sheet.rows
                    .map((r, i) => `${i + 1}: ${r.join(" | ")}`)
                    .join("\n")}
                </pre>
              </details>
            </Card>
          ))}
          <Action
            onClick={async () => onPreview(mapWorkbook(book, maps, title))}
          >
            Open editable import preview
          </Action>
          <p className="small muted">
            Nothing is saved yet. The next screen lets you correct days,
            exercises, modes, and notes before confirming.
          </p>
        </>
      )}
    </Modal>
  );
}

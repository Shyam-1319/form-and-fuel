import { type Entry, type Workout, type Plan, safeVideoUrl } from "./domain";

const normalized = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLowerCase();
export function exerciseProgress(
  sessions: Entry<"session">[],
  name: string,
  mode: "strength" | "bodyweight",
) {
  return [...sessions]
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    )
    .flatMap((session) => {
      const sets = session.data.exercises
        .filter(
          (e) =>
            !e.skipped &&
            e.mode === mode &&
            normalized(e.name) === normalized(name),
        )
        .flatMap((e) =>
          e.sets.filter((s) => !s.skipped && s.reps !== null && s.reps > 0),
        );
      if (!sets.length) return [];
      const loaded = sets.filter((s) => s.kg !== null);
      const top = [...loaded].sort(
        (a, b) => b.kg! - a.kg! || b.reps! - a.reps!,
      )[0];
      return [
        {
          id: session.id,
          date: session.date,
          title: session.data.title,
          sets,
          topKg: top?.kg ?? null,
          topReps: top?.reps ?? null,
          reps: sets.reduce((sum, s) => sum + s.reps!, 0),
          volume:
            mode === "strength" && loaded.length
              ? loaded.reduce((sum, s) => sum + s.kg! * s.reps!, 0)
              : null,
        },
      ];
    });
}

export function progressExercises(sessions: Entry<"session">[]) {
  const choices = new Map<
    string,
    { name: string; mode: "strength" | "bodyweight" }
  >();
  for (const session of sessions)
    for (const e of session.data.exercises) {
      if (
        e.skipped ||
        (e.mode !== "strength" && e.mode !== "bodyweight") ||
        !e.sets.some((s) => !s.skipped && (s.reps ?? 0) > 0)
      )
        continue;
      const key = JSON.stringify([normalized(e.name), e.mode]);
      if (!choices.has(key))
        choices.set(key, { name: e.name.trim(), mode: e.mode });
    }
  return [...choices].sort((a, b) => a[1].name.localeCompare(b[1].name));
}
export function addWorkbookVideos(
  plan: Plan,
  imported: Plan,
): { plan: Plan; added: number } {
  const links = new Map<string, Set<string>>();
  for (const day of imported.days)
    for (const exercise of day.exercises) {
      const url = safeVideoUrl(exercise.videoUrl);
      if (!url) continue;
      const name = normalized(exercise.name);
      links.set(name, new Set([...(links.get(name) || []), url]));
    }
  let added = 0;
  const days = plan.days.map((day) => ({
    ...day,
    exercises: day.exercises.map((exercise) => {
      const urls = links.get(normalized(exercise.name));
      if (exercise.videoUrl || urls?.size !== 1) return exercise;
      added++;
      return { ...exercise, videoUrl: [...urls][0] };
    }),
  }));
  return { plan: { ...plan, days }, added };
}
export function previousExercise(
  sessions: Entry<"session">[],
  name: string,
  mode: Workout["exercises"][number]["mode"],
  date: string,
  editingId?: string,
) {
  const editing = sessions.find((s) => s.id === editingId);
  return [...sessions]
    .filter(
      (s) =>
        s.id !== editingId &&
        (s.date < date ||
          (s.date === date && (!editing || s.createdAt < editing.createdAt))),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    )
    .flatMap((s) =>
      s.data.exercises.filter(
        (e) =>
          !e.skipped &&
          e.mode === mode &&
          normalized(e.name) === normalized(name) &&
          e.sets.some(
            (set) =>
              !set.skipped &&
              (set.kg !== null ||
                set.reps !== null ||
                set.seconds !== null ||
                set.metres !== null),
          ),
      ),
    )[0];
}

export const emptySet = () => ({
  reps: null,
  kg: null,
  seconds: null,
  metres: null,
  effort: "",
  rest: "",
  skipped: false,
});
export function sessionFromPlan(
  plan: Entry<"plan">,
  dayIndex: number,
): Workout {
  const day = plan.data.days[dayIndex];
  return {
    title: `${day.day} · Week ${day.week}`,
    notes: "",
    planId: plan.id,
    planned: structuredClone(day.exercises),
    activityId: null,
    exercises: day.exercises.map((e) => ({
      name: e.name,
      mode: e.mode,
      skipped: false,
      sets: Array.from(
        { length: Math.min(20, parseInt(e.sets) || 1) },
        emptySet,
      ),
    })),
  };
}

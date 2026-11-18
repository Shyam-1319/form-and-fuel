import { type Entry, type Workout, type Plan, safeVideoUrl } from "./domain";

const normalized = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLowerCase();
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

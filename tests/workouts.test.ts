import { it, expect } from "vitest";
import {
  previousExercise,
  emptySet,
  addWorkbookVideos,
  exerciseProgress,
  progressExercises,
} from "../src/lib/workouts";
it("tracks exact movements chronologically and excludes skipped and incomplete sets", () => {
  const older = entry("older", "2026-01-01", 20);
  const newer = entry("newer", "2026-01-02", 25);
  newer.data.exercises[0].sets.push(
    { ...emptySet(), kg: 100, reps: 0 },
    { ...emptySet(), kg: 90, reps: 5, skipped: true },
    { ...emptySet(), reps: 12 },
  );
  const skipped = entry("skipped", "2026-01-03", 200, true);
  const other = entry("other", "2026-01-04", 300);
  other.data.exercises[0].name = "Test exercise variation";
  const points = exerciseProgress(
    [other, newer, skipped, older],
    "test exercise",
    "strength",
  );
  expect(points.map((p) => p.id)).toEqual(["older", "newer"]);
  expect(points[1]).toMatchObject({
    topKg: 25,
    topReps: 8,
    reps: 20,
    volume: 200,
  });
  expect(points[1].sets).toHaveLength(2);
  expect(progressExercises([older, newer, skipped, other])).toHaveLength(2);
});
it("keeps bodyweight and strength separate and preserves unknown weight", () => {
  const body = entry("body", "2026-01-01", null);
  body.data.exercises[0].mode = "bodyweight";
  body.data.exercises[0].sets[0].reps = 15;
  const strength = entry("strength", "2026-01-01", 0);
  expect(progressExercises([body, strength])).toHaveLength(2);
  expect(
    exerciseProgress([body, strength], "test exercise", "bodyweight")[0],
  ).toMatchObject({ topKg: null, reps: 15, volume: null });
  expect(
    exerciseProgress([body, strength], "test exercise", "strength")[0],
  ).toMatchObject({ topKg: 0, volume: 0 });
});
import { type Entry, emptyExercise, type Plan } from "../src/lib/domain";
it("adds only unambiguous missing workbook links without changing plan values", () => {
  const original: Plan = {
    title: "Plan",
    notes: "Keep",
    warnings: [],
    sourceNotes: ["Retained"],
    days: [
      {
        week: "1",
        day: "A",
        notes: "Keep day",
        exercises: [
          {
            ...emptyExercise(),
            name: "Movement",
            sets: "4",
            reps: "9",
            videoUrl: "",
          },
        ],
      },
    ],
  };
  const imported = structuredClone(original);
  imported.days[0].exercises[0].videoUrl = "https://example.test/video";
  const result = addWorkbookVideos(original, imported);
  expect(result.added).toBe(1);
  expect(result.plan.days[0].exercises[0]).toEqual({
    ...original.days[0].exercises[0],
    videoUrl: "https://example.test/video",
  });
  expect(original.days[0].exercises[0].videoUrl).toBe("");
  expect(addWorkbookVideos(result.plan, imported).added).toBe(0);
  imported.days[0].exercises.push({
    ...imported.days[0].exercises[0],
    videoUrl: "https://example.test/another",
  });
  expect(addWorkbookVideos(original, imported).added).toBe(0);
});
function entry(
  id: string,
  date: string,
  kg: number | null,
  skipped = false,
  createdAt = date + "T12:00:00Z",
): Entry<"session"> {
  return {
    id,
    kind: "session",
    date,
    createdAt,
    updatedAt: createdAt,
    data: {
      title: "Test",
      notes: "",
      planId: null,
      activityId: null,
      planned: [],
      exercises: [
        {
          name: "  Test   exercise ",
          mode: "strength",
          skipped,
          sets: [{ ...emptySet(), kg, reps: kg === null ? null : 8 }],
        },
      ],
    },
  };
}
it("uses the newest completed matching exercise, excluding future, skipped and blank sessions", () => {
  const sessions = [
    entry("old", "2026-11-01", 20),
    entry("future", "2026-12-01", 80),
    entry("skipped", "2026-11-15", 70, true),
    entry("blank", "2026-11-16", null),
    entry("latest", "2026-11-14", 30),
  ];
  expect(
    previousExercise(sessions, "test exercise", "strength", "2026-11-17")
      ?.sets[0].kg,
  ).toBe(30);
  expect(
    previousExercise(sessions, "test exercise", "bodyweight", "2026-11-17"),
  ).toBeUndefined();
  expect(
    previousExercise(sessions, "another exercise", "strength", "2026-11-17"),
  ).toBeUndefined();
});
it("does not use the session being edited or a later session on the same day", () => {
  const sessions = [
    entry("before", "2026-11-17", 20, false, "2026-11-17T08:00:00Z"),
    entry("editing", "2026-11-17", 30),
    entry("after", "2026-11-17", 40, false, "2026-11-17T16:00:00Z"),
  ];
  expect(
    previousExercise(
      sessions,
      "test exercise",
      "strength",
      "2026-11-17",
      "editing",
    )?.sets[0].kg,
  ).toBe(20);
});

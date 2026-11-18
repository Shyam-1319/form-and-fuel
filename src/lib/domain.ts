import { z } from "zod";

export const daySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Use a valid date",
  );
const text = z.string().trim().max(2000);
const positive = z.number().finite().min(0).max(100000);
export const nutrients = [
  "calories",
  "protein",
  "carbs",
  "fat",
  "fiber",
] as const;
export type Nutrient = (typeof nutrients)[number];
export const foodSchema = z.object({
  name: z.string().trim().min(1).max(160),
  quantity: z.number().positive().max(10000),
  unit: z.string().trim().min(1).max(30),
  calories: positive,
  protein: positive,
  carbs: positive,
  fat: positive,
  fiber: positive,
});
export type Food = z.infer<typeof foodSchema>;
export const mealSchema = z.object({
  title: z.string().trim().min(1).max(160),
  category: z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  foods: z.array(foodSchema).min(1).max(40),
  notes: text.default(""),
  source: z.enum(["manual", "ai", "copy", "recipe"]).default("manual"),
  assumptions: text.default(""),
});
export const recipeSchema = z.object({
  title: z.string().trim().min(1).max(160),
  servings: z.number().positive().max(1000),
  foods: z.array(foodSchema).min(1).max(40),
  notes: text.default(""),
});
export const regions = [
  "Neck",
  "Shoulders",
  "Chest",
  "Waist",
  "Hips",
  "Upper arm",
  "Forearm",
  "Thigh",
  "Calf",
] as const;
export const measurementSchema = z
  .object({
    region: z.enum(regions),
    side: z.enum(["Centre", "Left", "Right"]),
    cm: z.number().positive().max(400),
    notes: text.default(""),
  })
  .refine(
    (v) =>
      ["Upper arm", "Forearm", "Thigh", "Calf"].includes(v.region)
        ? v.side !== "Centre"
        : v.side === "Centre",
    "Choose a valid side for this region",
  );
export const exerciseSchema = z.object({
  name: z.string().min(1).max(160),
  videoUrl: z
    .string()
    .max(2048)
    .refine(
      (value) => !value || safeVideoUrl(value) !== "",
      "Use an http or https demonstration link",
    )
    .default(""),
  mode: z
    .enum(["strength", "bodyweight", "cardio", "other"])
    .default("strength"),
  sets: z.string().max(40).default("3"),
  reps: z.string().max(80).default("8–12"),
  load: z.string().max(80).default(""),
  duration: z.string().max(80).default(""),
  distance: z.string().max(80).default(""),
  rest: z.string().max(80).default(""),
  tempo: z.string().max(80).default(""),
  effort: z.string().max(80).default(""),
  group: z.string().max(80).default(""),
  instructions: text.default(""),
  alternatives: text.default(""),
});
export function safeVideoUrl(value: string | undefined): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}
export const planSchema = z.object({
  title: z.string().min(1).max(160),
  notes: text.default(""),
  days: z
    .array(
      z.object({
        week: z.string().max(80),
        day: z.string().max(80),
        notes: text.default(""),
        exercises: z.array(exerciseSchema).max(100),
      }),
    )
    .min(1)
    .max(100),
  sourceNotes: z.array(z.string().max(4000)).max(1000).default([]),
  warnings: z.array(z.string().max(1000)).max(100).default([]),
});
const actualSet = z.object({
  reps: positive.nullable(),
  kg: positive.nullable(),
  seconds: positive.nullable(),
  metres: positive.nullable(),
  effort: z.string().max(40),
  rest: z.string().max(40),
  skipped: z.boolean(),
});
export const sessionSchema = z.object({
  title: z.string().min(1).max(160),
  notes: text.default(""),
  planId: z.string().nullable().default(null),
  planned: z.array(exerciseSchema).max(100).default([]),
  exercises: z
    .array(
      z.object({
        name: z.string().min(1).max(160),
        mode: z.enum(["strength", "bodyweight", "cardio", "other"]),
        sets: z.array(actualSet).max(100),
        skipped: z.boolean().default(false),
      }),
    )
    .max(100),
  activityId: z.string().max(100).nullable().default(null),
});
export const settingsSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  timezone: z.string().refine((t) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: t });
      return true;
    } catch {
      return false;
    }
  }, "Use an IANA timezone"),
  units: z.enum(["metric", "imperial"]),
  goals: text,
  preferences: text,
  allergies: text,
  targets: z.object({
    calories: z.number().min(500).max(10000),
    protein: positive,
    carbs: positive,
    fat: positive,
    fiber: positive,
    water: z.number().min(100).max(10000),
  }),
  heightCm: z.number().positive().max(300).nullable(),
  targetWeightKg: z.number().positive().max(500).nullable(),
  onboarded: z.boolean(),
});
export const editableSchemas = {
  meal: mealSchema,
  recipe: recipeSchema,
  weight: z.object({
    kg: z.number().positive().max(500),
    notes: text.default(""),
  }),
  water: z.object({ ml: z.number().positive().max(10000) }),
  measurement: measurementSchema,
  plan: planSchema,
  session: sessionSchema,
};
export type EditableKind = keyof typeof editableSchemas;
export type Kind = EditableKind | "wellness" | "activity";
export type Meal = z.infer<typeof mealSchema>;
export type Plan = z.infer<typeof planSchema>;
export type Workout = z.infer<typeof sessionSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Measurement = z.infer<typeof measurementSchema>;
export type Wellness = {
  sleepSeconds: number | null;
  sleepScore: number | null;
  steps: number | null;
  restingHR: number | null;
  hrv: { value: number; type: "rMSSD" | "SDNN"; unit: "ms" }[];
  workoutCalories: null;
  activeCalories: null;
  totalExpenditure: null;
  sourceDate: string;
  fetchedAt: string;
};
export type Activity = {
  name: string;
  type: string;
  start: string;
  seconds: number | null;
  metres: number | null;
  averageHR: number | null;
  maxHR: number | null;
  workoutCalories: number | null;
  trainingLoad: number | null;
  sourceId: string;
  fetchedAt: string;
};
export type DataByKind = {
  [K in EditableKind]: z.infer<(typeof editableSchemas)[K]>;
} & { wellness: Wellness; activity: Activity };
export type Entry<K extends Kind = Kind> = {
  id: string;
  kind: K;
  date: string;
  data: DataByKind[K];
  createdAt: string;
  updatedAt: string;
};
export const defaults: Settings = {
  displayName: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  units: "metric",
  goals: "",
  preferences: "",
  allergies: "",
  targets: {
    calories: 2000,
    protein: 100,
    carbs: 250,
    fat: 65,
    fiber: 30,
    water: 2000,
  },
  heightCm: null,
  targetWeightKg: null,
  onboarded: false,
};
export function dayInZone(date = new Date(), zone = "UTC") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function addDays(day: string, count: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + count);
  return d.toISOString().slice(0, 10);
}
export function totals(foods: Food[]) {
  return Object.fromEntries(
    nutrients.map((n) => [n, foods.reduce((s, f) => s + f[n], 0)]),
  ) as Record<Nutrient, number>;
}
export function scaleFoods(foods: Food[], factor: number): Food[] {
  if (!Number.isFinite(factor) || factor <= 0)
    throw new Error("Invalid servings");
  return foods.map((f) => ({
    ...f,
    quantity: f.quantity * factor,
    ...Object.fromEntries(
      nutrients.map((n) => [n, Math.round(f[n] * factor * 100) / 100]),
    ),
  }));
}
export function cmToIn(cm: number) {
  return cm / 2.54;
}
export function inToCm(inches: number) {
  return inches * 2.54;
}
export function kgToLb(kg: number) {
  return kg / 0.45359237;
}
export function lbToKg(lb: number) {
  return lb * 0.45359237;
}
export function volume(session: Workout) {
  return session.exercises.reduce(
    (sum, e) =>
      sum +
      (e.mode === "strength" && !e.skipped
        ? e.sets.reduce(
            (s, t) =>
              s +
              (!t.skipped && (t.kg ?? 0) > 0 ? (t.kg ?? 0) * (t.reps ?? 0) : 0),
            0,
          )
        : 0),
    0,
  );
}
export const emptyFood = (): Food => ({
  name: "",
  quantity: 1,
  unit: "serving",
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
});
export const emptyExercise = () =>
  exerciseSchema.parse({ name: "New exercise" });

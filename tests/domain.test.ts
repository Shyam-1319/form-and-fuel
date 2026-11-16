import { describe, it, expect } from "vitest";
import {
  dayInZone,
  scaleFoods,
  totals,
  cmToIn,
  inToCm,
  lbToKg,
  kgToLb,
  volume,
  emptyExercise,
  sessionSchema,
  mealSchema,
} from "../src/lib/domain";
import { normalizeWellness, normalizeActivity } from "../server/intervals";
import { encrypt, decrypt } from "../server/crypto";
import { suggestMapping, mapWorkbook, readWorkbook } from "../src/lib/importer";
import { readFile } from "node:fs/promises";
const food = {
  name: "Test oats",
  quantity: 2,
  unit: "serving",
  calories: 400,
  protein: 12,
  carbs: 65,
  fat: 8,
  fiber: 9,
};
describe("deterministic health calculations", () => {
  it("scales a recipe by serving fraction without mutating the template", () => {
    const scaled = scaleFoods([food], 0.5);
    expect(totals(scaled).calories).toBe(200);
    expect(scaled[0].quantity).toBe(1);
    expect(food.calories).toBe(400);
    expect(() => scaleFoods([food], 0)).toThrow();
  });
  it("uses the user timezone across UTC and DST boundaries", () => {
    expect(
      dayInZone(new Date("2026-01-01T00:30:00Z"), "America/Los_Angeles"),
    ).toBe("2025-12-31");
    expect(dayInZone(new Date("2026-01-01T20:00:00Z"), "Asia/Kolkata")).toBe(
      "2026-01-02",
    );
    expect(
      dayInZone(new Date("2026-03-08T09:30:00Z"), "America/Los_Angeles"),
    ).toBe("2026-03-08");
  });
  it("round-trips measurement and weight units", () => {
    expect(inToCm(cmToIn(79.5))).toBeCloseTo(79.5);
    expect(lbToKg(kgToLb(72.3))).toBeCloseTo(72.3);
  });
  it("excludes bodyweight, cardio and skipped sets from external-load volume", () => {
    const session = sessionSchema.parse({
      title: "Test",
      exercises: [
        {
          name: "Squat",
          mode: "strength",
          sets: [
            {
              reps: 10,
              kg: 20,
              seconds: null,
              metres: null,
              effort: "",
              rest: "",
              skipped: false,
            },
            {
              reps: 10,
              kg: 50,
              seconds: null,
              metres: null,
              effort: "",
              rest: "",
              skipped: true,
            },
          ],
        },
        {
          name: "Push-up",
          mode: "bodyweight",
          sets: [
            {
              reps: 10,
              kg: 72,
              seconds: null,
              metres: null,
              effort: "",
              rest: "",
              skipped: false,
            },
          ],
        },
      ],
    });
    expect(volume(session)).toBe(200);
  });
  it("rejects invalid nutrition rather than accepting an AI payload", () => {
    expect(() =>
      mealSchema.parse({
        title: "Meal",
        category: "Lunch",
        time: "12:00",
        foods: [{ ...food, calories: -1 }],
      }),
    ).toThrow();
  });
});
describe("wearable normalization", () => {
  it("preserves zero versus missing and separate HRV types", () => {
    const record = normalizeWellness(
      { id: "2026-11-01", steps: 0, hrv: 52, hrvSDNN: 71 },
      "2026-11-03T00:00:00Z",
    );
    expect(record.steps).toBe(0);
    expect(record.sleepSeconds).toBeNull();
    expect(record.hrv).toEqual([
      { value: 52, type: "rMSSD", unit: "ms" },
      { value: 71, type: "SDNN", unit: "ms" },
    ]);
    expect(record.sourceDate).toBe("2026-11-01");
    expect(record.fetchedAt).toContain("11-03");
  });
  it("does not invent energy aggregates or readiness", () => {
    const w = normalizeWellness(
      { id: "2026-11-01", calories: 2000, bioCharge: 80 },
      "now",
    );
    expect(w.totalExpenditure).toBeNull();
    expect("bioCharge" in w).toBe(false);
    const a = normalizeActivity(
      { id: "a1", start_date_local: "2026-11-01T12:00:00", calories: 350 },
      "now",
    );
    expect(a.workoutCalories).toBe(350);
    expect(a.seconds).toBeNull();
  });
  it("encrypts credentials and binds them to the owner", async () => {
    const key = btoa(
      String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
    );
    const encrypted = await encrypt("synthetic-api-key", key, "owner");
    expect(encrypted).not.toContain("synthetic-api-key");
    expect(await decrypt(encrypted, key, "owner")).toBe("synthetic-api-key");
    await expect(decrypt(encrypted, key, "another-user")).rejects.toThrow();
  });
});
describe("reviewed workbook import", () => {
  it("preserves expressions, sections and notes outside tables", () => {
    const book = {
      sheets: [
        {
          name: "Week one",
          merged: ["A1:D1"],
          rows: [
            ["Warm up first"],
            ["Week", "Day", "Exercise", "Reps"],
            ["1", "A", "Squat", "8–12"],
            ["", "", "Push-up", "AMRAP"],
            ["A note outside the table"],
          ],
        },
        { name: "Notes", merged: [], rows: [["Keep training comfortable"]] },
      ],
      warnings: [],
    };
    const result = mapWorkbook(book, book.sheets.map(suggestMapping), "Plan");
    expect(result.days[0].exercises.map((e) => e.reps)).toEqual([
      "8–12",
      "AMRAP",
    ]);
    expect(result.sourceNotes.join("\n")).toContain("A note outside");
    expect(result.sourceNotes.join("\n")).toContain(
      "Keep training comfortable",
    );
    expect(result.warnings.length).toBeGreaterThan(0);
  });
  it("reads the real synthetic multi-sheet XLSX without losing merged headings", async () => {
    const bytes = await readFile("public/samples/strength-plan.xlsx");
    const book = await readWorkbook(new File([bytes], "plan.xlsx"));
    expect(book.sheets.length).toBe(2);
    expect(book.sheets[0].merged).toContain("A1:H1");
    expect(book.sheets[0].rows.flat().join(" ")).toContain(
      "Outside-table note",
    );
  });
  it("does not mutate the planned snapshot when a plan is changed", () => {
    const planned = [{ ...emptyExercise(), name: "Squat", reps: "8–12" }];
    const snapshot = structuredClone(planned);
    planned[0].reps = "20";
    expect(snapshot[0].reps).toBe("8–12");
  });
});

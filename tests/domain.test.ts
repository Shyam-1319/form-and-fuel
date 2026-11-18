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
  planSchema,
  safeVideoUrl,
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
  it("rejects executable or credential-bearing demonstration links", () => {
    expect(safeVideoUrl("javascript:alert(1)")).toBe("");
    expect(safeVideoUrl("data:text/html,test")).toBe("");
    expect(safeVideoUrl("https://user:password@example.test/demo")).toBe("");
    expect(safeVideoUrl("https://youtu.be/example")).toBe(
      "https://youtu.be/example",
    );
  });
  it("groups repeated week sections and merged day labels without importing headers as exercises", async () => {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Training");
    sheet.addRows([
      ["Week 1", "Exercise", "Working Sets", "Rep Range"],
      [
        "Day A",
        { text: "Movement A", hyperlink: "https://example.test/demo" },
        2,
        new Date("2025-06-08T00:00:00Z"),
      ],
      [null, "Movement B", 1, "AMRAP"],
      ["Rest Day"],
      ["Day B", "Movement C", 2, "10-12"],
      ["Week 2", "Exercise", "Working Sets", "Rep Range"],
      ["Day A", "Movement A", 2, "6-8"],
      ["Day B", "Movement C", 2, "10-12"],
    ]);
    sheet.mergeCells("A2:A3");
    sheet.getCell("D2").numFmt = "m-d";
    const bytes = await workbook.xlsx.writeBuffer();
    const book = await readWorkbook(
      new File([new Uint8Array(bytes)], "sections.xlsx"),
    );
    const plan = mapWorkbook(book, book.sheets.map(suggestMapping), "Training");
    expect(planSchema.safeParse(plan).success).toBe(true);
    expect(plan.days.map((d) => [d.week, d.day, d.exercises.length])).toEqual([
      ["1", "Day A", 2],
      ["1", "Day B", 1],
      ["2", "Day A", 1],
      ["2", "Day B", 1],
    ]);
    expect(plan.days[0].exercises[0]).toMatchObject({
      sets: "2",
      reps: "6-8",
      videoUrl: "https://example.test/demo",
    });
    expect(plan.days[0].exercises[1].reps).toBe("AMRAP");
    expect(plan.sourceNotes.join("\n")).toContain("Week 2 | Exercise");
    expect(plan.sourceNotes.join("\n")).toContain("Rest Day");
  });
  it("ignores formatting-only tails while preserving source row numbers and merged notes", async () => {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Training");
    sheet.getCell("A1").value = "Warm up first";
    sheet.mergeCells("A1:AZ1");
    sheet.getCell("A3").value = "Exercise";
    sheet.getCell("B3").value = "Reps";
    sheet.getCell("A4").value = "Squat";
    sheet.getCell("B4").value = "8–12";
    sheet.getCell("AX4").font = { bold: true };
    sheet.getCell("A2000").font = { bold: true };
    const bytes = await workbook.xlsx.writeBuffer();
    const book = await readWorkbook(
      new File([new Uint8Array(bytes)], "formatted.xlsx"),
    );
    expect(book.sheets[0].rows).toEqual([
      ["Warm up first"],
      [],
      ["Exercise", "Reps"],
      ["Squat", "8–12"],
    ]);
    expect(book.sheets[0].merged).toContain("A1:AZ1");
    const plan = mapWorkbook(book, book.sheets.map(suggestMapping), "Training");
    expect(plan.days[0].exercises[0].reps).toBe("8–12");
    expect(plan.sourceNotes.join("\n")).toContain(
      "Training row 4: Squat | 8–12",
    );
  });
  it("ignores empty CSV tails without dropping content or moving columns", async () => {
    const book = await readWorkbook(
      new File(["Exercise,,Reps,,,\nSquat,,8,,,\n,,,,,\n"], "plan.csv"),
    );
    expect(book.sheets[0].rows).toEqual([
      ["Exercise", "", "Reps"],
      ["Squat", "", "8"],
    ]);
  });
  it("reports the actual content limit instead of silently truncating", async () => {
    await expect(
      readWorkbook(new File(["x".repeat(3501)], "notes.csv")),
    ).rejects.toThrow("row 1 exceeds 3,500 characters");
    await expect(
      readWorkbook(new File([",".repeat(40) + "Exercise"], "wide.csv")),
    ).rejects.toThrow("content in column 41");
    await expect(
      readWorkbook(
        new File([Array(1001).fill("Exercise").join("\n")], "long.csv"),
      ),
    ).rejects.toThrow("1,001 rows");
  });
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

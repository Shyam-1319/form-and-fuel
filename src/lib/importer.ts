import type { Plan } from "./domain";
import { emptyExercise } from "./domain";
export type Sheet = { name: string; rows: string[][]; merged: string[] };
export type Workbook = { sheets: Sheet[]; warnings: string[] };
export const columns = [
  "name",
  "week",
  "day",
  "sets",
  "reps",
  "load",
  "duration",
  "distance",
  "rest",
  "tempo",
  "effort",
  "group",
  "instructions",
  "alternatives",
] as const;
export type Mapping = {
  header: number;
  columns: Partial<Record<(typeof columns)[number], number>>;
};
function cell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") {
    if ("formula" in value)
      return `[Formula retained, not evaluated: ${String(value.formula)}]`;
    if ("sharedFormula" in value)
      return "[Shared formula retained; not evaluated]";
    if ("richText" in value && Array.isArray(value.richText))
      return value.richText.map((v) => String(v.text || "")).join("");
    if ("text" in value) return String(value.text);
  }
  return String(value);
}
export async function readWorkbook(file: File): Promise<Workbook> {
  if (file.size > 2 * 1024 * 1024)
    throw new Error("Use a file smaller than 2 MB");
  const warnings: string[] = [];
  let sheets: Sheet[];
  if (/\.csv$/i.test(file.name)) {
    const Papa = (await import("papaparse")).default;
    const parsed = Papa.parse<string[]>(await file.text(), {
      skipEmptyLines: false,
    });
    warnings.push(...parsed.errors.map((e) => e.message));
    sheets = [{ name: file.name, rows: parsed.data, merged: [] }];
  } else if (/\.xlsx$/i.test(file.name)) {
    const bytes = await file.arrayBuffer();
    const view = new DataView(bytes);
    let expanded = 0;
    for (let i = 0; i + 46 < view.byteLength; i++) {
      if (view.getUint32(i, true) === 0x02014b50) {
        expanded += view.getUint32(i + 24, true);
        i +=
          45 +
          view.getUint16(i + 28, true) +
          view.getUint16(i + 30, true) +
          view.getUint16(i + 32, true);
      }
    }
    if (expanded > 20 * 1024 * 1024)
      throw new Error("Expanded workbook exceeds 20 MB");
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    sheets = workbook.worksheets.map((ws) => {
      const rows: string[][] = [];
      ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const cells: string[] = [];
        row.eachCell({ includeEmpty: false }, (c, n) => {
          // A merged heading is retained once, with its range in merged metadata.
          if (c.isMerged && c.master.address !== c.address) return;
          const text = cell(c.value);
          if (text.trim()) cells[n - 1] = text;
        });
        // Preserve original row/column positions, but ignore formatting-only tails.
        if (cells.length) rows[rowNumber - 1] = cells;
      });
      return {
        name: ws.name,
        rows: Array.from({ length: rows.length }, (_, i) => rows[i] || []),
        merged: (ws.model.merges || []).map(String),
      };
    });
  } else
    throw new Error(
      "Choose an .xlsx or .csv file. Macro-enabled files are not supported.",
    );
  for (const sheet of sheets) {
    sheet.rows = sheet.rows.map((row) => {
      let end = row.length;
      while (end > 0 && !(row[end - 1] || "").trim()) end--;
      return Array.from({ length: end }, (_, i) => row[i] || "");
    });
    while (sheet.rows.length && !sheet.rows[sheet.rows.length - 1].length)
      sheet.rows.pop();
  }
  if (sheets.length > 20)
    throw new Error(
      `This workbook has ${sheets.length} sheets; the limit is 20. Split it into smaller files.`,
    );
  const rowCount = sheets.reduce((n, s) => n + s.rows.length, 0);
  if (rowCount > 1000)
    throw new Error(
      `This workbook uses ${rowCount.toLocaleString("en-US")} rows across all sheets; the limit is 1,000. Blank rows between content are included. Split it into smaller files.`,
    );
  for (const sheet of sheets) {
    sheet.rows.forEach((row, i) => {
      if (row.length > 40)
        throw new Error(
          `Sheet "${sheet.name}", row ${i + 1} contains content in column ${row.length}; the limit is 40 columns. Move that content into the first 40 columns or split the sheet.`,
        );
      if (row.join(" | ").length > 3500)
        throw new Error(
          `Sheet "${sheet.name}", row ${i + 1} exceeds 3,500 characters. Split long notes across rows.`,
        );
    });
  }
  if (
    sheets.some((s) =>
      s.rows.some((r) => r.some((c) => c.startsWith("[Formula"))),
    )
  )
    warnings.push(
      "Formulas are retained as text and never evaluated. Enter intended values in the preview.",
    );
  warnings.push(
    "Interpretation is a draft. Review every day and the retained source notes before saving.",
  );
  return { sheets, warnings };
}
const aliases: Record<string, string[]> = {
  name: ["exercise", "movement", "name"],
  week: ["week"],
  day: ["day", "session"],
  sets: ["sets"],
  reps: ["reps", "repetitions"],
  load: ["load", "weight"],
  duration: ["duration", "time"],
  distance: ["distance"],
  rest: ["rest"],
  tempo: ["tempo"],
  effort: ["rpe", "rir", "effort"],
  group: ["superset", "circuit", "group"],
  instructions: ["instructions", "notes"],
  alternatives: ["alternatives", "alternative"],
};
export function suggestMapping(sheet: Sheet): Mapping {
  let header = sheet.rows.findIndex((row) =>
    row.some((c) => aliases.name.includes(c.trim().toLowerCase())),
  );
  if (header < 0) header = 0;
  const mapping: Mapping = { header, columns: {} };
  for (const column of columns) {
    const i = (sheet.rows[header] || []).findIndex((c) =>
      aliases[column].includes(c.trim().toLowerCase()),
    );
    if (i >= 0) mapping.columns[column] = i;
  }
  return mapping;
}
export function mapWorkbook(
  workbook: Workbook,
  mappings: Mapping[],
  title: string,
): Plan {
  const days: Plan["days"] = [];
  const sourceNotes: string[] = [];
  const warnings = [...workbook.warnings];
  workbook.sheets.forEach((sheet, index) => {
    const map = mappings[index];
    let week = "1",
      day = sheet.name;
    sourceNotes.push(
      `Sheet: ${sheet.name}. Merged headings: ${sheet.merged.join(", ") || "none"}`,
    );
    sheet.rows.forEach((row, rowIndex) => {
      if (!row.some(Boolean)) return;
      sourceNotes.push(`${sheet.name} row ${rowIndex + 1}: ${row.join(" | ")}`);
      if (rowIndex <= map.header) return;
      const field = (key: (typeof columns)[number]) =>
        map.columns[key] === undefined
          ? ""
          : (row[map.columns[key]!] || "").trim();
      week = field("week") || week;
      day = field("day") || day;
      const name = field("name");
      if (!name) {
        warnings.push(
          `Unmapped content retained: ${sheet.name}, row ${rowIndex + 1}`,
        );
        return;
      }
      let target = days.find((d) => d.week === week && d.day === day);
      if (!target) {
        target = { week, day, notes: "", exercises: [] };
        days.push(target);
      }
      const exercise = emptyExercise();
      for (const key of columns) {
        if (key !== "week" && key !== "day") {
          const value = field(key);
          if (value) exercise[key] = value;
        }
      }
      target.exercises.push(exercise);
    });
  });
  if (days.length === 0)
    throw new Error(
      "Map an exercise-name column and select the header row to continue.",
    );
  if (sourceNotes.length > 1000)
    throw new Error("Too many source notes. Split the workbook.");
  return {
    title,
    notes:
      "Imported plan. Exercise mode defaults to strength; review cardio and bodyweight movements.",
    days,
    sourceNotes,
    warnings: warnings.slice(0, 99),
  };
}

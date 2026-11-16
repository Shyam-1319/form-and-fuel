import ExcelJS from "exceljs";
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("public/samples", { recursive: true });
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet("Week 1");
sheet.mergeCells("A1:H1");
sheet.getCell("A1").value = "SYNTHETIC DEMO · Foundations";
sheet.getCell("A2").value =
  "Warm up for 5–10 minutes. Work within a comfortable range.";
sheet.addRow([
  "Week",
  "Day",
  "Exercise",
  "Sets",
  "Reps",
  "Load",
  "Rest",
  "Notes",
]);
sheet.addRow([
  "1",
  "A",
  "Goblet squat",
  "3",
  "8–12",
  "20 kg",
  "90 s",
  "Use controlled tempo",
]);
sheet.addRow([
  "1",
  "A",
  "Dumbbell row",
  "3",
  "10 each",
  "14 kg",
  "60 s",
  "Superset A1",
]);
sheet.addRow([
  "1",
  "B",
  "Push-up",
  "3",
  "AMRAP",
  "Bodyweight",
  "90 s",
  "Stop with 2 reps in reserve",
]);
sheet.getCell("A8").value =
  "Outside-table note: swap any uncomfortable movement for an appropriate alternative.";
const second = workbook.addWorksheet("Progression notes");
second.addRow([
  "Progress gradually. This is a fictional workbook for demonstrating import review.",
]);
second.addRow([
  "Week",
  "Day",
  "Exercise",
  "Sets",
  "Reps",
  "Load",
  "Rest",
  "Notes",
]);
second.addRow([
  "2",
  "A",
  "Goblet squat",
  "3",
  "8–12",
  "22 kg",
  "90 s",
  "Only if comfortable",
]);
await workbook.xlsx.writeFile("public/samples/strength-plan.xlsx");
writeFileSync(
  "public/samples/strength-plan.csv",
  "Week,Day,Exercise,Sets,Reps,Load,Rest,Notes\n1,A,Goblet squat,3,8–12,20 kg,90 s,Synthetic sample\n1,A,Push-up,3,AMRAP,Bodyweight,60 s,Review exercise mode\n",
);
console.log("Generated synthetic import examples.");

import {
  addDays,
  dayInZone,
  defaults,
  emptyExercise,
  type Entry,
  type Settings,
  type Kind,
  type DataByKind,
} from "./domain";
export function demoData(): { settings: Settings; entries: Entry[] } {
  const today = dayInZone();
  const settings: Settings = {
    ...defaults,
    displayName: "Alex",
    timezone: "UTC",
    onboarded: true,
    goals: "Build a consistent routine",
    preferences: "Mostly vegetarian",
    targets: {
      calories: 2200,
      protein: 140,
      carbs: 260,
      fat: 70,
      fiber: 30,
      water: 2500,
    },
  };
  const entries: Entry[] = [];
  const add = <K extends Kind>(kind: K, date: string, data: DataByKind[K]) => {
    const entry = {
      id: crypto.randomUUID(),
      kind,
      date,
      data,
      createdAt: `${date}T00:00:00Z`,
      updatedAt: `${date}T00:00:00Z`,
    };
    entries.push(entry);
    return entry.id;
  };
  for (let i = 20; i >= 0; i--) {
    if (i === 11 || i === 16) continue;
    const date = addDays(today, -i);
    add("meal", date, {
      title: "Yogurt, berries & granola",
      category: "Breakfast",
      time: "08:30",
      foods: [
        {
          name: "Greek yogurt bowl",
          quantity: 1,
          unit: "bowl",
          calories: 425,
          protein: 29,
          carbs: 51,
          fat: 12,
          fiber: 7,
        },
      ],
      notes: "",
      source: "manual",
      assumptions: "",
    });
    add("meal", date, {
      title: "Roasted vegetable grain bowl",
      category: "Lunch",
      time: "13:15",
      foods: [
        {
          name: "Quinoa, chickpeas & vegetables",
          quantity: 1,
          unit: "bowl",
          calories: 640 + (i % 4) * 30,
          protein: 32,
          carbs: 78,
          fat: 22,
          fiber: 13,
        },
      ],
      notes: "",
      source: "manual",
      assumptions: "",
    });
    if (i > 0)
      add("meal", date, {
        title: "Tofu & sesame rice",
        category: "Dinner",
        time: "19:30",
        foods: [
          {
            name: "Tofu rice bowl",
            quantity: 1,
            unit: "plate",
            calories: 780,
            protein: 43,
            carbs: 94,
            fat: 24,
            fiber: 8,
          },
        ],
        notes: "",
        source: "manual",
        assumptions: "",
      });
    add("water", date, { ml: i === 0 ? 1500 : 2000 + (i % 3) * 250 });
    if (i % 3 === 0) add("weight", date, { kg: 73.2 + i * 0.045, notes: "" });
    add("wellness", date, {
      sleepSeconds: 25000 + (i % 4) * 1300,
      sleepScore: null,
      steps: i === 4 ? null : 6500 + (i % 5) * 830,
      restingHR: 54 + (i % 4),
      hrv: [{ value: 58 + (i % 6) * 3, type: "rMSSD", unit: "ms" }],
      workoutCalories: null,
      activeCalories: null,
      totalExpenditure: null,
      sourceDate: date,
      fetchedAt: `${date}T09:15:00Z`,
    });
  }
  for (const [region, cm] of [
    ["Waist", 79.5],
    ["Chest", 96],
    ["Hips", 94],
    ["Shoulders", 112],
    ["Neck", 36],
    ["Upper arm", 32],
    ["Forearm", 27],
    ["Thigh", 54],
    ["Calf", 36],
  ] as const) {
    for (let i = 3; i >= 0; i--) {
      const sides = ["Upper arm", "Forearm", "Thigh", "Calf"].includes(region)
        ? (["Left", "Right"] as const)
        : (["Centre"] as const);
      for (const side of sides)
        add("measurement", addDays(today, -i * 7), {
          region,
          side,
          cm: cm + i * 0.3 + (side === "Left" ? 0.2 : 0),
          notes: "",
        });
    }
  }
  const plan = {
    title: "Foundations · 3-day strength",
    notes: "A simple full-body routine. Move at your own pace.",
    days: [
      {
        week: "1",
        day: "Day A · Full body",
        notes: "Warm up for 5–10 minutes.",
        exercises: [
          {
            ...emptyExercise(),
            name: "Goblet squat",
            sets: "3",
            reps: "8–12",
            load: "20 kg",
            rest: "90 s",
          },
          {
            ...emptyExercise(),
            name: "Dumbbell row",
            sets: "3",
            reps: "10 each",
            load: "14 kg",
            rest: "60 s",
          },
          {
            ...emptyExercise(),
            name: "Push-up",
            mode: "bodyweight" as const,
            sets: "3",
            reps: "AMRAP",
            load: "Bodyweight",
          },
        ],
      },
    ],
    sourceNotes: [],
    warnings: [],
  };
  const planId = add("plan", today, plan);
  for (let i = 2; i < 15; i += 4) {
    const date = addDays(today, -i);
    const activityId = add("activity", date, {
      name: "Afternoon strength",
      type: "WeightTraining",
      start: `${date}T17:00:00`,
      seconds: 2850,
      metres: null,
      averageHR: 113,
      maxHR: 142,
      workoutCalories: 265,
      trainingLoad: 26,
      sourceId: `demo-${i}`,
      fetchedAt: `${date}T18:00:00Z`,
    });
    add("session", date, {
      title: "Full body · Day A",
      notes: "Steady effort.",
      planId,
      planned: plan.days[0].exercises,
      exercises: plan.days[0].exercises.map((e) => ({
        name: e.name,
        mode: e.mode,
        skipped: false,
        sets: Array.from({ length: 3 }, () => ({
          reps: 10,
          kg: e.mode === "strength" ? 20 : null,
          seconds: null,
          metres: null,
          effort: "RPE 7",
          rest: "90 s",
          skipped: false,
        })),
      })),
      activityId,
    });
  }
  add("recipe", today, {
    title: "My yogurt bowl",
    favourite: true,
    category: "Breakfast",
    servings: 1,
    foods: [
      {
        name: "Yogurt, granola & berries",
        quantity: 1,
        unit: "bowl",
        calories: 425,
        protein: 29,
        carbs: 51,
        fat: 12,
        fiber: 7,
      },
    ],
    notes: "Add berries just before eating.",
  });
  return { settings, entries };
}

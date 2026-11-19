import { expect, it } from "vitest";
import { recipeMeal, recentMeals } from "../src/lib/meals";
import { recipeSchema, type Entry } from "../src/lib/domain";

it("loads old recipes and scales favourite servings without losing estimate notes", () => {
  const recipe = recipeSchema.parse({
    title: "Yogurt bowls",
    servings: 2,
    foods: [
      {
        name: "Yogurt",
        quantity: 400,
        unit: "g",
        calories: 240,
        protein: 20,
        carbs: 24,
        fat: 8,
        fiber: 0,
      },
    ],
    notes: "Plain",
    assumptions: "Estimated portions",
    category: "Snack",
    favourite: true,
  });
  const meal = recipeMeal(recipe);
  expect(meal).toMatchObject({
    category: "Snack",
    assumptions: "Estimated portions",
    source: "recipe",
  });
  expect(meal.foods[0]).toMatchObject({
    quantity: 200,
    calories: 120,
    protein: 10,
  });
  expect(recipe.foods[0].calories).toBe(240);
  const legacy = {
    title: recipe.title,
    foods: recipe.foods,
    servings: 2,
    notes: "",
  };
  expect(recipeMeal(legacy)).toMatchObject({
    category: "Breakfast",
    assumptions: "",
  });
});

it("recent meals prefer the latest identical portion but keep different portions", () => {
  const data = recipeMeal({
    title: "Oats",
    servings: 1,
    notes: "",
    foods: [
      {
        name: "Oats",
        quantity: 1,
        unit: "bowl",
        calories: 300,
        protein: 10,
        carbs: 50,
        fat: 5,
        fiber: 7,
      },
    ],
  });
  const old: Entry<"meal"> = {
    id: "old",
    kind: "meal",
    date: "2026-01-01",
    data,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };
  const latest = { ...old, id: "latest", date: "2026-01-03" };
  const other = {
    ...old,
    id: "other",
    date: "2026-01-02",
    data: {
      ...data,
      foods: [{ ...data.foods[0], quantity: 2, calories: 600 }],
    },
  };
  expect(recentMeals([old, other, latest]).map((m) => m.id)).toEqual([
    "latest",
    "other",
  ]);
});

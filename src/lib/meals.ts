import { mealSchema, scaleFoods, type Entry, type Meal } from "./domain";

export function recipeMeal(
  recipe: Entry<"recipe">["data"],
  servings = 1,
): Meal {
  return mealSchema.parse({
    title: recipe.title,
    category: recipe.category || "Breakfast",
    time: "08:00",
    foods: scaleFoods(recipe.foods, servings / recipe.servings),
    source: "recipe",
    notes: recipe.notes,
    assumptions: recipe.assumptions || "",
  });
}

export function recentMeals(meals: Entry<"meal">[]): Entry<"meal">[] {
  const seen = new Set<string>();
  return [...meals]
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.data.time.localeCompare(a.data.time) ||
        b.createdAt.localeCompare(a.createdAt),
    )
    .filter((meal) => {
      const key = JSON.stringify([meal.data.title, meal.data.foods]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

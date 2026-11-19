import { useState } from "react";
import { Star, RotateCcw } from "lucide-react";
import { useData, useEntries } from "../lib/store";
import {
  dayInZone,
  mealSchema,
  recipeSchema,
  totals,
  type Meal,
} from "../lib/domain";
import { recentMeals, recipeMeal } from "../lib/meals";
import { Action, Card, Field, fmt } from "./ui";

export function SaveFavourite({ meal }: { meal: Meal }) {
  const { save, settings } = useData();
  const recipes = useEntries("recipe");
  const existing = recipes.find(
    (r) =>
      r.data.servings === 1 &&
      r.data.title === meal.title &&
      JSON.stringify(r.data.foods) === JSON.stringify(meal.foods) &&
      r.data.notes === meal.notes &&
      (r.data.assumptions || "") === meal.assumptions,
  );
  return (
    <Action
      className="text-button"
      disabled={existing?.data.favourite === true}
      onClick={async () => {
        const validated = mealSchema.parse(meal);
        await save(
          "recipe",
          existing?.date || dayInZone(new Date(), settings.timezone),
          recipeSchema.parse({
            title: validated.title,
            foods: validated.foods,
            servings: 1,
            notes: validated.notes,
            category: validated.category,
            assumptions: validated.assumptions,
            favourite: true,
          }),
          existing?.id,
        );
      }}
    >
      <Star
        size={16}
        fill={existing?.data.favourite ? "currentColor" : "none"}
      />
      {existing?.data.favourite ? "Saved to favourites" : "Save to favourites"}
    </Action>
  );
}

export function QuickMeals({ onLoad }: { onLoad: (meal: Meal) => void }) {
  const recipes = useEntries("recipe");
  const meals = useEntries("meal");
  const { loadMore, hasMore } = useData();
  const [tab, setTab] = useState<"favourites" | "recent">("favourites");
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase();
  const choices =
    tab === "favourites"
      ? recipes.filter((r) => r.data.favourite)
      : recentMeals(meals);
  const matches = choices.filter((e) =>
    `${e.data.title} ${e.data.foods.map((f) => f.name).join(" ")}`
      .toLocaleLowerCase()
      .includes(query),
  );
  return (
    <Card className="quick-meals">
      <div className="section-heading">
        <h2>Log a meal again</h2>
        <span className="pill">Review before saving</span>
      </div>
      <div className="segmented" aria-label="Meal shortcuts">
        <button
          aria-pressed={tab === "favourites"}
          className={tab === "favourites" ? "selected" : ""}
          onClick={() => setTab("favourites")}
        >
          <Star size={15} /> Favourites
        </button>
        <button
          aria-pressed={tab === "recent"}
          className={tab === "recent" ? "selected" : ""}
          onClick={() => setTab("recent")}
        >
          <RotateCcw size={15} /> Recent meals
        </button>
      </div>
      <Field label="Find a saved meal">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search meals or ingredients"
        />
      </Field>
      <div className="quick-meal-list">
        {matches.slice(0, 8).map((entry) => {
          const sum = totals(entry.data.foods);
          const servings = entry.kind === "recipe" ? entry.data.servings : 1;
          return (
            <button
              key={entry.id}
              className="quick-meal-choice"
              onClick={() =>
                onLoad(
                  entry.kind === "recipe"
                    ? recipeMeal(entry.data)
                    : { ...entry.data, source: "copy" },
                )
              }
            >
              <strong>{entry.data.title}</strong>
              <span>
                {fmt(sum.calories / servings)} kcal ·{" "}
                {fmt(sum.protein / servings)} g protein
              </span>
              <small>
                {entry.kind === "recipe"
                  ? "1 serving"
                  : `Last logged ${entry.date}`}{" "}
                · Load preview
              </small>
            </button>
          );
        })}
      </div>
      {!matches.length && (
        <p className="muted">
          {query
            ? "No matching meals."
            : tab === "favourites"
              ? "Save a meal to favourites from the editor or food diary to find it here."
              : "Your logged meals will appear here."}
        </p>
      )}
      {matches.length > 8 && (
        <p className="small muted">Showing 8 meals. Search to find another.</p>
      )}
      {hasMore(tab === "favourites" ? "recipe" : "meal") && (
        <Action
          className="text-button"
          onClick={() => loadMore(tab === "favourites" ? "recipe" : "meal")}
        >
          Load more meals
        </Action>
      )}
    </Card>
  );
}

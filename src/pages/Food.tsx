import { PhotoInput } from "../components/PhotoInput";
import { useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  Plus,
  Sparkles,
  Trash2,
  Save,
  Copy,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { useData, useEntries, api } from "../lib/store";
import {
  emptyFood,
  dayInZone,
  totals,
  scaleFoods,
  mealSchema,
  recipeSchema,
  nutrients,
  type Food,
  type Meal,
} from "../lib/domain";
import { Heading, Card, Field, Action, Empty, fmt } from "../components/ui";
export function FoodEditor() {
  const { settings, demo, save } = useData();
  const meals = useEntries("meal"),
    recipes = useEntries("recipe");
  const [params] = useSearchParams();
  const edit = meals.find((e) => e.id === params.get("edit"));
  const copy = meals.find((e) => e.id === params.get("copy"));
  const original = edit || copy;
  const nav = useNavigate();
  const base = useLocation().pathname.startsWith("/demo") ? "/demo" : "";
  const [data, setData] = useState<Meal>(
    original?.data || {
      title: "",
      category: "Breakfast",
      time: "08:00",
      foods: [emptyFood()],
      source: "manual",
      notes: "",
      assumptions: "",
    },
  );
  const [date, setDate] = useState(
    edit?.date || dayInZone(new Date(), settings.timezone),
  );
  const [description, setDescription] = useState("");
  const [consent, setConsent] = useState(false);
  const [aiId, setAiId] = useState(crypto.randomUUID());
  const [saveId] = useState(crypto.randomUUID());
  const [factor, setFactor] = useState("1");
  const [recipeId, setRecipeId] = useState("");
  const [recipeServings, setRecipeServings] = useState("1");
  const [savedNotice, setSavedNotice] = useState("");
  const [image, setImage] = useState<string>();
  const [photoEnabled, setPhotoEnabled] = useState(demo);
  useEffect(() => {
    if (!demo)
      void api<{ photo: boolean }>("/capabilities")
        .then((c) => setPhotoEnabled(c.photo))
        .catch(() => setPhotoEnabled(false));
  }, [demo]);
  useEffect(() => {
    if (original)
      setData({
        ...original.data,
        source: copy ? "copy" : original.data.source,
      });
  }, [original, copy]);
  const total = totals(data.foods);
  function updateFood(index: number, key: keyof Food, value: string) {
    setData({
      ...data,
      foods: data.foods.map((f, i) =>
        i === index
          ? {
              ...f,
              [key]: key === "name" || key === "unit" ? value : Number(value),
            }
          : f,
      ),
    });
  }
  async function analyze() {
    const result = demo
      ? {
          foods: [
            {
              name: "Estimated meal · simulated",
              quantity: 1,
              unit: "serving",
              calories: 620,
              protein: 28,
              carbs: 75,
              fat: 23,
              fiber: 8,
            },
          ],
          assumptions:
            "Simulated demo response. This is fictional and does not analyze your description.",
          uncertainty: "Illustrative values only.",
        }
      : await api<{ foods: Food[]; assumptions: string; uncertainty: string }>(
          "/ai",
          {
            method: "POST",
            body: JSON.stringify({
              requestId: aiId,
              kind: "meal",
              description,
              image,
              consent,
            }),
          },
        );
    setData({
      ...data,
      title: data.title || description.slice(0, 100) || "Estimated meal",
      foods: result.foods,
      source: "ai",
      assumptions: `${result.assumptions}\n${result.uncertainty}`,
    });
  }
  return (
    <>
      <Heading
        eyebrow="NOURISH YOUR DAY"
        title={edit ? "Edit your meal." : "What’s on your plate?"}
        description="Start with your own values or review an AI estimate. You’re always in control."
      />
      <div className="editor-layout">
        <div>
          <Card>
            <div className="section-heading">
              <h2>
                <Sparkles size={18} /> A helping hand
              </h2>
              <span className="pill">Optional AI</span>
            </div>
            <Field
              label="Describe your meal"
              hint="Include quantities, ingredients, and cooking method."
            >
              <textarea
                rows={3}
                placeholder="One 12-inch cheese pizza with 100 ml orange juice…"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setAiId(crypto.randomUUID());
                }}
                maxLength={3000}
              />
            </Field>
            <label className="check">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              {demo
                ? "Use simulated AI in this fictional demo"
                : "Send this description, dietary preferences and allergies to Groq for an estimate"}
            </label>
            <Action
              disabled={
                (!description && !image) ||
                !consent ||
                (!!image && !photoEnabled)
              }
              onClick={analyze}
            >
              <Sparkles size={16} /> Estimate nutrition
            </Action>
            <p className="small muted">
              Estimates are uncertain. Review portions and ingredients; AI
              cannot guarantee allergen safety. Nothing is saved until you
              confirm below.
            </p>
            <PhotoInput
              image={image}
              onChange={(value) => {
                setImage(value);
                setAiId(crypto.randomUUID());
              }}
              available={photoEnabled}
            />
          </Card>
          <Card>
            <h2>{edit ? "Meal details" : "Review & make it yours"}</h2>
            <div className="form-grid">
              <Field label="Meal name">
                <input
                  value={data.title}
                  onChange={(e) => setData({ ...data, title: e.target.value })}
                  maxLength={160}
                />
              </Field>
              <Field label="Category">
                <select
                  value={data.category}
                  onChange={(e) =>
                    setData({
                      ...data,
                      category: e.target.value as Meal["category"],
                    })
                  }
                >
                  {["Breakfast", "Lunch", "Dinner", "Snack"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label={`Date (${settings.timezone})`}>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label="Time">
                <input
                  type="time"
                  value={data.time}
                  onChange={(e) => setData({ ...data, time: e.target.value })}
                />
              </Field>
            </div>
            {data.assumptions && (
              <div className="notice">
                <strong>
                  {demo
                    ? "Simulated AI estimate"
                    : "AI estimate — please review"}
                </strong>
                <p>{data.assumptions}</p>
              </div>
            )}
            <div className="food-items">
              {data.foods.map((food, index) => (
                <div className="food-item" key={index}>
                  <div className="section-heading">
                    <span className="eyebrow">
                      FOOD {String(index + 1).padStart(2, "0")}
                    </span>
                    <button
                      className="icon-button"
                      disabled={data.foods.length === 1}
                      aria-label={`Remove food ${index + 1}`}
                      onClick={() =>
                        setData({
                          ...data,
                          foods: data.foods.filter((_, i) => i !== index),
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="food-name-row">
                    <Field label="Food name">
                      <input
                        value={food.name}
                        onChange={(e) =>
                          updateFood(index, "name", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="Quantity">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={food.quantity}
                        onChange={(e) =>
                          updateFood(index, "quantity", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="Unit">
                      <input
                        value={food.unit}
                        onChange={(e) =>
                          updateFood(index, "unit", e.target.value)
                        }
                      />
                    </Field>
                  </div>
                  <div className="nutrient-inputs">
                    {nutrients.map((n) => (
                      <Field
                        key={n}
                        label={`${n === "carbs" ? "Carbs" : n[0].toUpperCase() + n.slice(1)} (${n === "calories" ? "kcal" : "g"})`}
                      >
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={food[n]}
                          onChange={(e) => updateFood(index, n, e.target.value)}
                        />
                      </Field>
                    ))}
                  </div>
                  <p className="small muted">
                    Values cover the whole portion above. Changing quantity
                    alone does not recalculate them; use the explicit scaling
                    control.
                  </p>
                </div>
              ))}
            </div>
            <button
              className="button secondary"
              onClick={() =>
                setData({ ...data, foods: [...data.foods, emptyFood()] })
              }
            >
              <Plus size={16} /> Add food
            </button>
            <Field label="Notes">
              <textarea
                value={data.notes}
                onChange={(e) => setData({ ...data, notes: e.target.value })}
                maxLength={2000}
              />
            </Field>
          </Card>
        </div>
        <aside>
          <Card className="sticky-card">
            <p className="eyebrow">MEAL TOTAL</p>
            <div className="big-total">
              {fmt(total.calories)} <small>kcal</small>
            </div>
            {nutrients.slice(1).map((n) => (
              <div className="rhythm-row" key={n}>
                <span>
                  {n === "carbs"
                    ? "Carbohydrates"
                    : n[0].toUpperCase() + n.slice(1)}
                </span>
                <strong>{fmt(total[n], 1)} g</strong>
              </div>
            ))}
            <Field label="Multiply all portions and nutrients">
              <input
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={factor}
                onChange={(e) => setFactor(e.target.value)}
              />
            </Field>
            <button
              className="button secondary full"
              disabled={!Number(factor)}
              onClick={() => {
                setData({
                  ...data,
                  foods: scaleFoods(data.foods, Number(factor)),
                });
                setFactor("1");
              }}
            >
              Apply ×{factor || "…"}
            </button>
            <hr />
            <Action
              className="button full"
              onClick={async () => {
                const validated = mealSchema.parse(data);
                await save("meal", date, validated, edit?.id, saveId);
                nav(`${base}/history`);
              }}
            >
              <Save size={16} />
              {edit ? "Save changes" : "Confirm & save meal"}
            </Action>
            <Link className="button ghost full" to={`${base}/history`}>
              Cancel
            </Link>
            <p className="small muted">
              Saving records only the meal shown in this preview.
            </p>
          </Card>
          <Card>
            <h3>
              <BookOpen size={17} /> Saved meals & recipes
            </h3>
            <Field label="Recipe">
              <select
                value={recipeId}
                onChange={(e) => setRecipeId(e.target.value)}
              >
                <option value="">Choose a recipe</option>
                {recipes.map((r) => (
                  <option value={r.id} key={r.id}>
                    {r.data.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Servings to log">
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={recipeServings}
                onChange={(e) => setRecipeServings(e.target.value)}
              />
            </Field>
            <button
              className="button secondary"
              disabled={!recipeId || !Number(recipeServings)}
              onClick={() => {
                const recipe = recipes.find((r) => r.id === recipeId)!;
                setData({
                  ...data,
                  title: recipe.data.title,
                  foods: scaleFoods(
                    recipe.data.foods,
                    Number(recipeServings) / recipe.data.servings,
                  ),
                  source: "recipe",
                  notes: recipe.data.notes,
                });
              }}
            >
              Load into preview <ArrowRight size={15} />
            </button>
            <hr />
            <Action
              className="text-button"
              onClick={async () => {
                await save(
                  "recipe",
                  dayInZone(new Date(), settings.timezone),
                  recipeSchema.parse({
                    title: data.title,
                    foods: data.foods,
                    servings: 1,
                    notes: data.notes,
                  }),
                );
                setSavedNotice(
                  "Saved as a 1-serving template. No diary entry created.",
                );
              }}
            >
              Save current meal as recipe
            </Action>
            {savedNotice && (
              <p className="success" role="status">
                {savedNotice}
              </p>
            )}
            <Link className="text-button" to={`${base}/history?recipes=1`}>
              Manage recipes
            </Link>
          </Card>
        </aside>
      </div>
    </>
  );
}
export function FoodHistory() {
  const { remove, save, loadMore, hasMore } = useData();
  const meals = useEntries("meal"),
    recipes = useEntries("recipe");
  const base = useLocation().pathname.startsWith("/demo") ? "/demo" : "";
  const [params] = useSearchParams();
  const [templates, setTemplates] = useState(params.has("recipes"));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const selected = meals.filter(
    (e) => (!from || e.date >= from) && (!to || e.date <= to),
  );
  const dates = [...new Set(selected.map((e) => e.date))];
  return (
    <>
      <Heading
        eyebrow="YOUR NUTRITION JOURNAL"
        title="Every meal has a place."
        description="Review what you’ve recorded, and adjust whenever you need to."
        action={
          <Link className="button" to={`${base}/add-meal`}>
            <Plus size={17} /> Add meal
          </Link>
        }
      />
      <div className="toolbar">
        <div className="segmented">
          <button
            className={!templates ? "selected" : ""}
            onClick={() => setTemplates(false)}
          >
            Food diary
          </button>
          <button
            className={templates ? "selected" : ""}
            onClick={() => setTemplates(true)}
          >
            Recipes & saved meals
          </button>
        </div>
        {!templates && (
          <>
            <Field label="From">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field label="Through">
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
          </>
        )}
      </div>
      {templates ? (
        <div className="two-column">
          {recipes.map((r) => (
            <Card key={r.id}>
              <h2>{r.data.title}</h2>
              <p className="muted">
                {r.data.servings} serving(s) ·{" "}
                {fmt(totals(r.data.foods).calories / r.data.servings)} kcal per
                serving
              </p>
              <p>{r.data.notes}</p>
              <div className="split">
                <Link className="text-button" to={`${base}/add-meal`}>
                  Load in meal editor
                </Link>
                <Action
                  className="text-button"
                  onClick={async () => {
                    const title = prompt("Recipe title", r.data.title);
                    if (title)
                      await save("recipe", r.date, { ...r.data, title }, r.id);
                  }}
                >
                  Rename
                </Action>
                <Action
                  className="text-button danger-text"
                  onClick={async () => {
                    if (
                      confirm(
                        "Delete this recipe template? Diary entries will remain.",
                      )
                    )
                      await remove(r.id);
                  }}
                >
                  Delete
                </Action>
              </div>
              <details>
                <summary>Edit recipe contents</summary>
                <RecipeEdit id={r.id} />
              </details>
            </Card>
          ))}
          {!recipes.length && (
            <Empty>Save a meal as a recipe from the meal editor.</Empty>
          )}
        </div>
      ) : (
        <>
          {dates.map((date) => {
            const list = selected.filter((e) => e.date === date);
            const sum = totals(list.flatMap((e) => e.data.foods));
            return (
              <Card key={date}>
                <div className="section-heading">
                  <h2>{date}</h2>
                  <span className="pill">
                    {fmt(sum.calories)} kcal · P {fmt(sum.protein)} · C{" "}
                    {fmt(sum.carbs)} · F {fmt(sum.fat)} · Fiber {fmt(sum.fiber)}{" "}
                    g
                  </span>
                </div>
                {list.map((e) => (
                  <div key={e.id} className="history-row">
                    <div>
                      <small>
                        {e.data.category} · {e.data.time}
                      </small>
                      <h3>{e.data.title}</h3>
                      <p className="muted">
                        {e.data.foods
                          .map((f) => `${f.quantity} ${f.unit} ${f.name}`)
                          .join(" · ")}
                      </p>
                    </div>
                    <span>{fmt(totals(e.data.foods).calories)} kcal</span>
                    <Link
                      className="text-button"
                      to={`${base}/add-meal?edit=${e.id}`}
                    >
                      Edit
                    </Link>
                    <Link
                      className="icon-button"
                      title="Copy to a new meal preview"
                      to={`${base}/add-meal?copy=${e.id}`}
                    >
                      <Copy size={16} />
                    </Link>
                    <Action
                      className="text-button danger-text"
                      onClick={async () => {
                        if (confirm("Delete this meal?")) await remove(e.id);
                      }}
                    >
                      Delete
                    </Action>
                  </div>
                ))}
              </Card>
            );
          })}
          {!dates.length && (
            <Empty>
              No meals recorded in this range. Missing days are unknown, not
              zero consumption.
            </Empty>
          )}
          {hasMore("meal") && (
            <Action onClick={() => loadMore("meal")}>Load earlier meals</Action>
          )}
          <p className="small muted">
            Daily totals reflect saved entries only. Earlier records load in
            pages of 200; use Progress for full-range aggregates.
          </p>
        </>
      )}
    </>
  );
}
function RecipeEdit({ id }: { id: string }) {
  const recipe = useEntries("recipe").find((r) => r.id === id)!;
  const { save } = useData();
  const [value, setValue] = useState(recipe.data);
  const [saved, setSaved] = useState(false);
  return (
    <>
      <p className="small muted">
        Nutrients describe the complete recipe batch. Logging one serving
        divides these values by the batch servings.
      </p>
      <div className="form-grid">
        <Field label="Recipe title">
          <input
            value={value.title}
            onChange={(e) => setValue({ ...value, title: e.target.value })}
          />
        </Field>
        <Field label="Servings in this batch">
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={value.servings}
            onChange={(e) =>
              setValue({ ...value, servings: Number(e.target.value) })
            }
          />
        </Field>
      </div>
      {value.foods.map((food, index) => (
        <div className="food-item" key={index}>
          <div className="form-grid">
            {(["name", "quantity", "unit", ...nutrients] as const).map(
              (key) => (
                <Field
                  key={key}
                  label={
                    key === "name"
                      ? "Ingredient"
                      : key === "calories"
                        ? "Calories (kcal)"
                        : key === "unit"
                          ? "Unit"
                          : key === "quantity"
                            ? "Quantity"
                            : `${key} (g)`
                  }
                >
                  <input
                    type={key === "name" || key === "unit" ? "text" : "number"}
                    min="0"
                    step="any"
                    value={food[key]}
                    onChange={(e) =>
                      setValue({
                        ...value,
                        foods: value.foods.map((f, i) =>
                          i === index
                            ? {
                                ...f,
                                [key]:
                                  key === "name" || key === "unit"
                                    ? e.target.value
                                    : Number(e.target.value),
                              }
                            : f,
                        ),
                      })
                    }
                  />
                </Field>
              ),
            )}
          </div>
          <button
            className="text-button danger-text"
            disabled={value.foods.length === 1}
            onClick={() =>
              setValue({
                ...value,
                foods: value.foods.filter((_, i) => i !== index),
              })
            }
          >
            Remove ingredient
          </button>
        </div>
      ))}
      <button
        className="button secondary"
        onClick={() =>
          setValue({ ...value, foods: [...value.foods, emptyFood()] })
        }
      >
        + Add ingredient
      </button>
      <Field label="Recipe notes">
        <textarea
          value={value.notes}
          onChange={(e) => setValue({ ...value, notes: e.target.value })}
        />
      </Field>
      <Action
        onClick={async () => {
          await save("recipe", recipe.date, recipeSchema.parse(value), id);
          setSaved(true);
        }}
      >
        Save recipe changes
      </Action>
      {saved && (
        <p className="success" role="status">
          Recipe updated.
        </p>
      )}
    </>
  );
}

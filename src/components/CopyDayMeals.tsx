import { useState } from "react";
import { useData, useEntries, api } from "../lib/store";
import {
  dayInZone,
  daySchema,
  mealSchema,
  scaleFoods,
  totals,
  type Entry,
} from "../lib/domain";
import { Action, Field, Modal, fmt } from "./ui";

export function CopyDayMeals({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (date: string, count: number) => void;
}) {
  const { settings, demo, copyMeals } = useData();
  const meals = useEntries("meal");
  const today = dayInZone(new Date(), settings.timezone);
  const [from, setFrom] = useState(meals[0]?.date || today);
  const [to, setTo] = useState(today);
  const [preview, setPreview] = useState<
    { entry: Entry<"meal">; included: boolean; factor: string }[] | null
  >(null);
  const [existing, setExisting] = useState(0);
  const [requestId, setRequestId] = useState(crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  async function day(date: string) {
    daySchema.parse(date);
    if (demo) return meals.filter((meal) => meal.date === date);
    const result = await api<{ items: Entry<"meal">[]; cursor: string | null }>(
      `/records?kind=meal&from=${date}&to=${date}&limit=200`,
    );
    if (result.cursor || result.items.length > 100)
      throw new Error(
        "This day has more than 100 meals. Copy individual meals instead.",
      );
    return result.items;
  }
  const chosen = preview?.filter((p) => p.included) || [];
  const valid =
    chosen.length > 0 &&
    chosen.every((p) => Number(p.factor) > 0 && Number(p.factor) <= 100);
  const foods = chosen.flatMap((p) =>
    Number(p.factor) > 0 && Number(p.factor) <= 100
      ? scaleFoods(p.entry.data.foods, Number(p.factor))
      : [],
  );
  const total = totals(foods);
  function changed() {
    setRequestId(crypto.randomUUID());
  }
  return (
    <Modal
      title="Copy a day’s meals"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p>
        Choose a day, review the meals, then add copies to another date.
        Existing meals on that date will stay.
      </p>
      <fieldset disabled={busy} className="copy-day-fields">
        <div className="form-grid">
          <Field label="Copy meals from">
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPreview(null);
                changed();
              }}
            />
          </Field>
          <Field label="Copy meals to">
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPreview(null);
                changed();
              }}
            />
          </Field>
        </div>
        <Action
          disabled={!from || !to || from === to}
          onClick={async () => {
            setBusy(true);
            try {
              const [source, destination] = await Promise.all([
                day(from),
                day(to),
              ]);
              setPreview(
                source
                  .sort((a, b) => a.data.time.localeCompare(b.data.time))
                  .map((entry) => ({ entry, included: true, factor: "1" })),
              );
              setExisting(destination.length);
              changed();
            } finally {
              setBusy(false);
            }
          }}
        >
          Preview meals
        </Action>
        {from === to && (
          <p className="small muted">Choose a different destination date.</p>
        )}
        {preview && (
          <>
            <h3>Review copies for {to}</h3>
            {existing > 0 && (
              <p className="notice">
                {existing} meal(s) already exist on this date. These copies will
                be added alongside them.
              </p>
            )}
            {!preview.length && <p>No meals recorded on the source date.</p>}
            {preview.map((p, index) => (
              <div className="food-item" key={p.entry.id}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={p.included}
                    onChange={(e) => {
                      setPreview(
                        preview.map((item, i) =>
                          i === index
                            ? { ...item, included: e.target.checked }
                            : item,
                        ),
                      );
                      changed();
                    }}
                  />
                  {p.entry.data.title} · {p.entry.data.category} ·{" "}
                  {p.entry.data.time}
                </label>
                <p className="small muted">
                  {p.entry.data.foods
                    .map((f) => `${f.quantity} ${f.unit} ${f.name}`)
                    .join(" · ")}
                </p>
                <Field label={`Portion multiplier for ${p.entry.data.title}`}>
                  <input
                    type="number"
                    min="0.1"
                    max="100"
                    step="0.1"
                    value={p.factor}
                    disabled={!p.included}
                    onChange={(e) => {
                      setPreview(
                        preview.map((item, i) =>
                          i === index
                            ? { ...item, factor: e.target.value }
                            : item,
                        ),
                      );
                      changed();
                    }}
                  />
                </Field>
                {p.entry.data.assumptions && (
                  <p className="small muted">
                    Estimate notes: {p.entry.data.assumptions}
                  </p>
                )}
              </div>
            ))}
            <p role="status">
              {chosen.length} meal(s) selected · {fmt(total.calories)} kcal ·{" "}
              {fmt(total.protein, 1)} g protein · {fmt(total.carbs, 1)} g carbs
              · {fmt(total.fat, 1)} g fat · {fmt(total.fiber, 1)} g fiber
            </p>
            <p className="small muted">
              Portion multipliers scale quantities and nutrition together. Meal
              times, notes and estimate details are retained.
            </p>
            <Action
              disabled={!valid}
              onClick={async () => {
                setBusy(true);
                try {
                  await copyMeals(
                    to,
                    chosen.map((p) =>
                      mealSchema.parse({
                        ...p.entry.data,
                        foods: scaleFoods(p.entry.data.foods, Number(p.factor)),
                        source: "copy",
                      }),
                    ),
                    requestId,
                  );
                  onSaved(to, chosen.length);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirm & copy {chosen.length} meals
            </Action>
          </>
        )}
        <button className="button ghost" onClick={onClose}>
          Cancel
        </button>
      </fieldset>
    </Modal>
  );
}

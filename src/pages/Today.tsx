import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Plus,
  ArrowUpRight,
  Droplets,
  Utensils,
  Sun,
  MoveUpRight,
} from "lucide-react";
import { useData, useEntries, api } from "../lib/store";
import {
  dayInZone,
  addDays,
  totals,
  kgToLb,
  lbToKg,
  type Entry,
} from "../lib/domain";
import {
  Card,
  Heading,
  Stat,
  Chart,
  fmt,
  Empty,
  Field,
  Action,
  Modal,
} from "../components/ui";
import { BodyMap } from "../components/BodyMap";
import { MetricHistory, type HistoryMetric } from "../components/MetricHistory";
export function Today() {
  const [historyMetric, setHistoryMetric] = useState<HistoryMetric | null>(
    null,
  );
  const { settings, demo, save } = useData();
  const meals = useEntries("meal"),
    water = useEntries("water"),
    wellness = useEntries("wellness"),
    weights = useEntries("weight");
  const today = dayInZone(new Date(), settings.timezone);
  const todays = meals.filter((e) => e.date === today);
  const sum = totals(todays.flatMap((e) => e.data.foods));
  const consumed = water
    .filter((e) => e.date === today)
    .reduce((s, e) => s + e.data.ml, 0);
  const latest = wellness[0];
  const base = useLocation().pathname.startsWith("/demo") ? "/demo" : "";
  const [weight, setWeight] = useState(false);
  const [syncNotice, setSyncNotice] = useState("");
  useEffect(() => {
    if (!demo)
      void api("/sync", {
        method: "POST",
        body: JSON.stringify({ manual: false }),
      })
        .then(() => setSyncNotice(""))
        .catch(() =>
          setSyncNotice(
            "Wearable refresh unavailable. Cached records are still shown.",
          ),
        );
  }, [demo]);
  const points = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    const logged = meals.filter((e) => e.date === date);
    return {
      label: new Date(date + "T12:00:00").toLocaleDateString(undefined, {
        weekday: "short",
      }),
      value: logged.length
        ? totals(logged.flatMap((e) => e.data.foods)).calories
        : null,
    };
  });
  return (
    <>
      <Heading
        eyebrow={new Date(today + "T12:00:00")
          .toLocaleDateString("en", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })
          .toUpperCase()}
        title={`A little better, ${settings.displayName.split(" ")[0] || "every day"}.`}
        description="Small steps. A fuller picture of you."
        action={
          <Link className="button" to={`${base}/add-meal`}>
            <Plus size={18} /> Log a meal
          </Link>
        }
      />
      <div className="stats-grid">
        <Stat
          accent
          label="Calories consumed"
          onClick={() => setHistoryMetric("calories")}
          value={todays.length ? fmt(sum.calories) : "—"}
          unit="kcal"
          detail={
            todays.length
              ? `${fmt(Math.abs(settings.targets.calories - sum.calories))} ${sum.calories > settings.targets.calories ? "above target" : "remaining"} · ${fmt(settings.targets.calories)} target`
              : "No meals logged today"
          }
        />
        <Stat
          label="Protein"
          onClick={() => setHistoryMetric("protein")}
          value={todays.length ? fmt(sum.protein) : "—"}
          unit="g"
          detail={`of ${settings.targets.protein} g daily target`}
        />
        <Stat
          label="Water"
          onClick={() => setHistoryMetric("water")}
          value={consumed ? fmt(consumed / 1000, 2) : "—"}
          unit="L"
          detail={`of ${fmt(settings.targets.water / 1000, 1)} L daily target`}
        />
        <Stat
          label="Sleep"
          onClick={() => setHistoryMetric("sleep")}
          value={
            latest?.data.sleepSeconds != null
              ? fmt(latest.data.sleepSeconds / 3600, 1)
              : "—"
          }
          unit="hrs"
          detail={
            latest
              ? `Source date · ${latest.date}`
              : "No wearable sleep recorded"
          }
        />
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-left">
          <Card>
            <div className="section-heading">
              <div>
                <p className="eyebrow">FIND YOUR BALANCE</p>
                <h2>Nutrition, this week</h2>
              </div>
              <Link className="text-button" to={`${base}/progress`}>
                View progress <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="chart-summary">
              <strong>
                {todays.length ? fmt(sum.calories) : "—"}{" "}
                <small>kcal today</small>
              </strong>
              <span className="legend">
                <i /> Logged intake
              </span>
            </div>
            <Chart
              points={points}
              label="Daily consumed calories"
              unit=" kcal"
              target={settings.targets.calories}
            />
            <div className="macro-grid">
              {(["carbs", "fat", "fiber"] as const).map((n, i) => (
                <div key={n}>
                  <div>
                    <span>
                      <i className={`dot dot-${i}`} />
                      {n === "carbs"
                        ? "Carbohydrates"
                        : n[0].toUpperCase() + n.slice(1)}
                    </span>
                    <strong>
                      {fmt(sum[n])}
                      <small> / {settings.targets[n]} g</small>
                    </strong>
                  </div>
                  <progress
                    value={sum[n]}
                    max={settings.targets[n] || 1}
                    aria-label={`${n} target progress`}
                  />
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div className="section-heading">
              <div>
                <p className="eyebrow">ON YOUR PLATE</p>
                <h2>
                  Today’s meals <span className="count">{todays.length}</span>
                </h2>
              </div>
              <Link className="text-button" to={`${base}/history`}>
                Food history <ArrowUpRight size={16} />
              </Link>
            </div>
            {todays.length ? (
              todays
                .sort((a, b) => a.data.time.localeCompare(b.data.time))
                .map((entry, i) => (
                  <Link
                    to={`${base}/add-meal?edit=${entry.id}`}
                    className="meal-row"
                    key={entry.id}
                  >
                    <span className={`meal-art meal-art-${i % 3}`}>
                      <Utensils size={22} />
                    </span>
                    <div>
                      <small>
                        {entry.data.category} <span>· {entry.data.time}</span>
                      </small>
                      <h3>{entry.data.title}</h3>
                      <p>
                        {fmt(totals(entry.data.foods).protein)} g protein ·{" "}
                        {entry.data.foods.length} food item
                        {entry.data.foods.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <strong>
                      {fmt(totals(entry.data.foods).calories)}
                      <small>kcal</small>
                    </strong>
                    <MoveUpRight size={17} />
                  </Link>
                ))
            ) : (
              <Empty>Your first meal is a good place to start.</Empty>
            )}
            <Link className="add-row" to={`${base}/add-meal`}>
              <Plus size={17} /> Add a meal
            </Link>
          </Card>
          <Card className="water-card">
            <div className="water-icon">
              <Droplets size={27} />
            </div>
            <div>
              <h3>A moment to hydrate.</h3>
              <p className="muted">
                {fmt(consumed)} / {fmt(settings.targets.water)} ml logged today
              </p>
            </div>
            <Action
              className="button secondary"
              onClick={() => save("water", today, { ml: 250 })}
            >
              + 250 ml
            </Action>
          </Card>
        </div>
        <div className="dashboard-right">
          <BodyMap />
          <Card className="recovery-card">
            <div className="section-heading">
              <h2>Your daily rhythm</h2>
              <Sun size={20} />
            </div>
            <div className="rhythm-row">
              <span>Steps</span>
              <strong>{fmt(latest?.data.steps)}</strong>
            </div>
            <div className="rhythm-row">
              <span>Resting heart rate</span>
              <strong>
                {fmt(latest?.data.restingHR)} <small>bpm</small>
              </strong>
            </div>
            <div className="rhythm-row">
              <span>Latest weight</span>
              <strong>
                {weights[0]
                  ? fmt(
                      settings.units === "metric"
                        ? weights[0].data.kg
                        : kgToLb(weights[0].data.kg),
                      1,
                    )
                  : "—"}{" "}
                <small>{settings.units === "metric" ? "kg" : "lb"}</small>
              </strong>
            </div>
            <p className="small muted">
              Wearable source: {latest?.date || "not recorded"}. {syncNotice}
            </p>
            <div className="split">
              <Link className="text-button" to={`${base}/health`}>
                Health & recovery <ArrowUpRight size={14} />
              </Link>
              <button className="text-button" onClick={() => setWeight(true)}>
                Log weight
              </button>
            </div>
          </Card>
          <div className="quiet-note">
            <span>↗</span>
            <p>
              Consistency has a quiet kind of power.
              <br />
              <strong>Make today yours.</strong>
            </p>
          </div>
        </div>
      </div>
      {weight && <LogEditor kind="weight" onClose={() => setWeight(false)} />}
      {historyMetric && (
        <MetricHistory
          metric={historyMetric}
          onClose={() => setHistoryMetric(null)}
        />
      )}
    </>
  );
}
export function LogEditor({
  kind,
  entry,
  onClose,
}: {
  kind: "weight" | "water";
  entry?: Entry<"weight"> | Entry<"water">;
  onClose: () => void;
}) {
  const { settings, save } = useData();
  const imperial = settings.units === "imperial";
  const initial = entry
    ? entry.kind === "weight"
      ? imperial
        ? kgToLb((entry as Entry<"weight">).data.kg)
        : (entry as Entry<"weight">).data.kg
      : (entry as Entry<"water">).data.ml / (imperial ? 29.5735295625 : 1)
    : "";
  const [amount, setAmount] = useState(String(initial));
  const [date, setDate] = useState(
    entry?.date || dayInZone(new Date(), settings.timezone),
  );
  const unit =
    kind === "weight" ? (imperial ? "lb" : "kg") : imperial ? "US fl oz" : "ml";
  return (
    <Modal title={`Log ${kind}`} onClose={onClose}>
      <div className="form-grid">
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label={`Amount (${unit})`}>
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
      </div>
      <Action
        disabled={!Number(amount)}
        onClick={async () => {
          if (kind === "weight")
            await save(
              "weight",
              date,
              {
                kg: imperial ? lbToKg(Number(amount)) : Number(amount),
                notes:
                  entry?.kind === "weight"
                    ? (entry as Entry<"weight">).data.notes
                    : "",
              },
              entry?.id,
            );
          else
            await save(
              "water",
              date,
              { ml: Number(amount) * (imperial ? 29.5735295625 : 1) },
              entry?.id,
            );
          onClose();
        }}
      >
        Save {kind}
      </Action>
    </Modal>
  );
}

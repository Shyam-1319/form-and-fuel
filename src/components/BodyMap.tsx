import { useState } from "react";
import { Ruler, Plus, ArrowUpRight } from "lucide-react";
import { useData, useEntries } from "../lib/store";
import {
  regions,
  cmToIn,
  inToCm,
  dayInZone,
  type Measurement,
  type Entry,
} from "../lib/domain";
import { Card, Modal, Field, Action, Chart, fmt } from "./ui";
const shapes: [Measurement["region"], Measurement["side"], string][] = [
  ["Neck", "Centre", "M83 37 L97 37 L99 53 L81 53Z"],
  [
    "Shoulders",
    "Centre",
    "M80 50 L100 50 L119 60 L116 74 L102 66 L78 66 L64 74 L61 60Z",
  ],
  ["Chest", "Centre", "M76 68 Q90 73 104 68 L110 96 L90 104 L70 96Z"],
  ["Waist", "Centre", "M71 100 L90 108 L109 100 L106 131 L74 131Z"],
  [
    "Hips",
    "Centre",
    "M74 135 L106 135 L114 157 L92 169 L90 162 L88 169 L66 157Z",
  ],
  ["Upper arm", "Right", "M59 64 L70 77 L64 112 L50 110Z"],
  ["Upper arm", "Left", "M121 64 L110 77 L116 112 L130 110Z"],
  ["Forearm", "Right", "M49 114 L63 116 L55 151 L42 154Z"],
  ["Forearm", "Left", "M131 114 L117 116 L125 151 L138 154Z"],
  ["Thigh", "Right", "M67 162 L86 174 L83 220 L65 220 L61 187Z"],
  ["Thigh", "Left", "M113 162 L94 174 L97 220 L115 220 L119 187Z"],
  ["Calf", "Right", "M65 225 L82 225 L80 255 L75 279 L65 279 L62 248Z"],
  ["Calf", "Left", "M115 225 L98 225 L100 255 L105 279 L115 279 L118 248Z"],
];
export function BodyMap() {
  const { settings, save, remove, loadMore, hasMore } = useData();
  const entries = useEntries("measurement");
  const [region, setRegion] = useState<Measurement["region"]>("Waist");
  const [side, setSide] = useState<Measurement["side"]>("Centre");
  const [edit, setEdit] = useState<Entry<"measurement"> | true | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [back, setBack] = useState(false);
  const history = entries
    .filter((e) => e.data.region === region && e.data.side === side)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.updatedAt.localeCompare(b.updatedAt),
    );
  const latest = history.at(-1),
    previous = history.at(-2),
    baseline = history[0];
  const unit = settings.units === "metric" ? "cm" : "in";
  const value = (cm: number) => (settings.units === "metric" ? cm : cmToIn(cm));
  const select = (r: Measurement["region"], s: Measurement["side"]) => {
    setRegion(r);
    setSide(s);
  };
  return (
    <Card className="body-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">THE BIGGER PICTURE</p>
          <h2>Measurements</h2>
        </div>
        <Ruler size={19} />
      </div>
      <p className="subtle">A little progress, in your own shape.</p>
      <div className="body-layout">
        <div>
          <div className="segmented">
            <button
              className={!back ? "selected" : ""}
              onClick={() => setBack(false)}
            >
              Front
            </button>
            <button
              className={back ? "selected" : ""}
              onClick={() => setBack(true)}
            >
              Back
            </button>
          </div>
          <svg
            className="body-svg"
            viewBox="0 0 180 300"
            aria-label={`${back ? "Back" : "Front"} body measurement regions`}
          >
            <ellipse cx="90" cy="23" rx="15" ry="19" fill="#31534e" />
            <path
              d="M42 156L54 155L51 177Q43 184 40 173ZM138 156L126 155L129 177Q137 184 140 173ZM65 282L76 282L78 293L57 293ZM104 282L115 282L123 293L102 293Z"
              fill="#31534e"
            />
            {shapes.map(([r, s, d]) => {
              const measured = entries.some(
                (e) => e.data.region === r && e.data.side === s,
              );
              return (
                <path
                  key={r + s}
                  d={d}
                  role="button"
                  tabIndex={0}
                  aria-label={`${r}${s === "Centre" ? "" : ` ${s}`}: ${measured ? "measurement available" : "not recorded"}`}
                  aria-pressed={region === r && side === s}
                  className={`body-region ${region === r && side === s ? "active" : ""}`}
                  onMouseEnter={() => select(r, s)}
                  onFocus={() => select(r, s)}
                  onClick={() => select(r, s)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      select(r, s);
                    }
                  }}
                  transform={back ? "translate(180 0) scale(-1 1)" : undefined}
                />
              );
            })}
          </svg>
        </div>
        <div className="measurement-detail">
          <span className="pill">
            {side === "Centre" ? "Circumference" : side + " circumference"}
          </span>
          <h3>{region}</h3>
          <div className="measurement-value">
            {latest ? fmt(value(latest.data.cm), 1) : "—"}
            <span>{unit}</span>
          </div>
          <p className="subtle">
            {latest ? `Recorded ${latest.date}` : "Not recorded"}
          </p>
          <div className="measurement-delta">
            <span>Previous</span>
            <strong>
              {previous ? `${fmt(value(previous.data.cm), 1)} ${unit}` : "—"}
            </strong>
            <span>Since previous</span>
            <strong>
              {latest && previous
                ? `${fmt(value(latest.data.cm - previous.data.cm), 1)} ${unit}`
                : "—"}
            </strong>
            <span>From baseline</span>
            <strong>
              {latest && baseline && history.length > 1
                ? `${fmt(value(latest.data.cm - baseline.data.cm), 1)} ${unit}`
                : "—"}
            </strong>
          </div>
          <Chart
            points={history
              .slice(-6)
              .map((e) => ({
                label: e.date.slice(5),
                value: value(e.data.cm),
              }))}
            label="Recorded measurements"
            unit={` ${unit}`}
          />
          <button className="button light" onClick={() => setEdit(true)}>
            <Plus size={15} /> Add measurement
          </button>
        </div>
      </div>
      <div className="card-footer">
        <span>Changes are neutral, never a score.</span>
        <button
          className="text-button"
          onClick={() => setShowTable(!showTable)}
        >
          View history <ArrowUpRight size={14} />
        </button>
      </div>
      {showTable && (
        <div className="body-table">
          <Field label="Region">
            <select
              value={`${region}|${side}`}
              onChange={(e) => {
                const [r, s] = e.target.value.split("|");
                select(r as Measurement["region"], s as Measurement["side"]);
              }}
            >
              {regions.flatMap((r) =>
                (["Upper arm", "Forearm", "Thigh", "Calf"].includes(r)
                  ? ["Left", "Right"]
                  : ["Centre"]
                ).map((s) => (
                  <option key={r + s} value={`${r}|${s}`}>
                    {r} {s === "Centre" ? "" : s}
                  </option>
                )),
              )}
            </select>
          </Field>
          <div className="table-wrap">
            <table>
              <caption>
                {region} {side} history
              </caption>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Measurement</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((e) => (
                  <tr key={e.id}>
                    <td>{e.date}</td>
                    <td>
                      {fmt(value(e.data.cm), 1)} {unit}
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setEdit(e)}
                      >
                        Edit
                      </button>
                      <Action
                        className="text-button"
                        onClick={async () => {
                          if (confirm("Delete this measurement?"))
                            await remove(e.id);
                        }}
                      >
                        Delete
                      </Action>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore("measurement") && (
            <Action
              className="text-button"
              onClick={() => loadMore("measurement")}
            >
              Load earlier measurements
            </Action>
          )}
        </div>
      )}
      {edit && (
        <MeasurementEditor
          entry={edit === true ? undefined : edit}
          initial={{ region, side }}
          onClose={() => setEdit(null)}
          onSave={async (date, data) => {
            await save(
              "measurement",
              date,
              data,
              edit === true ? undefined : edit.id,
            );
            setEdit(null);
          }}
        />
      )}
    </Card>
  );
}
function MeasurementEditor({
  entry,
  initial,
  onClose,
  onSave,
}: {
  entry?: Entry<"measurement">;
  initial: Pick<Measurement, "region" | "side">;
  onClose: () => void;
  onSave: (date: string, data: Measurement) => Promise<void>;
}) {
  const { settings } = useData();
  const imperial = settings.units === "imperial";
  const [data, setData] = useState<Measurement>(
    entry?.data || { ...initial, cm: 0, notes: "" },
  );
  const [date, setDate] = useState(
    entry?.date || dayInZone(new Date(), settings.timezone),
  );
  const [amount, setAmount] = useState(
    entry ? String(imperial ? cmToIn(entry.data.cm) : entry.data.cm) : "",
  );
  const limbs = ["Upper arm", "Forearm", "Thigh", "Calf"];
  return (
    <Modal
      title={entry ? "Edit measurement" : "Add a measurement"}
      onClose={onClose}
    >
      <p className="muted">
        Record the circumference, using the same position each time. Daily
        entries are optional.
      </p>
      <div className="form-grid">
        <Field label="Region">
          <select
            value={data.region}
            onChange={(e) => {
              const region = e.target.value as Measurement["region"];
              setData({
                ...data,
                region,
                side: limbs.includes(region) ? "Left" : "Centre",
              });
            }}
          >
            {regions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Side">
          <select
            value={data.side}
            onChange={(e) =>
              setData({ ...data, side: e.target.value as Measurement["side"] })
            }
          >
            {(limbs.includes(data.region) ? ["Left", "Right"] : ["Centre"]).map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
          </select>
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label={`Circumference (${imperial ? "in" : "cm"})`}>
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Notes (optional)">
        <textarea
          value={data.notes}
          onChange={(e) => setData({ ...data, notes: e.target.value })}
        />
      </Field>
      <Action
        disabled={!Number(amount)}
        onClick={() =>
          onSave(date, {
            ...data,
            cm: imperial ? inToCm(Number(amount)) : Number(amount),
          })
        }
      >
        Save measurement
      </Action>
    </Modal>
  );
}

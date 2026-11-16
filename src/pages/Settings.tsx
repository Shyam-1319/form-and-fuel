import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Link2, Download, ShieldCheck } from "lucide-react";
import { useData, api } from "../lib/store";
import {
  settingsSchema,
  defaults,
  dayInZone,
  cmToIn,
  inToCm,
  kgToLb,
  lbToKg,
} from "../lib/domain";
import { Heading, Card, Field, Action, fmt } from "../components/ui";
type SyncStatus = {
  athlete_id: string;
  start_date: string;
  cursor: string;
  imported_through: string | null;
  earliest_wellness: string | null;
  earliest_activity: string | null;
  latest_wellness: string | null;
  latest_activity: string | null;
  last_success: string | null;
  next_retry: string | null;
  status: string;
  error: string | null;
};
export function Settings({ onDeleted }: { onDeleted: () => void }) {
  const { settings, saveSettings, demo, reset, entries } = useData();
  const [value, setValue] = useState(settings);
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const imperial = value.units === "imperial";
  return (
    <>
      <Heading
        eyebrow="MAKE IT YOURS"
        title={
          settings.onboarded
            ? "Your space, your settings."
            : "Let’s find your starting point."
        }
        description="Share only what’s useful to you. Every target is yours to adjust."
      />
      <div className="editor-layout">
        <div>
          <Card>
            <h2>Your profile</h2>
            <div className="form-grid">
              <Field label="Display name">
                <input
                  value={value.displayName}
                  onChange={(e) =>
                    setValue({ ...value, displayName: e.target.value })
                  }
                />
              </Field>
              <Field
                label="Timezone"
                hint="Dates use this IANA timezone. Existing diary calendar dates stay as recorded."
              >
                <input
                  list="timezones"
                  value={value.timezone}
                  onChange={(e) =>
                    setValue({ ...value, timezone: e.target.value })
                  }
                />
                <datalist id="timezones">
                  {Intl.supportedValuesOf("timeZone").map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </Field>
              <Field label="Units">
                <select
                  value={value.units}
                  onChange={(e) =>
                    setValue({
                      ...value,
                      units: e.target.value as "metric" | "imperial",
                    })
                  }
                >
                  <option value="metric">Metric</option>
                  <option value="imperial">Imperial</option>
                </select>
              </Field>
              <Field label={`Height (${imperial ? "in" : "cm"}, optional)`}>
                <input
                  type="number"
                  step="0.1"
                  value={
                    value.heightCm == null
                      ? ""
                      : Number(
                          (imperial
                            ? cmToIn(value.heightCm)
                            : value.heightCm
                          ).toFixed(2),
                        )
                  }
                  onChange={(e) =>
                    setValue({
                      ...value,
                      heightCm:
                        e.target.value === ""
                          ? null
                          : imperial
                            ? inToCm(Number(e.target.value))
                            : Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field
                label={`Target weight (${imperial ? "lb" : "kg"}, optional)`}
              >
                <input
                  type="number"
                  step="0.1"
                  value={
                    value.targetWeightKg == null
                      ? ""
                      : Number(
                          (imperial
                            ? kgToLb(value.targetWeightKg)
                            : value.targetWeightKg
                          ).toFixed(2),
                        )
                  }
                  onChange={(e) =>
                    setValue({
                      ...value,
                      targetWeightKg:
                        e.target.value === ""
                          ? null
                          : imperial
                            ? lbToKg(Number(e.target.value))
                            : Number(e.target.value),
                    })
                  }
                />
              </Field>
            </div>
            <Field label="Your goals">
              <textarea
                placeholder="What would you like to work toward?"
                value={value.goals}
                onChange={(e) => setValue({ ...value, goals: e.target.value })}
              />
            </Field>
            <Field label="Dietary preferences">
              <textarea
                value={value.preferences}
                onChange={(e) =>
                  setValue({ ...value, preferences: e.target.value })
                }
              />
            </Field>
            <Field
              label="Allergies or exclusions"
              hint="Included in meal AI requests when you consent. Always verify food ingredients yourself."
            >
              <textarea
                value={value.allergies}
                onChange={(e) =>
                  setValue({ ...value, allergies: e.target.value })
                }
              />
            </Field>
            <h2>Daily targets</h2>
            <p className="small muted">
              Initial values are general placeholders, not a personalized
              recommendation. No age, sex or activity assumptions are used. Set
              appropriate targets yourself; wearable calories never change them.
            </p>
            <div className="form-grid">
              {Object.entries(value.targets).map(([key, num]) => (
                <Field
                  key={key}
                  label={`${key[0].toUpperCase() + key.slice(1)} (${key === "calories" ? "kcal" : key === "water" ? (imperial ? "US fl oz" : "ml") : "g"})`}
                >
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={
                      key === "water" && imperial
                        ? Number((num / 29.5735295625).toFixed(2))
                        : num
                    }
                    onChange={(e) =>
                      setValue({
                        ...value,
                        targets: {
                          ...value.targets,
                          [key]:
                            Number(e.target.value) *
                            (key === "water" && imperial ? 29.5735295625 : 1),
                        },
                      })
                    }
                  />
                </Field>
              ))}
            </div>
            <Action
              onClick={async () => {
                await saveSettings(
                  settingsSchema.parse({ ...value, onboarded: true }),
                );
                setNotice("Settings saved.");
              }}
            >
              Save settings
            </Action>
            {notice && (
              <p className="success" role="status">
                {notice}
              </p>
            )}
          </Card>
          <Integration />
        </div>
        <aside>
          <Card>
            <ShieldCheck size={24} />
            <h2>Your data belongs to you.</h2>
            <p className="muted">
              Export your records in JSON with documented dates and units.
              Credentials, passwords, and session tokens are excluded.
            </p>
            {demo ? (
              <Action
                className="button secondary"
                onClick={async () => {
                  const blob = new Blob(
                    [
                      JSON.stringify(
                        {
                          label: "Demo — fictional sample data",
                          settings,
                          records: entries,
                        },
                        null,
                        2,
                      ),
                    ],
                    { type: "application/json" },
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "fictional-demo-export.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download size={16} /> Export demo
              </Action>
            ) : (
              <a className="button secondary" href="/api/export" download>
                <Download size={16} /> Export my data
              </a>
            )}
            <Link className="text-button" to="/privacy">
              Privacy & data handling
            </Link>
          </Card>
          {demo ? (
            <Card>
              <h2>A clean slate</h2>
              <p className="muted">
                All demo changes are temporary and disappear on reload.
              </p>
              <button
                className="button secondary"
                onClick={() => {
                  reset();
                  setValue({ ...defaults, ...settings });
                  setNotice("Demo reset.");
                }}
              >
                Reset fictional demo
              </button>
            </Card>
          ) : (
            <Card>
              <h2>Delete account</h2>
              <p className="muted">
                Permanently delete your active application records, encrypted
                integration credentials, and sessions. Provider backups may
                retain earlier database states for their retention period. This
                cannot be undone in the app.
              </p>
              <Field label="Type DELETE MY ACCOUNT">
                <input
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </Field>
              <Field label="Confirm your password">
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Action
                className="button danger"
                disabled={confirmation !== "DELETE MY ACCOUNT" || !password}
                onClick={async () => {
                  if (
                    !confirm(
                      "Permanently delete your account and all active records?",
                    )
                  )
                    return;
                  await api("/account", {
                    method: "DELETE",
                    body: JSON.stringify({ confirmation, password }),
                  });
                  onDeleted();
                }}
              >
                Delete my account
              </Action>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
function Integration() {
  const { demo, refresh, settings } = useData();
  const [state, setState] = useState<SyncStatus | null>(null);
  const [athleteId, setAthleteId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [startDate, setStartDate] = useState("2020-01-01");
  const [notice, setNotice] = useState("");
  const [deleteHistory, setDeleteHistory] = useState(false);
  const [error, setError] = useState("");
  async function reload() {
    if (demo) return;
    try {
      setState(await api<SyncStatus | null>("/integration"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void reload();
  }, []);
  return (
    <Card>
      <div className="section-heading">
        <h2>
          <Link2 size={20} /> Your Intervals.icu connection
        </h2>
        <span className="pill">
          {demo ? "Simulated" : state?.status || "Not connected"}
        </span>
      </div>
      <p className="muted">
        Helio Strap → Zepp → Intervals.icu → your private dashboard.
      </p>
      <ol className="setup-steps">
        <li>Sync your strap with the Zepp Android app.</li>
        <li>
          Open{" "}
          <a
            href="https://intervals.icu/settings"
            target="_blank"
            rel="noreferrer"
          >
            Intervals.icu Settings
          </a>
          , authorize the Amazfit/Zepp connection, and enable the available
          activity and wellness imports.
        </li>
        <li>
          Create your personal Intervals.icu API key and enter your athlete ID
          below. Zepp Developer Mode is not needed.
        </li>
      </ol>
      <p className="small muted">
        Use your own credentials only. Keys are encrypted on the server and
        never returned to the browser. This initial connection method uses
        personal API keys; Intervals.icu recommends OAuth for broader multi-user
        distribution.
      </p>
      {!demo && (
        <>
          <div className="form-grid">
            <Field label="Athlete ID">
              <input
                placeholder="i123456"
                value={athleteId}
                onChange={(e) => setAthleteId(e.target.value)}
              />
            </Field>
            <Field label={state ? "Replacement API key" : "Personal API key"}>
              <input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Import from"
            hint="Choose your earliest relevant date. The app scans forward in resumable 30-day batches; there is no 90-day application limit."
          >
            <input
              type="date"
              max={dayInZone(new Date(), settings.timezone)}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Action
            disabled={!athleteId || !apiKey}
            onClick={async () => {
              await api("/integration", {
                method: "POST",
                body: JSON.stringify({ athleteId, apiKey, startDate }),
              });
              setApiKey("");
              setNotice("Credentials verified and encrypted. Ready to import.");
              await reload();
            }}
          >
            Verify & {state ? "replace credentials" : "connect"}
          </Action>
        </>
      )}
      {(state || demo) && (
        <>
          <div className="connection-grid">
            {Object.entries(
              state || {
                athlete_id: "Fictional account",
                start_date: "Synthetic fixture",
                imported_through: "Demo only",
                latest_wellness: "Synthetic fixture",
                last_success: "No API request made",
              },
            )
              .filter(([key]) => !["error", "status"].includes(key))
              .map(([key, value]) => (
                <div key={key}>
                  <span>{key.replaceAll("_", " ")}</span>
                  <strong>{value || "Not recorded"}</strong>
                </div>
              ))}
          </div>
          {state?.error && <p className="error">{state.error}</p>}
          <Action
            onClick={async () => {
              if (demo) {
                setNotice("Demo sync simulated. No provider request was made.");
                return;
              }
              let batches = 0,
                more = true;
              while (more && batches < 4) {
                const result = await api<{
                  hasMore?: boolean;
                  records?: number;
                  busy?: boolean;
                }>("/sync", {
                  method: "POST",
                  body: JSON.stringify({ manual: true }),
                });
                batches++;
                more = !!result.hasMore;
                setNotice(
                  result.busy
                    ? "Another sync is running."
                    : `Completed ${batches} batch(es); ${fmt(result.records)} records in latest batch.${more ? " More history remains." : ""}`,
                );
                if (result.busy) break;
              }
              await reload();
              await refresh();
            }}
          >
            Sync now / continue import
          </Action>
          <p className="small muted">
            Each click performs up to four bounded batches, then pauses. Recent
            14-day overlap captures corrections. “All available” means records
            accessible through this API since your chosen start date. Earliest
            dates above are earliest imported records, not a guarantee of
            provider-wide history. Old source dates stay visibly old after a
            successful fetch.
          </p>
          {!demo && (
            <>
              <label className="check">
                <input
                  type="checkbox"
                  checked={deleteHistory}
                  onChange={(e) => setDeleteHistory(e.target.checked)}
                />
                Also delete previously imported activity and wellness records
              </label>
              <Action
                className="text-button danger-text"
                onClick={async () => {
                  if (
                    !confirm(
                      `Disconnect Intervals.icu and ${deleteHistory ? "delete" : "retain"} imported history?`,
                    )
                  )
                    return;
                  await api("/integration", {
                    method: "DELETE",
                    body: JSON.stringify({ deleteHistory }),
                  });
                  setState(null);
                  await refresh();
                }}
              >
                Disconnect & remove credentials
              </Action>
            </>
          )}
        </>
      )}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </Card>
  );
}

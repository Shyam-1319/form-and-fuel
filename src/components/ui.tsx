import { useState, type ReactNode } from "react";
import { X, ArrowUpRight, LoaderCircle } from "lucide-react";
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}
export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-symbol">↗</span>
      <p>{children}</p>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-shade"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <dialog
        open
        aria-modal="true"
        className="modal"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const focusable = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>(
                "button,input,select,textarea,a[href]",
              ),
            ).filter((el) => !el.hasAttribute("disabled"));
            const first = focusable[0],
              last = focusable.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="section-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
            autoFocus
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </dialog>
    </div>
  );
}
export function Action({
  children,
  onClick,
  className = "button",
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => Promise<unknown>;
  className?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        className={className}
        disabled={busy || disabled}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await onClick();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <LoaderCircle className="spin" size={16} /> : null}
        {children}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
export function Stat({
  label,
  value,
  unit,
  detail,
  accent = false,
  onClick,
}: {
  label: string;
  value: string | number;
  unit?: string;
  detail?: string;
  accent?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card className={accent ? "stat accent" : "stat"}>
      <div className="stat-label">
        {label}
        {onClick && (
          <button
            className="icon-button"
            aria-label={`View ${label.toLowerCase()} history`}
            onClick={onClick}
          >
            <ArrowUpRight size={16} />
          </button>
        )}
      </div>
      <div className="stat-value">
        {value}
        <span>{unit}</span>
      </div>
      <p>{detail || "Not recorded"}</p>
    </Card>
  );
}
export function fmt(value: number | null | undefined, digits = 0) {
  return value == null
    ? "—"
    : value.toLocaleString(undefined, { maximumFractionDigits: digits });
}
export function Chart({
  points,
  label,
  unit = "",
  target,
}: {
  points: { label: string; value: number | null }[];
  label: string;
  unit?: string;
  target?: number;
}) {
  const max = Math.max(1, target || 0, ...points.map((p) => p.value || 0));
  return (
    <div
      className="chart"
      role="img"
      aria-label={`${label}. ${points.map((p) => `${p.label}: ${p.value == null ? "not recorded" : fmt(p.value, 1) + unit}`).join("; ")}`}
    >
      <div className="chart-bars">
        {points.map((p, i) => (
          <div className="bar-column" key={`${p.label}-${i}`}>
            <div className="bar-space">
              <div
                title={`${p.label}: ${p.value == null ? "Not recorded" : fmt(p.value, 1) + unit}`}
                className={`bar ${p.value === null ? "missing" : ""} ${i === points.length - 1 ? "current" : ""}`}
                style={{
                  height:
                    p.value === null
                      ? "3px"
                      : `${Math.max(1, (p.value / max) * 100)}%`,
                }}
              />
            </div>
            <small>{p.label}</small>
          </div>
        ))}
      </div>
      <p className="chart-note">{label} · gaps indicate no recorded value</p>
    </div>
  );
}

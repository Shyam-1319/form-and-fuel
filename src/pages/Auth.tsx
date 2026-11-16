import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Leaf } from "lucide-react";
import { api } from "../lib/store";
import { Action, Field } from "../components/ui";
type Mode = "login" | "signup" | "verify" | "reset" | "new-password";
export function Auth({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  async function submit() {
    setMessage("");
    if (mode === "login") {
      await api("/auth/sign-in/email", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      onLogin();
    }
    if (mode === "signup") {
      await api("/auth/sign-up/email", {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
      });
      setMessage("If registration is possible, a code will arrive by email.");
      setMode("verify");
    }
    if (mode === "verify") {
      await api("/auth/email-otp/verify-email", {
        method: "POST",
        body: JSON.stringify({ email, otp }),
      });
      setMode("login");
      setMessage("Email verified. You can sign in.");
    }
    if (mode === "reset") {
      await api("/auth/email-otp/request-password-reset", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMode("new-password");
      setMessage("If an account exists, a reset code will arrive by email.");
    }
    if (mode === "new-password") {
      await api("/auth/email-otp/reset-password", {
        method: "POST",
        body: JSON.stringify({ email, otp, password }),
      });
      setMode("login");
      setMessage("Password reset. Sign in with your new password.");
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Leaf />
          </span>
          form<span className="brand-amp">&</span>fuel
        </Link>
        <div>
          <p className="eyebrow">A LITTLE MORE IN TUNE</p>
          <h1>
            Your health.
            <br />
            Your rhythm.
            <br />
            <em>Your space.</em>
          </h1>
          <p>
            Bring your meals, movement, and everyday progress together. Make
            room for the habits that matter to you.
          </p>
          <Link className="button light" to="/demo">
            Explore the fictional demo <ArrowRight size={16} />
          </Link>
        </div>
        <span className="subtle">
          Private by design. Progress at your pace.
        </span>
      </section>
      <section className="auth-form">
        <span className="pill">FORM & FUEL</span>
        <h2>
          {mode === "login"
            ? "Welcome back."
            : mode === "signup"
              ? "Make yourself at home."
              : mode === "verify"
                ? "Check your inbox."
                : "A fresh start."}
        </h2>
        <p className="muted">
          {mode === "login"
            ? "Sign in to your personal health journal."
            : mode === "signup"
              ? "Create your account. Email verification is required."
              : "Use the single-use code sent to your email."}
        </p>
        {mode === "signup" && (
          <Field label="Display name">
            <input
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </Field>
        )}
        <Field label="Email address">
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        {["login", "signup", "new-password"].includes(mode) && (
          <Field
            label="Password"
            hint={mode !== "login" ? "At least 12 characters." : ""}
          >
            <input
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={12}
              maxLength={128}
            />
          </Field>
        )}
        {["verify", "new-password"].includes(mode) && (
          <Field label="8-digit code">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={8}
            />
          </Field>
        )}
        <Action
          disabled={
            !email || (mode === "signup" && (!name || password.length < 12))
          }
          onClick={submit}
        >
          {mode === "login"
            ? "Sign in"
            : mode === "signup"
              ? "Create account"
              : mode === "verify"
                ? "Verify email"
                : mode === "reset"
                  ? "Send reset code"
                  : "Reset password"}{" "}
          <ArrowRight size={16} />
        </Action>
        {message && (
          <p role="status" className="success">
            {message}
          </p>
        )}
        <div className="auth-links">
          <button
            className="text-button"
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
          >
            {mode === "signup"
              ? "Already have an account? Sign in"
              : "Create an account"}
          </button>
          <button className="text-button" onClick={() => setMode("reset")}>
            Forgot password?
          </button>
          <button className="text-button" onClick={() => setMode("verify")}>
            Verify email
          </button>
          {mode === "verify" && (
            <Action
              className="text-button"
              onClick={async () => {
                await api("/auth/email-otp/send-verification-otp", {
                  method: "POST",
                  body: JSON.stringify({ email, type: "email-verification" }),
                });
                setMessage("If eligible, a new code has been sent.");
              }}
            >
              Resend verification code
            </Action>
          )}
        </div>
        <p className="small muted">
          Your data stays private to your account.{" "}
          <Link to="/privacy">Read the privacy notice</Link>.
        </p>
      </section>
    </div>
  );
}

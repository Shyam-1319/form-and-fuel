import { Link } from "react-router-dom";
export function Privacy() {
  return (
    <main className="privacy-page">
      <Link className="text-button" to="/">
        ← Form & Fuel
      </Link>
      <p className="eyebrow">CLEAR BY DESIGN</p>
      <h1>Your data, explained.</h1>
      <p>
        Form & Fuel stores the health and fitness records you choose to enter:
        meals, recipes, body measurements, weight, water, plans, completed
        sessions, profile settings, and imported wellness and activities. Every
        private record belongs to a verified account.
      </p>
      <h2>Where it goes</h2>
      <p>
        Cloudflare hosts the website, server functions and D1 database. Better
        Auth manages authentication in that database, including secure password
        hashes and expiring sessions. Resend receives your email address and
        verification or password-reset messages for delivery. Provider
        operational logs may include technical request information; the app does
        not deliberately log meal contents or integration keys.
      </p>
      <p>
        When you explicitly request an enabled AI feature, Groq receives the
        information needed for that request: your meal description and relevant
        dietary preferences, or a bounded selection of recent records for a
        weekly review. AI is optional. Responses are estimates, and reviews are
        temporary. There is no automatic paid-provider fallback. Review{" "}
        <a href="https://console.groq.com/docs/your-data">
          Groq’s current data-handling documentation
        </a>
        ; inference is generally not retained, but abuse-related exceptions and
        account settings apply.
      </p>
      <h2>Your wearable connection</h2>
      <p>
        You may connect your own Intervals.icu account. Its API key is encrypted
        using AES-GCM with an application-level key outside D1. The API key is
        never returned after saving. Only read requests are made upstream. This
        application does not connect directly to your strap, request your Zepp
        password, or force a fresh Zepp upload. Disconnecting deletes
        credentials and stops future syncing; you choose whether to retain or
        delete imported records.
      </p>
      <h2>Export and deletion</h2>
      <p>
        Settings provides an authenticated JSON export. Account deletion removes
        active application records and sessions, including encrypted integration
        credentials. Provider-managed backups and operational records can remain
        for their actual retention windows; deletion is not a promise to erase
        all historical provider backups instantly. No unsupported
        regulatory-compliance claim is made.
      </p>
      <h2>Browser storage and the demo</h2>
      <p>
        The browser stores a session cookie and your theme preference. The
        service worker caches only public static application assets, never API
        responses. Private records stay in application memory and clear on
        logout. Offline mode does not queue or synchronize private edits. The
        public demo uses bundled fictional data and temporary state; it does not
        access accounts, integrations, or production AI.
      </p>
      <h2>Health decisions</h2>
      <p>
        This is a personal tracking tool. It does not diagnose conditions,
        guarantee food-allergen safety, or establish causation. Review AI
        estimates and seek qualified advice for medical decisions.
      </p>
      <p>
        Security reports: see SECURITY.md in the public source repository. Do
        not include passwords, keys, or health records in a public issue.
      </p>
    </main>
  );
}

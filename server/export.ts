import type { Env } from "./types";
import { decode, type Row } from "./db";
export async function exportData(env: Env, userId: string) {
  const settings = await env.DB.prepare(
    "SELECT data FROM settings WHERE user_id=?",
  )
    .bind(userId)
    .first<{ data: string }>();
  const now = new Date().toISOString();
  const metadata = {
    format: "form-and-fuel-v1",
    exportedAt: now,
    units: {
      weight: "kg",
      length: "cm",
      distance: "metres",
      duration: "seconds",
      water: "ml",
      macros: "g",
      energy: "kcal",
      HRV: "ms; type stored separately",
    },
    dates:
      "Diary dates are local calendar days; wearable dates are source-local. Export reflects records as each page is read; avoid concurrent edits for a stable snapshot.",
    settings: settings ? JSON.parse(settings.data) : null,
  };
  let cursor = "",
    first = true,
    started = false;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (!started) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify(metadata).slice(0, -1) + ',"records":[',
            ),
          );
          started = true;
        }
        const page = await env.DB.prepare(
          "SELECT id,kind,date,data,created_at,updated_at FROM records WHERE user_id=? AND id>? AND created_at<=? ORDER BY id LIMIT 100",
        )
          .bind(userId, cursor, now)
          .all<Row>();
        for (const row of page.results) {
          controller.enqueue(
            encoder.encode((first ? "" : ",") + JSON.stringify(decode(row))),
          );
          first = false;
          cursor = row.id;
        }
        if (page.results.length < 100) {
          controller.enqueue(encoder.encode("]}"));
          controller.close();
        }
      } catch (error) {
        controller.error(error);
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="form-and-fuel-export.json"',
      "Cache-Control": "no-store",
    },
  });
}

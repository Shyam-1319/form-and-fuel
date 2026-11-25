export type Env = {
  DB: D1Database;
  APP_URL: string;
  BETTER_AUTH_SECRET: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  AI_ENABLED?: string;
  AI_VISION_ENABLED?: string;
  INTEGRATION_ENCRYPTION_KEY?: string;
};
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
}
export const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function readJson(
  request: Request,
  max = 150000,
  maxForValue?: (value: unknown) => number,
) {
  if (Number(request.headers.get("content-length") || 0) > max)
    throw new HttpError(413, "Request too large");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "JSON body required");
  let body = "",
    bytes = 0;
  const decoder = new TextDecoder();
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > max) {
      await reader.cancel();
      throw new HttpError(413, "Request too large");
    }
    body += decoder.decode(chunk.value, { stream: true });
  }
  body += decoder.decode();
  let value: unknown;
  try {
    value = JSON.parse(body) as unknown;
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
  if (maxForValue && bytes > maxForValue(value))
    throw new HttpError(413, "Request too large");
  return value;
}

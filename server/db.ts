import { HttpError } from "./types";
import type { Entry, Kind, DataByKind } from "../src/lib/domain";
export type Row = {
  id: string;
  kind: Kind;
  date: string;
  data: string;
  created_at: string;
  updated_at: string;
};
export const decode = <K extends Kind = Kind>(r: Row): Entry<K> => ({
  id: r.id,
  kind: r.kind as K,
  date: r.date,
  data: JSON.parse(r.data) as DataByKind[K],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
export async function owned(db: D1Database, userId: string, id: string) {
  const row = await db
    .prepare(
      "SELECT id,kind,date,data,created_at,updated_at FROM records WHERE user_id=? AND id=?",
    )
    .bind(userId, id)
    .first<Row>();
  if (!row) throw new HttpError(404, "Record not found");
  return decode(row);
}
export async function quota(
  db: D1Database,
  bucket: string,
  limit: number,
  expires: string,
) {
  const result = await db
    .prepare(
      "INSERT INTO usage(bucket,count,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count",
    )
    .bind(bucket, expires, limit)
    .first();
  if (!result)
    throw new HttpError(429, "Usage limit reached. Please try again later.");
}

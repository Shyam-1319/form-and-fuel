import { handleRequest } from "../../server/app";
import type { Env } from "../../server/types";
export const onRequest: PagesFunction<Env> = (context) =>
  handleRequest(context.request, context.env);

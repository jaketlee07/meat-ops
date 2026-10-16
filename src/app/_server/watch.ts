import "server-only";
import { cache } from "react";
import { appToday } from "../../lib/app-today";
import { refreshAlerts, RpcError } from "../../lib/rpc";
import { createSessionClient } from "./session";

export type Watch = { status: "ok"; open: number; urgent: number } | { status: "failed" };

// One watch for the request: the header and /alerts share the cached answer.
// It never throws, so a refused or unanswered watch cannot break a page. The
// log line names no figure, product, or alert.
export const runWatch = cache(async (): Promise<Watch> => {
  try {
    const client = await createSessionClient({ readOnly: true });
    const { open, urgent } = await refreshAlerts(client, appToday(new Date()));
    return { status: "ok", open, urgent };
  } catch (error) {
    const code = error instanceof RpcError ? error.code : "";
    console.error(`runWatch failed${code ? ` (code ${code})` : ""}`);
    return { status: "failed" };
  }
});

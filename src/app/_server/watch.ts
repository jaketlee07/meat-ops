import "server-only";
import { cache } from "react";
import { appToday } from "../../lib/app-today";
import { watchFailureLogLine } from "../../lib/failures";
import { refreshAlerts } from "../../lib/rpc";
import { createSessionClient } from "./session";

export type Watch = { status: "ok"; open: number; urgent: number } | { status: "failed" };

// One watch for the request: the header and /alerts share the cached answer.
// It never throws, so a refused or unanswered watch cannot break a page. The
// log line gives the cause by a fixed label and names no figure, product, or alert.
export const runWatch = cache(async (): Promise<Watch> => {
  try {
    const client = await createSessionClient({ readOnly: true });
    const { open, urgent } = await refreshAlerts(client, appToday(new Date()));
    return { status: "ok", open, urgent };
  } catch (error) {
    console.error(watchFailureLogLine(error));
    return { status: "failed" };
  }
});

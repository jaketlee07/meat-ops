// The app server runs in this time zone (playwright.config.ts sets TZ for it),
// so the suite can work out the app's today the way the app does: today's date
// in the app server process's local time zone.
export const APP_TIME_ZONE = "America/Chicago";

// YYYY-MM-DD for the app's today, moved by `days` calendar days.
export function appDate(days = 0, now = new Date()): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const shifted = new Date(`${today}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

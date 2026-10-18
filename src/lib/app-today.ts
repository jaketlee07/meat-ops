// The app's time zone is the app server process's local time zone, and the
// app's today is today's date in it. Pure: each function takes the instant it
// reads, so a test passes an exact one and sets TZ itself.

function localDate(instant: Date): string {
  const year = String(instant.getFullYear()).padStart(4, "0");
  const month = String(instant.getMonth() + 1).padStart(2, "0");
  const day = String(instant.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function appToday(now: Date): string {
  return localDate(now);
}

// AC-0106: the date of a stored timestamp (an ISO text or a Date) in the app's
// time zone, as YYYY-MM-DD.
export function dateInAppZone(timestamp: string | Date): string {
  return localDate(new Date(timestamp));
}

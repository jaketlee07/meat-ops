// The Host values the app answers: 127.0.0.1 or localhost on any port, and the
// one name in APP_HOST. A page on another name that resolves to this machine
// (DNS rebinding) sends its own name, so it is refused before anything runs.
const LOCAL_HOST = /^(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/i;

// `host` is the raw Host header, null when absent. `appHost` is compared whole,
// ignoring letter case; unset or empty means no hosted name, so an empty Host
// never matches. Exact equality, not a pattern, so no escaping is needed and a
// look-alike cannot match.
export function isAllowedHost(host: string | null, appHost: string | undefined): boolean {
  if (host === null) return false;
  if (LOCAL_HOST.test(host)) return true;
  return appHost !== undefined && appHost !== "" && host.toLowerCase() === appHost.toLowerCase();
}

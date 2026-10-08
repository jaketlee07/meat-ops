// The name rule for a privileged variable, and the one place it lives. It looks
// at variable names only and never reads a value, so a value cannot reach a log
// or a client bundle through here.
const PRIVILEGED_NAME = /SERVICE_ROLE|SECRET|JWT|DB_URL|DATABASE_URL|POSTGRES/i;

export function privilegedVariableNames(): string[] {
  return Object.keys(process.env).filter((name) => PRIVILEGED_NAME.test(name));
}

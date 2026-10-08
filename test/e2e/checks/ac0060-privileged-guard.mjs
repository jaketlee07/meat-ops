// AC-0060 loop: for each check name, `npm run build`, then (after one clean
// build) `npm run start`, then `npm run dev`, each with only that variable added.
// Each must exit non-zero, print the name, and print no marker.
import { spawn, spawnSync } from "node:child_process";

const NAMES = [
  "SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SECRET_KEY",
  "SUPABASE_SECRET_KEY",
  "JWT_SECRET",
  "S3_PROTOCOL_ACCESS_KEY_SECRET",
  "DB_URL",
  "DATABASE_URL",
  "POSTGRES_URL",
];
const RULE = /SERVICE_ROLE|SECRET|JWT|DB_URL|DATABASE_URL|POSTGRES/i;
const REPO = process.argv[2];
const results = [];

const baseEnv = { ...process.env };
for (const key of Object.keys(baseEnv)) if (RULE.test(key)) delete baseEnv[key];

function run(label, script, name, timeoutMs) {
  const marker = `MARKER_${name}`;
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", script], {
      cwd: REPO,
      env: { ...baseEnv, [name]: marker },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {}
    }, timeoutMs);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      // Sweep any stragglers in the process group.
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {}
      const nonZero = code !== null && code !== 0;
      const printsName = out.includes(
        `Refusing to run: privileged variable(s) in the app environment: ${name}`,
      );
      const noMarker = !out.includes(marker);
      const pass = !timedOut && nonZero && printsName && noMarker;
      results.push({ label, name, pass, code, signal, timedOut, nonZero, printsName, noMarker });
      if (!pass) console.log(`--- FAIL ${label} ${name}\n${out.slice(0, 1500)}`);
      resolve();
    });
  });
}

for (const name of NAMES) await run("build", "build", name, 90_000);

// One clean build for the start loop.
spawnSync("rm", ["-rf", ".next"], { cwd: REPO });
const clean = spawnSync("npm", ["run", "build"], { cwd: REPO, env: baseEnv, encoding: "utf8" });
console.log(`clean build exit=${clean.status}`);

for (const name of NAMES) await run("start", "start", name, 20_000);
for (const name of NAMES) await run("dev", "dev", name, 20_000);

for (const r of results) {
  console.log(
    `${r.pass ? "PASS" : "FAIL"} ${r.label.padEnd(5)} ${r.name.padEnd(30)} exit=${r.code} name-printed=${r.printsName} marker-absent=${r.noMarker} timedOut=${r.timedOut}`,
  );
}
const failed = results.filter((r) => !r.pass).length;
console.log(`total=${results.length} failed=${failed}`);
process.exit(failed === 0 && clean.status === 0 ? 0 : 1);

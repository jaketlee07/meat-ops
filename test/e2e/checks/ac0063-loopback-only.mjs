// AC-0063: for `npm run start` and `npm run dev`, walk the process tree from
// the npm pid with pgrep -P, then list TCP listeners for every pid in the tree.
// The listing must be non-empty and every address 127.0.0.1.
import { spawn, spawnSync } from "node:child_process";

const REPO = process.argv[2];
const RULE = /SERVICE_ROLE|SECRET|JWT|DB_URL|DATABASE_URL|POSTGRES/i;
const env = { ...process.env };
for (const key of Object.keys(env)) if (RULE.test(key)) delete env[key];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function tree(rootPid) {
  const all = [rootPid];
  let frontier = [rootPid];
  while (frontier.length) {
    const next = [];
    for (const pid of frontier) {
      const r = spawnSync("pgrep", ["-P", String(pid)], { encoding: "utf8" });
      for (const line of r.stdout.split("\n")) if (line.trim()) next.push(Number(line.trim()));
    }
    all.push(...next);
    frontier = next;
  }
  return all;
}

async function check(script, port) {
  const child = spawn("npm", ["run", script, "--", "-p", String(port)], {
    cwd: REPO,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (out += d));
  let exited = false;
  child.on("close", () => (exited = true));

  let ready = false;
  for (let i = 0; i < 60 && !exited; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, { redirect: "manual" });
      ready = res.status > 0;
      if (ready) break;
    } catch {}
    await sleep(500);
  }
  const pids = tree(child.pid);
  const lsof = spawnSync("lsof", ["-a", "-nP", "-iTCP", "-sTCP:LISTEN", "-p", pids.join(",")], {
    encoding: "utf8",
  });
  const lines = lsof.stdout.split("\n").filter((l) => l.trim());
  const rows = lines.slice(1);
  const addresses = rows.map((l) => l.trim().split(/\s+/)[8]);
  const allLocal = addresses.length > 0 && addresses.every((a) => a.startsWith("127.0.0.1:"));
  console.log(`== npm run ${script} (port ${port}) ready=${ready} exited=${exited}`);
  console.log(`   pids in tree: ${pids.join(" ")}`);
  console.log(lsof.stdout.trimEnd().split("\n").map((l) => "   " + l).join("\n"));
  console.log(`   listeners=${rows.length} every-address-127.0.0.1=${allLocal} -> ${ready && allLocal ? "PASS" : "FAIL"}`);

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {}
  await sleep(1500);
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {}
  return ready && allLocal;
}

const a = await check("start", 3105);
const b = await check("dev", 3106);
process.exit(a && b ? 0 : 1);

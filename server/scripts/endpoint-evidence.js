import { execFileSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const server = path.join(root, "server");
const directory = mkdtempSync(path.join(tmpdir(), "checkpoint-endpoints-"));
const log = path.join(directory, "requests.jsonl");
try {
  execFileSync(
    process.execPath,
    [
      "--test",
      "--test-concurrency=1",
      ...readdirSync(path.join(server, "test"))
        .filter((name) => name.endsWith(".test.js"))
        .map((name) => path.join("test", name)),
    ],
    {
      cwd: server,
      env: { ...process.env, CHECKPOINT_ROUTE_LOG: log },
      stdio: "inherit",
    },
  );
  const app = readFileSync(path.join(server, "src/app.js"), "utf8");
  const imports = new Map(
    [...app.matchAll(/import \{ (\w+) \} from "\.\/routes\/([^\"]+)"/g)].map(
      (match) => [match[1], match[2]],
    ),
  );
  const routes = [
    { method: "GET", path: "/api/health", routeSource: "server/src/app.js" },
  ];
  for (const match of app.matchAll(/app\.use\("([^"]+)",\s*(\w+)\)/g)) {
    const file = imports.get(match[2]);
    if (!file) continue;
    const text = readFileSync(path.join(server, "src/routes", file), "utf8");
    for (const route of text.matchAll(
      /\w+Router\.(get|post|patch|delete)\(\s*"([^"]+)"/g,
    ))
      routes.push({
        method: route[1].toUpperCase(),
        path: (match[1] + route[2])
          .replace(/\/$/, "")
          .replace(/:[\w]+/g, ":id"),
        routeSource: `server/src/routes/${file}`,
      });
  }
  const requests = readFileSync(log, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const results = routes.map((route) => {
    const matches = requests.filter(
      (row) => row.method === route.method && row.path === route.path,
    );
    return {
      ...route,
      successfulResponses: matches.filter(
        (row) => row.status >= 200 && row.status < 300,
      ).length,
      statuses: [...new Set(matches.map((row) => row.status))].sort(
        (a, b) => a - b,
      ),
    };
  });
  const report = {
    generatedAt: new Date().toISOString(),
    kind: "Observed isolated API integration requests, not unit or branch coverage",
    routeCount: results.length,
    successfulRouteCount: results.filter((row) => row.successfulResponses > 0)
      .length,
    routes: results,
  };
  writeFileSync(
    path.join(root, "docs/endpoint-test-evidence.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    `Observed successful requests: ${report.successfulRouteCount}/${report.routeCount} API routes`,
  );
  if (report.successfulRouteCount !== report.routeCount) {
    console.error(results.filter((row) => !row.successfulResponses));
    process.exitCode = 1;
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { JSDOM } = require("jsdom");
const base = require("node:path").resolve(__dirname, "..");
const { buildSync } = require(base + "/node_modules/esbuild");
const dom = new JSDOM(
  '<!doctype html><html><body><div id="root"></div></body></html>',
  { url: "http://localhost:5173" },
);
Object.assign(global, {
  window: dom.window,
  document: dom.window.document,
  sessionStorage: dom.window.sessionStorage,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(global, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
const React = require(base + "/node_modules/react");
const { act } = React;
const { createRoot } = require(base + "/node_modules/react-dom/client");
buildSync({
  entryPoints: [base + "/src/App.jsx"],
  outfile: base + "/node_modules/.cache/review-app.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["react"],
  jsx: "automatic",
});
const { App } = require(base + "/node_modules/.cache/review-app.cjs");
const user = {
  _id: "u1",
  displayName: "Alex Rivera",
  role: "developer",
  username: "alex",
};
let rejectStatus = false;
let db = {
  teams: [{ _id: "t1", name: "Pixel Forge", description: "An indie studio" }],
  projects: [
    {
      _id: "p1",
      name: "Starfall",
      description: "A 2D adventure",
      status: "active",
      teamId: "t1",
    },
  ],
  milestones: [
    {
      _id: "m1",
      name: "Playable prototype",
      status: "in_progress",
      projectId: "p1",
    },
  ],
  tasks: [
    {
      _id: "task1",
      title: "Player movement",
      status: "done",
      assigneeId: "u1",
      priority: "high",
    },
  ],
  "bug-reports": [],
  "playtest-feedback": [
    { _id: "f1", userId: "u1", rating: 4, comments: "Great controls" },
  ],
};
const calls = [];
global.fetch = async (path, options = {}) => {
  calls.push({ path, options });
  const p = path.split("?")[0].replace("/api/", "");
  const [resource, id] = p.split("/");
  let status = 200,
    data;
  if (p === "auth/me") data = { user };
  else if (p === "auth/login") data = { user, token: "fixture" };
  else if (p === "users") data = [user];
  else if (p === "teams/t1/members")
    data = [{ _id: "tm1", userId: "u1", role: "owner" }];
  else if (options.method === "PATCH") {
    if (rejectStatus) {
      status = 500;
      data = { error: "Project update rejected" };
    } else {
      data = db[resource].find((x) => x._id === id);
      Object.assign(data, JSON.parse(options.body));
    }
  } else if (options.method === "POST") {
    data = { _id: "new" + calls.length, ...JSON.parse(options.body) };
    db[resource].push(data);
    status = 201;
  } else data = db[resource];
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
};
let root = createRoot(document.getElementById("root"));
const tick = () => new Promise((r) => setTimeout(r, 0));
const buttons = () => [...document.querySelectorAll("button")];
const findButton = (text) => {
  const b = buttons().find((b) => b.textContent.trim() === text);
  assert(b, "Missing button " + text);
  return b;
};
async function click(text) {
  await act(async () => {
    findButton(text).click();
    await tick();
  });
}
const field = (label) => {
  const l = [...document.querySelectorAll("label")].find(
    (l) => l.firstChild?.textContent.trim() === label,
  );
  assert(l, "Missing field " + label);
  return l.querySelector("input,select,textarea");
};
async function change(label, value) {
  await act(async () => {
    const el = field(label);
    const proto =
      el.tagName === "SELECT"
        ? window.HTMLSelectElement.prototype
        : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(
      new window.Event(el.tagName === "SELECT" ? "change" : "input", {
        bubbles: true,
      }),
    );
    await tick();
  });
}
test("dashboard navigation, data updates, and failed status regression", async () => {
  sessionStorage.setItem("mern_token", "fixture");
  await act(async () => {
    root.render(
      React.createElement(React.StrictMode, null, React.createElement(App)),
    );
    await tick();
  });
  assert(document.body.textContent.includes("Development teams"));
  await click("Open");
  await click("Open");
  assert.equal(document.querySelectorAll(".stat-card").length, 4);
  assert.equal(document.querySelector("progress").value, 1);
  assert.equal(document.activeElement.id, "main-content");
  await change("Project status", "completed");
  assert(document.body.textContent.includes("Status: completed"));
  rejectStatus = true;
  await change("Project status", "archived");
  assert.equal(field("Project status").value, "completed");
  assert(
    document
      .querySelector("[role=alert]")
      .textContent.includes("Project update rejected"),
  );
  rejectStatus = false;
  await click("03Tasks");
  await change("Task title", "Design level one");
  await act(async () => {
    findButton("Add task").form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await tick();
  });
  assert(
    db.tasks.some(
      (t) =>
        t.title === "Design level one" &&
        t.projectId === "p1" &&
        t.assigneeId === "u1" &&
        t.milestoneId === "m1",
    ),
  );
  await click("01Overview");
  assert.equal(document.querySelector("progress").max, 2);
  await click("Sign out");
  assert.equal(sessionStorage.getItem("mern_token"), null);
  assert(field("Username"));
  await act(async () => root.unmount());
  db.tasks = [];
  db.milestones = [];
  db["playtest-feedback"] = [];
  sessionStorage.setItem("mern_token", "fixture");
  root = createRoot(document.getElementById("root"));
  await act(async () => {
    root.render(React.createElement(App));
    await tick();
  });
  await click("Open");
  await click("Open");
  assert(document.body.textContent.includes("Set your first milestone"));
  assert.equal(document.querySelector("progress").value, 0);
  assert.equal(document.querySelector("progress").max, 1);
  await act(async () => root.unmount());
});

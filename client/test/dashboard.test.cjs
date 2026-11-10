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
  entryPoints: [base + "/src/App.tsx"],
  outfile: base + "/node_modules/.cache/review-app.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["react"],
  jsx: "automatic",
});
// jsdom does not implement the browser's modal focus/top-layer behavior.
window.HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
window.HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};
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
  builds: [],
  "bug-reports": [
    {
      _id: "bug1",
      title: "Platform collision",
      description: "Falls through",
      severity: "high",
      status: "open",
    },
  ],
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
  else if (p === "auth/logout") data = { ok: true };
  else if (p === "auth/oauth/providers") data = { providers: [] };
  else if (p === "users") data = [user, { _id: "u2", displayName: "Sam Chen" }];
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
  } else
    data = id ? db[resource].find((item) => item._id === id) : db[resource];
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
};
let root = createRoot(document.getElementById("root"));
const tick = () => new Promise((r) => setTimeout(r, 0));
const buttons = () => [...document.querySelectorAll("button")];
const findButton = (text) => {
  const b = buttons().find(
    (b) =>
      b.textContent.trim() === text || b.getAttribute("aria-label") === text,
  );
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
  const scope = document.querySelector("dialog[open]") || document;
  const l = [...scope.querySelectorAll("label")].find(
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
        : el.tagName === "TEXTAREA"
          ? window.HTMLTextAreaElement.prototype
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
  window.localStorage.removeItem("mern_sidebar_width");
  await act(async () => {
    root.render(
      React.createElement(React.StrictMode, null, React.createElement(App)),
    );
    await tick();
  });
  assert(document.body.textContent.includes("Development teams"));
  const resizer = document.querySelector('[role="separator"]');
  assert.equal(resizer.getAttribute("aria-valuenow"), "234");
  await act(async () => {
    resizer.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      }),
    );
    await tick();
  });
  assert.equal(
    document.querySelector('[role="separator"]').getAttribute("aria-valuenow"),
    "250",
  );
  assert.equal(window.localStorage.getItem("mern_sidebar_width"), "250");
  await click("Open");
  await click("Open");
  assert(document.body.textContent.includes("Task board"));
  await click("Overview");
  assert.equal(document.querySelectorAll(".project-ledger > div").length, 4);
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
  await click("Task board");
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
  await click("Overview");
  assert.equal(document.querySelector("progress").max, 2);
  await click("Sign out");
  assert(field("Username"));
  await act(async () => root.unmount());
  db.tasks = [];
  db.milestones = [];
  db["playtest-feedback"] = [];
  root = createRoot(document.getElementById("root"));
  await act(async () => {
    root.render(React.createElement(App));
    await tick();
  });
  await click("Open");
  await click("Open");
  await click("Overview");
  assert(document.body.textContent.includes("Set your first milestone"));
  assert.equal(document.querySelector("progress").value, 0);
  assert.equal(document.querySelector("progress").max, 1);
  await act(async () => root.unmount());
});

test("board filters, task and bug detail drawers, and linked build feedback", async () => {
  db.tasks = [
    {
      _id: "edit-task",
      projectId: "p1",
      milestoneId: "m1",
      title: "Movement controls",
      description: "Keyboard and gamepad",
      status: "todo",
      assigneeId: "u1",
      priority: "high",
    },
    {
      _id: "other-task",
      projectId: "p1",
      milestoneId: "m1",
      title: "Background art",
      description: "Forest painting",
      status: "in_progress",
      assigneeId: "u2",
      priority: "low",
    },
  ];
  db.milestones = [
    { _id: "m1", name: "Playable prototype", status: "in_progress" },
  ];
  db.builds = [];
  root = createRoot(document.getElementById("root"));
  await act(async () => {
    root.render(
      React.createElement(React.StrictMode, null, React.createElement(App)),
    );
    await tick();
  });
  await click("Open");
  await click("Open");
  assert.equal(document.querySelectorAll(".work-card").length, 2);
  await change("Search tasks", "gamepad");
  assert.equal(document.querySelectorAll(".work-card").length, 1);
  await change("Filter by priority", "low");
  assert.equal(document.querySelectorAll(".work-card").length, 0);
  assert(
    document
      .querySelector("[role=status]")
      .textContent.includes("No tasks match"),
  );
  await click("Clear filters");
  await change("Filter by assignee", "u2");
  assert.equal(document.querySelectorAll(".work-card").length, 1);
  await change("Filter by milestone", "m1");
  assert.equal(document.querySelectorAll(".work-card").length, 1);
  await click("Clear filters");
  await act(async () => {
    document.querySelector(".toggle-filter input").click();
    await tick();
  });
  assert.equal(document.querySelectorAll(".work-card").length, 1);
  await click("Movement controls");
  assert(document.querySelector("dialog[open]"));
  assert.equal(field("Title").value, "Movement controls");
  await change("Title", "Movement revised");
  rejectStatus = true;
  await act(async () => {
    findButton("Save changes").form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await tick();
  });
  assert(document.querySelector("dialog [role=alert]"));
  assert.equal(db.tasks[0].title, "Movement controls");
  rejectStatus = false;
  await act(async () => {
    findButton("Save changes").form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await tick();
  });
  assert.equal(document.querySelector("dialog"), null);
  assert.equal(db.tasks[0].title, "Movement revised");
  await click("Movement revised");
  await act(async () => {
    const e = new window.Event("cancel", { cancelable: true });
    document.querySelector("dialog").dispatchEvent(e);
    await tick();
  });
  assert.equal(document.querySelector("dialog"), null);
  await click("Bug reports");
  await click("Platform collision");
  await change("Severity", "low");
  await act(async () => {
    findButton("Save changes").form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await tick();
  });
  assert.equal(db["bug-reports"][0].severity, "low");
  await click("Builds");
  await change("Build version", "0.2.0");
  await change("Download URL", "https://example.com/game.zip");
  await act(async () => {
    findButton("Publish build link").form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await tick();
  });
  assert.equal(db.builds.length, 1);
  assert.equal(db.builds[0].projectId, "p1");
  assert.equal(
    document.querySelector(".button-link").getAttribute("rel"),
    "noopener noreferrer",
  );
  await click("Give feedback");
  assert.equal(field("Build tested").value, db.builds[0]._id);
  await change("Comments", "Jump feedback on 0.2.0");
  await act(async () => {
    findButton("Add feedback").form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await tick();
  });
  assert.equal(db["playtest-feedback"].at(-1).buildId, db.builds[0]._id);
  await act(async () => root.unmount());
});

const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
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
beforeEach(() => {
  window.history.replaceState({ checkpointIndex: 0 }, "", "#/teams");
  window.confirm = () => true;
});
const user = {
  _id: "u1",
  displayName: "Alex Rivera",
  role: "developer",
  username: "alex",
};
let rejectStatus = false;
let rejectComment = false;
let githubConnected = true;
let rejectScreenshot = false;
let screenshots = [];
let activityEvents = [];
let rejectActivity = false;
let notificationItems = [];
let rejectNotification = false;
let discussion = [];
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
  "playtest-sessions": [],
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
  if (resource === "notifications") {
    if (options.method === "PATCH") {
      if (rejectNotification) {
        status = 500;
        data = { error: "Notification update failed" };
      } else {
        data = notificationItems.find((item) => item._id === id);
        data.readOn = JSON.parse(options.body).read
          ? new Date().toISOString()
          : null;
      }
    } else {
      const unread =
        new URL(path, "http://localhost").searchParams.get("unread") === "true";
      data = {
        notifications: notificationItems
          .filter((item) => !unread || !item.readOn)
          .map((item) => ({ ...item })),
        unreadCount: notificationItems.filter((item) => !item.readOn).length,
        hasMore: false,
        nextBefore: null,
      };
    }
  } else if (resource === "activity") {
    if (rejectActivity) {
      status = 500;
      data = { error: "Activity unavailable" };
    } else {
      const before = new URL(path, "http://localhost").searchParams.get(
        "before",
      );
      data = {
        events: before ? activityEvents.slice(1) : activityEvents.slice(0, 1),
        hasMore: !before && activityEvents.length > 1,
        nextBefore: !before ? activityEvents[0]?._id : null,
      };
    }
  } else if (/^bug-reports\/[^/]+\/screenshots(?:\/[^/]+)?$/.test(p)) {
    const imageId = p.split("/")[3];
    if (options.method === "POST") {
      if (rejectScreenshot) {
        status = 500;
        data = { error: "Upload failed" };
      } else {
        data = {
          _id: "image" + calls.length,
          contentType: "image/png",
          size: 20,
          createdOn: new Date().toISOString(),
        };
        screenshots.push(data);
        status = 201;
      }
    } else if (options.method === "DELETE") {
      screenshots = screenshots.filter((image) => image._id !== imageId);
      return new Response(null, { status: 204 });
    } else if (imageId)
      return new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    else data = [...screenshots];
  } else if (/^tasks\/[^/]+\/comments$/.test(p)) {
    if (options.method === "POST") {
      if (rejectComment) {
        status = 500;
        data = { error: "Comment could not be saved" };
      } else {
        data = {
          _id: "comment" + calls.length,
          ...JSON.parse(options.body),
          authorName: user.displayName,
          createdOn: new Date().toISOString(),
        };
        discussion.push(data);
        status = 201;
      }
    } else
      data = { comments: [...discussion], hasMore: false, nextBefore: null };
  } else if (p === "auth/me") data = { user };
  else if (p === "auth/login") data = { user, token: "fixture" };
  else if (p === "users") data = [user, { _id: "u2", displayName: "Sam Chen" }];
  else if (p === "github/repositories")
    data = {
      connected: githubConnected,
      login: githubConnected ? "octocat" : null,
      oauthConfigured: true,
      callbackUrl: "http://127.0.0.1:4000/api/github/callback",
      installUrl: null,
      repositories: githubConnected
        ? [
            {
              fullName: "morningsoftware/mern-stack-project",
              installationId: 7,
            },
          ]
        : [],
    };
  else if (p === "github/deliveries")
    data = {
      deliveries: [
        {
          _id: "d1",
          event: "push",
          action: null,
          repository: "morningsoftware/mern-stack-project",
          detail: "main · 1 commit",
          receivedOn: "2026-11-01T00:00:00.000Z",
        },
      ],
    };
  else if (p === "github/events") data = { events: ["push", "pull_request"] };
  else if (p === "github/pulls")
    data = {
      pulls: [
        {
          number: 4,
          title: "Fix jump",
          state: "open",
          url: "https://github.com/example/pull/4",
          author: "sam",
        },
      ],
    };
  else if (p === "github/repository")
    data = {
      repository: {
        fullName: "morningsoftware/mern-stack-project",
        description: "Studio tools",
        visibility: "private",
        defaultBranch: "main",
        url: "https://github.com/morningsoftware/mern-stack-project",
        homepage: null,
        stars: 12,
        forks: 2,
        openIssues: 3,
        language: "TypeScript",
        license: "MIT License",
        archived: false,
        pushedAt: "2026-11-02T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      languages: [
        { name: "TypeScript", bytes: 80, share: 80 },
        { name: "CSS", bytes: 20, share: 20 },
      ],
      contributors: [
        { login: "sam", contributions: 4, url: "https://github.com/sam" },
      ],
      contributorsReady: true,
      branches: [
        {
          name: "feat",
          sha: "bbb2222",
          protected: false,
          default: false,
          committedAt: "2026-11-02T00:00:00.000Z",
          message: "Add camera",
          author: "sam",
        },
        {
          name: "main",
          sha: "aaa1111",
          protected: true,
          default: true,
          committedAt: "2026-10-01T00:00:00.000Z",
          message: "Start project",
          author: "alex",
        },
      ],
      branchesTruncated: false,
      commits: [
        {
          sha: "bbb2222ccc",
          message: "Add camera",
          author: "sam",
          date: "2026-11-02T00:00:00.000Z",
          url: "https://github.com/morningsoftware/mern-stack-project/commit/bbb2222ccc",
        },
      ],
    };
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
    data = {
      _id: "new" + calls.length,
      ...(resource === "playtest-sessions" ? { status: "open" } : {}),
      ...JSON.parse(options.body),
    };
    db[resource].push(data);
    status = 201;
  } else
    data = id ? db[resource].find((item) => item._id === id) : db[resource];
  if (data === undefined) {
    status = 404;
    data = { error: "Not found" };
  }
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
  sessionStorage.setItem("mern_token", "fixture");
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
    document.querySelector(".work-board .toggle-filter input").click();
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

test("Checkpoint milestone roadmap, editing, failed save, date clearing, and creation", async () => {
  db.milestones = [
    {
      _id: "plan-1",
      name: "Old prototype",
      description: "Initial scope",
      dueDate: "2000-01-01T00:00:00Z",
      status: "todo",
    },
    {
      _id: "plan-2",
      name: "Finished release",
      dueDate: "2000-01-01T00:00:00Z",
      status: "completed",
    },
  ];
  db.tasks = [
    {
      _id: "linked-1",
      title: "Linked work",
      milestoneId: "plan-1",
      status: "done",
      assigneeId: "u1",
      priority: "high",
    },
  ];
  sessionStorage.setItem("mern_token", "fixture");
  root = createRoot(document.getElementById("root"));
  try {
    await act(async () => {
      root.render(
        React.createElement(React.StrictMode, null, React.createElement(App)),
      );
      await tick();
    });
    assert.equal(document.querySelector(".brand img").alt, "checkpoint");
    await click("Open");
    await click("Open");
    await click("Milestones");
    assert.equal(document.querySelectorAll(".milestone-entry").length, 2);
    assert.equal(document.querySelectorAll(".overdue-flag").length, 1);
    assert(
      [...document.querySelectorAll(".milestone-entry")]
        .find((entry) => entry.textContent.includes("Old prototype"))
        .textContent.includes("1 of 1 linked tasks done"),
    );
    await click("Overdue");
    assert.equal(document.querySelectorAll(".milestone-entry").length, 1);
    await click("Old prototype");
    assert.equal(field("Due date").value, "2000-01-01");
    await change("Milestone name", "Revised prototype");
    await change("Description", "Revised scope");
    await change("Due date", "2099-05-12");
    rejectStatus = true;
    await act(async () => {
      findButton("Save milestone").form.dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await tick();
    });
    assert(document.querySelector("dialog [role=alert]"));
    assert.equal(db.milestones[0].name, "Old prototype");
    assert.equal(field("Milestone name").value, "Revised prototype");
    rejectStatus = false;
    await act(async () => {
      findButton("Save milestone").form.dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await tick();
    });
    assert.equal(document.querySelector("dialog"), null);
    assert.equal(db.milestones[0].dueDate, "2099-05-12");
    assert.equal(db.milestones[0].description, "Revised scope");
    assert.equal(document.querySelectorAll(".milestone-entry").length, 0);
    await click("All milestones");
    await click("Revised prototype");
    await change("Due date", "");
    await act(async () => {
      findButton("Save milestone").form.dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await tick();
    });
    assert.equal(db.milestones[0].dueDate, null);
    assert(document.body.textContent.includes("Unscheduled"));
    await change("Milestone name", "Beta release");
    await change("Milestone description", "First public playtest");
    await act(async () => {
      findButton("Add milestone").form.dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await tick();
    });
    assert(
      db.milestones.some(
        (item) =>
          item.name === "Beta release" &&
          item.description === "First public playtest" &&
          item.projectId === "p1",
      ),
    );
    await click("Completed");
    assert.equal(document.querySelectorAll(".milestone-entry").length, 1);
  } finally {
    rejectStatus = false;
    await act(async () => root.unmount());
  }
});

test("feedback triage, structured bug creation, source links, and unsent-draft protection", async () => {
  db.builds = [
    {
      _id: "qa-build",
      version: "0.4.0",
      platform: "web",
      downloadUrl: "https://example.com/game",
    },
    {
      _id: "qa-other",
      version: "0.5.0",
      platform: "windows",
      downloadUrl: "https://example.com/other",
    },
  ];
  db["playtest-feedback"] = [
    {
      _id: "qa-low",
      projectId: "p1",
      userId: "u2",
      buildId: "qa-build",
      rating: 2,
      comments: "The character sticks on the ledge.",
    },
    {
      _id: "qa-high",
      projectId: "p1",
      userId: "u1",
      buildId: "qa-other",
      rating: 5,
      comments: "Good controls",
      reviewStatus: "reviewed",
    },
  ];
  db["bug-reports"] = [];
  sessionStorage.setItem("mern_token", "fixture");
  root = createRoot(document.getElementById("root"));
  try {
    await act(async () => {
      root.render(
        React.createElement(React.StrictMode, null, React.createElement(App)),
      );
      await tick();
    });
    await click("Open");
    await click("Open");
    await click("Playtest feedback");
    assert.equal(document.querySelectorAll(".feedback-report").length, 2);
    await change("Filter feedback by rating", "low");
    assert.equal(document.querySelectorAll(".feedback-report").length, 1);
    await change("Filter feedback by build", "qa-other");
    assert.equal(document.querySelectorAll(".feedback-report").length, 0);
    await click("Clear feedback filters");
    await change("Review state", "new");
    rejectStatus = true;
    await click("Mark reviewed");
    assert.equal(db["playtest-feedback"][0].reviewStatus, undefined);
    assert(
      document
        .querySelector("[role=alert]")
        .textContent.includes("Project update rejected"),
    );
    rejectStatus = false;
    await click("Mark reviewed");
    assert.equal(db["playtest-feedback"][0].reviewStatus, "reviewed");
    assert.equal(document.querySelectorAll(".feedback-report").length, 0);
    await change("Review state", "reviewed");
    assert.equal(document.querySelectorAll(".feedback-report").length, 2);
    await click("Log bug from feedback");
    assert.equal(field("Bug title").value, "Issue in 0.4.0");
    assert.equal(field("Bug build").value, "qa-build");
    assert.equal(
      field("Description").value,
      "The character sticks on the ledge.",
    );
    await change("Environment", "Windows 11, keyboard");
    await change("Steps to reproduce", "Start level, jump onto ledge");
    await change("Expected result", "Land on the ledge");
    await change("Actual result", "Stuck in the ledge");
    await act(async () => {
      findButton("Report bug").form.dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await tick();
    });
    const created = db["bug-reports"][0];
    assert.equal(created.buildId, "qa-build");
    assert.equal(created.sourceFeedbackId, "qa-low");
    assert.equal(created.reproductionSteps, "Start level, jump onto ledge");
    await click("Playtest feedback");
    assert(
      document
        .querySelector(".linked-report-bugs")
        .textContent.includes("Issue in 0.4.0"),
    );
    await act(async () => {
      document.querySelector(".linked-report-bugs button").click();
      await tick();
    });
    assert.equal(field("Actual result").value, "Stuck in the ledge");
    await change("Actual result", "Only on the left edge");
    await act(async () => {
      findButton("Save changes").form.dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await tick();
    });
    assert.equal(db["bug-reports"][0].actualResult, "Only on the left edge");
    await click("Bug reports");
    await change("Bug title", "Unsent manual report");
    await click("Playtest feedback");
    await click("Log another bug");
    assert.equal(field("Bug title").value, "Unsent manual report");
    assert(document.body.textContent.includes("You have an unsent bug report"));
    await click("Keep current draft");
    assert.equal(field("Bug title").value, "Unsent manual report");
    await click("Playtest feedback");
    await click("Log another bug");
    await click("Replace draft");
    assert.equal(field("Bug title").value, "Issue in 0.4.0");
  } finally {
    rejectStatus = false;
    await act(async () => root.unmount());
  }
});

test("task discussions retain failed drafts, persist posts, and task creation is discoverable", async () => {
  root = createRoot(document.getElementById("root"));
  sessionStorage.setItem("mern_token", "fixture");
  discussion = [];
  try {
    await act(async () => {
      root.render(React.createElement(App));
      await tick();
    });
    await click("Open");
    await click("Open");
    await click("New task");
    assert.equal(document.activeElement, field("Task title"));
    assert.equal(
      document.querySelector("details[open] summary").textContent,
      "Add a task",
    );
    await act(async () => {
      document.querySelector(".card-title").click();
      await tick();
    });
    assert(document.body.textContent.includes("No comments yet"));
    await change(
      "Add a comment",
      "Check jump timing before the next playtest.",
    );
    rejectComment = true;
    await act(async () => {
      findButton("Post comment").form.dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await tick();
    });
    assert.equal(
      field("Add a comment").value,
      "Check jump timing before the next playtest.",
    );
    assert.equal(discussion.length, 0);
    rejectComment = false;
    await act(async () => {
      findButton("Post comment").form.dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await tick();
    });
    assert.equal(field("Add a comment").value, "");
    assert.equal(
      document.querySelectorAll("dialog .discussion-list li").length,
      1,
    );
    assert(document.body.textContent.includes("Comment posted."));
    await click("Close");
    await act(async () => {
      document.querySelector(".card-title").click();
      await tick();
    });
    assert(
      document
        .querySelector("dialog .discussion-list")
        .textContent.includes("Check jump timing"),
    );
  } finally {
    rejectComment = false;
    await act(async () => root.unmount());
  }
});

test("workspace links restore project views and reject mismatched and unknown links", async () => {
  window.history.replaceState(
    { checkpointIndex: 0 },
    "",
    "#/teams/t1/projects/p1/feedback",
  );
  sessionStorage.setItem("mern_token", "fixture");
  root = createRoot(document.getElementById("root"));
  try {
    await act(async () => {
      root.render(React.createElement(App));
      await tick();
      await tick();
    });
    assert.equal(
      document.querySelector('[aria-current="page"]').textContent,
      "Playtest feedback",
    );
    assert(document.querySelector("section:not([hidden]) .feedback-reports"));
    let copied;
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          copied = text;
        },
      },
    });
    await click("Copy project link");
    assert(copied.endsWith("#/teams/t1/projects/p1/feedback"));
    await click("Task board");
    assert.equal(window.location.hash, "#/teams/t1/projects/p1/tasks");
    await act(async () => {
      document.querySelector(".skip-link").click();
      await tick();
    });
    assert.equal(window.location.hash, "#/teams/t1/projects/p1/tasks");
    assert.equal(document.activeElement.id, "main-content");
    await act(async () => {
      window.history.back();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    assert.equal(window.location.hash, "#/teams/t1/projects/p1/feedback");
    assert.equal(
      document.querySelector('[aria-current="page"]').textContent,
      "Playtest feedback",
    );
    await act(async () => {
      window.history.forward();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    assert.equal(
      document.querySelector('[aria-current="page"]').textContent,
      "Task board",
    );
    await act(async () => root.unmount());
    window.history.replaceState(
      { checkpointIndex: 0 },
      "",
      "#/teams/t1/projects/p1/missing",
    );
    root = createRoot(document.getElementById("root"));
    await act(async () => {
      root.render(React.createElement(App));
      await tick();
    });
    assert(
      document
        .querySelector('[role="alert"]')
        .textContent.includes("does not exist"),
    );
    await click("Back to teams");
    assert(document.body.textContent.includes("Development teams"));
    await act(async () => root.unmount());
    window.history.replaceState(
      { checkpointIndex: 0 },
      "",
      "#/teams/other-team/projects/p1/tasks",
    );
    root = createRoot(document.getElementById("root"));
    db.teams.push({ _id: "other-team", name: "Other studio" });
    await act(async () => {
      root.render(React.createElement(App));
      await tick();
      await tick();
    });
    assert(
      document
        .querySelector('[role="alert"]')
        .textContent.includes("does not belong"),
    );
  } finally {
    db.teams = db.teams.filter((item) => item._id !== "other-team");
    await act(async () => root.unmount());
  }
});

test("first milestone guidance, drawer protection, and project navigation preserve unsent work", async () => {
  db.milestones = [];
  db.tasks = [
    {
      _id: "guard-task",
      title: "Test guards",
      description: "",
      status: "todo",
      priority: "medium",
      assigneeId: "u1",
      milestoneId: "m1",
    },
  ];
  sessionStorage.setItem("mern_token", "fixture");
  root = createRoot(document.getElementById("root"));
  let prompts = 0;
  window.confirm = () => {
    prompts++;
    return false;
  };
  try {
    await act(async () => {
      root.render(React.createElement(App));
      await tick();
    });
    await click("Open");
    await click("Open");
    await click("Create first milestone");
    assert.equal(window.location.hash, "#/teams/t1/projects/p1/milestones");
    assert(
      document.activeElement === field("Milestone name"),
      "Milestone creation should receive focus",
    );
    await change("Milestone name", "Unsent goal");
    await click("Task board");
    assert.equal(prompts, 0);
    await act(async () => {
      document
        .querySelector('nav[aria-label="Workspace navigation"] button')
        .click();
      await tick();
    });
    assert.equal(prompts, 1);
    assert.equal(window.location.hash, "#/teams/t1/projects/p1/tasks");
    await act(async () => {
      window.history.go(1 - window.history.state.checkpointIndex);
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    assert.equal(window.location.hash, "#/teams/t1/projects/p1/tasks");
    assert(document.body.textContent.includes("Starfall"));
    const event = new window.Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    await click("Test guards");
    await change("Title", "Draft task title");
    await click("Close");
    assert(document.querySelector("dialog[open]"));
    assert.equal(field("Title").value, "Draft task title");
    await act(async () => {
      document
        .querySelector("dialog")
        .dispatchEvent(new window.Event("cancel", { cancelable: true }));
      await tick();
    });
    assert(document.querySelector("dialog[open]"));
    window.confirm = () => true;
    await click("Close");
    await click("Test guards");
    await change("Add a comment", "Unsent comment");
    window.confirm = () => false;
    await click("Save changes");
    assert.equal(field("Add a comment").value, "Unsent comment");
    await click("Close");
    assert(document.querySelector("dialog[open]"));
    window.confirm = () => true;
    await click("Close");
    await click("Milestones");
    assert.equal(field("Milestone name").value, "Unsent goal");
    window.confirm = () => false;
    await click("Sign out");
    assert(sessionStorage.getItem("mern_token"));
    window.confirm = () => true;
    await click("Sign out");
    assert.equal(sessionStorage.getItem("mern_token"), null);
    const clean = new window.Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    assert.equal(clean.defaultPrevented, false);
  } finally {
    window.confirm = () => true;
    await act(async () => root.unmount());
  }
});

test("My work isolates assignments, optional completed tasks, personal reports, and failed status changes", async () => {
  db.tasks = [
    {
      _id: "mine",
      title: "My unfinished task",
      assigneeId: "u1",
      priority: "high",
      status: "todo",
      milestoneId: "m1",
    },
    {
      _id: "done",
      title: "My completed task",
      assigneeId: "u1",
      priority: "low",
      status: "done",
    },
    {
      _id: "theirs",
      title: "Someone else's task",
      assigneeId: "u2",
      priority: "high",
      status: "todo",
    },
  ];
  db.milestones = [
    { _id: "m1", name: "Personal goal", status: "todo", dueDate: "2099-01-01" },
  ];
  db["bug-reports"] = [
    {
      _id: "mine-bug",
      title: "My reported bug",
      reportedBy: "u1",
      status: "open",
      severity: "high",
    },
    {
      _id: "other-bug",
      title: "Other reported bug",
      reportedBy: "u2",
      status: "open",
      severity: "high",
    },
  ];
  sessionStorage.setItem("mern_token", "fixture");
  root = createRoot(document.getElementById("root"));
  try {
    await act(async () => {
      root.render(React.createElement(App));
      await tick();
    });
    await click("Open");
    await click("Open");
    await click("My work");
    const scope = document.querySelector(".my-work");
    assert(scope.textContent.includes("My unfinished task"));
    assert(!scope.textContent.includes("Someone else's task"));
    assert(!scope.textContent.includes("My completed task"));
    assert(scope.textContent.includes("Personal goal"));
    assert(scope.textContent.includes("My reported bug"));
    assert(!scope.textContent.includes("Other reported bug"));
    await act(async () => {
      scope.querySelector('input[type="checkbox"]').click();
      await tick();
    });
    assert(scope.textContent.includes("My completed task"));
    rejectStatus = true;
    await act(async () => {
      const el = scope.querySelector("select");
      Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        "value",
      ).set.call(el, "done");
      el.dispatchEvent(new window.Event("change", { bubbles: true }));
      await tick();
    });
    assert.equal(db.tasks[0].status, "todo");
    assert.equal(scope.querySelector("select").value, "todo");
  } finally {
    rejectStatus = false;
    await act(async () => root.unmount());
  }
});

test("bug screenshots validate selection, retain failed uploads, preview and remove images", async () => {
  screenshots = [];
  db["bug-reports"] = [
    {
      _id: "image-bug",
      title: "Visual glitch",
      status: "open",
      severity: "medium",
    },
  ];
  sessionStorage.setItem("mern_token", "fixture");
  root = createRoot(document.getElementById("root"));
  const selectFile = async (file) => {
    await act(async () => {
      const input = field("Bug screenshot");
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [file],
      });
      input.dispatchEvent(new window.Event("change", { bubbles: true }));
      await tick();
    });
  };
  try {
    await act(async () => {
      root.render(React.createElement(App));
      await tick();
    });
    await click("Open");
    await click("Open");
    await click("Bug reports");
    await click("Visual glitch");
    await selectFile(
      new window.File(["<svg/>"], "test.svg", { type: "image/svg+xml" }),
    );
    assert(findButton("Attach screenshot").disabled);
    assert(document.querySelector("dialog").textContent.includes("up to 2 MB"));
    await selectFile(
      new window.File(["image data"], "test.png", { type: "image/png" }),
    );
    rejectScreenshot = true;
    await act(async () => {
      findButton("Attach screenshot").form.dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await tick();
    });
    assert(!findButton("Attach screenshot").disabled);
    assert.equal(screenshots.length, 0);
    rejectScreenshot = false;
    await act(async () => {
      findButton("Attach screenshot").form.dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await tick();
      await tick();
    });
    assert.equal(screenshots.length, 1);
    assert(document.querySelector(".screenshot-list img"));
    await click("Remove screenshot");
    assert.equal(screenshots.length, 0);
  } finally {
    rejectScreenshot = false;
    await act(async () => root.unmount());
  }
});

test("activity shows server-recorded changes, older pages, and recoverable errors", async () => {
  activityEvents = [
    {
      _id: "e2",
      actorName: "Alex",
      resource: "task",
      label: "Movement",
      action: "updated",
      createdOn: new Date().toISOString(),
      changes: { status: { from: "todo", to: "done" } },
    },
    {
      _id: "e1",
      actorName: "Alex",
      resource: "build",
      label: "0.1",
      action: "created",
      createdOn: new Date().toISOString(),
      changes: {},
    },
  ];
  sessionStorage.setItem("mern_token", "fixture");
  root = createRoot(document.getElementById("root"));
  try {
    await act(async () => {
      root.render(React.createElement(App));
      await tick();
    });
    await click("Open");
    await click("Open");
    rejectActivity = true;
    await click("Activity");
    assert(document.body.textContent.includes("Activity unavailable"));
    rejectActivity = false;
    await click("Refresh activity");
    assert(
      document
        .querySelector(".activity-list")
        .textContent.includes("todo → done"),
    );
    await click("Load earlier activity");
    assert.equal(document.querySelectorAll(".activity-list li").length, 2);
  } finally {
    rejectActivity = false;
    await act(async () => root.unmount());
  }
});

test("notifications persist read state, keep failed changes, filter unread, and open related work", async () => {
  notificationItems = [
    {
      _id: "n1",
      resource: "task",
      resourceId: "notify-task",
      message: "Assigned to you: Movement",
      createdOn: new Date().toISOString(),
      readOn: null,
    },
  ];
  db.tasks = [
    {
      _id: "notify-task",
      title: "Movement notification task",
      status: "todo",
      priority: "medium",
      assigneeId: "u1",
      milestoneId: "m1",
    },
  ];
  sessionStorage.setItem("mern_token", "fixture");
  root = createRoot(document.getElementById("root"));
  try {
    await act(async () => {
      root.render(React.createElement(App));
      await tick();
    });
    await click("Open");
    await click("Open");
    await click("Notifications");
    assert(
      document.querySelector(".notifications").textContent.includes("1 unread"),
    );
    rejectNotification = true;
    await click("Mark read");
    assert.equal(notificationItems[0].readOn, null);
    assert(
      document
        .querySelector(".notifications")
        .textContent.includes("Notification update failed"),
    );
    rejectNotification = false;
    await click("Mark read");
    assert(notificationItems[0].readOn);
    assert(
      document.querySelector(".notifications").textContent.includes("0 unread"),
    );
    await act(async () => {
      document.querySelector('.notifications input[type="checkbox"]').click();
      await tick();
    });
    assert(
      document
        .querySelector(".notifications")
        .textContent.includes("No unread notifications"),
    );
    await act(async () => {
      document.querySelector('.notifications input[type="checkbox"]').click();
      await tick();
    });
    await click("Open related work");
    assert.equal(field("Title").value, "Movement notification task");
  } finally {
    rejectNotification = false;
    await act(async () => root.unmount());
  }
});

test("playtest sessions create and edit instructions, link feedback, and handle failed close", async () => {
  db["playtest-sessions"] = [];
  db.builds = [
    {
      _id: "session-build",
      version: "0.5",
      platform: "web",
      downloadUrl: "https://example.com/play",
    },
  ];
  db["playtest-feedback"] = [];
  sessionStorage.setItem("mern_token", "fixture");
  root = createRoot(document.getElementById("root"));
  try {
    await act(async () => {
      root.render(React.createElement(App));
      await tick();
    });
    await click("Open");
    await click("Open");
    await click("Playtest sessions");
    await change("Session title", "Movement test");
    await change("Session build", "session-build");
    await change("Testing instructions", "Try the ledge jump with a gamepad.");
    await change("Feedback deadline", "2099-05-01T12:00");
    await act(async () => {
      findButton("Create session").form.dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await tick();
    });
    assert.equal(db["playtest-sessions"].length, 1);
    assert(
      document
        .querySelector(".playtest-sessions")
        .textContent.includes("Movement test"),
    );
    await click("Edit session");
    await change("Testing instructions", "Try both keyboard and gamepad.");
    await act(async () => {
      findButton("Save session").form.dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await tick();
    });
    assert.equal(
      db["playtest-sessions"][0].instructions,
      "Try both keyboard and gamepad.",
    );
    await click("Submit session feedback");
    assert(field("Build tested").disabled);
    await change("Comments", "Keyboard feels good.");
    await act(async () => {
      findButton("Add feedback").form.dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await tick();
    });
    assert.equal(
      db["playtest-feedback"][0].sessionId,
      db["playtest-sessions"][0]._id,
    );
    assert.equal(db["playtest-feedback"][0].buildId, "session-build");
    await click("Playtest sessions");
    rejectStatus = true;
    await click("Close session");
    assert.notEqual(db["playtest-sessions"][0].status, "closed");
    assert(
      document
        .querySelector(".playtest-sessions")
        .textContent.includes("Project update rejected"),
    );
    rejectStatus = false;
    await click("Close session");
    assert.equal(db["playtest-sessions"][0].status, "closed");
    assert(findButton("Submit session feedback").disabled);
  } finally {
    rejectStatus = false;
    await act(async () => root.unmount());
  }
});

test("github project tabs show repository details, branches, commits, events, and pull requests", async () => {
  const project = db.projects.find((item) => item._id === "p1");
  const savedRepository = project.githubRepository;
  const savedInstallation = project.githubInstallationId;
  project.githubRepository = "morningsoftware/mern-stack-project";
  project.githubInstallationId = 7;
  sessionStorage.setItem("mern_token", "fixture");
  root = createRoot(document.getElementById("root"));
  try {
    await act(async () => {
      root.render(React.createElement(App));
      await tick();
    });
    await click("Open");
    await click("Open");
    await click("GitHub");
    await act(async () => {
      await tick();
    });
    const view = () => document.querySelector(".github-view").textContent;
    assert.equal(
      document.querySelector("#github-tab-repository").getAttribute("aria-selected"),
      "true",
    );
    assert(view().includes("Stars"));
    assert(view().includes("12"));
    assert(view().includes("TypeScript"));
    assert(view().includes("sam"));
    assert(!view().includes("Add camera"));
    await click("Branches");
    assert(view().includes("feat"));
    assert(view().includes("protected"));
    assert.equal(
      document.querySelector("#github-tab-branches").getAttribute("aria-selected"),
      "true",
    );
    await click("Commits");
    assert(view().includes("Add camera"));
    assert(view().includes("Recent commits on main"));
    await click("Events");
    await act(async () => {
      await tick();
    });
    assert(view().includes("push"));
    assert(view().includes("main · 1 commit"));
    await click("Pull requests");
    await act(async () => {
      await tick();
    });
    assert(view().includes("Fix jump"));
    assert(view().includes("#4"));
  } finally {
    if (savedRepository === undefined) delete project.githubRepository;
    else project.githubRepository = savedRepository;
    if (savedInstallation === undefined) delete project.githubInstallationId;
    else project.githubInstallationId = savedInstallation;
    await act(async () => root.unmount());
  }
});

test("github repository control prompts to connect when GitHub is not linked", async () => {
  githubConnected = false;
  sessionStorage.setItem("mern_token", "fixture");
  root = createRoot(document.getElementById("root"));
  try {
    await act(async () => {
      root.render(React.createElement(App));
      await tick();
    });
    await click("Open");
    await click("Open");
    await click("GitHub");
    await act(async () => {
      await tick();
    });
    const view = document.querySelector(".github-view").textContent;
    assert(view.includes("Connect GitHub"));
    assert(!view.includes("Link repository"));
    assert.equal(document.querySelector(".github-view select"), null);
  } finally {
    githubConnected = true;
    await act(async () => root.unmount());
  }
});

test("a slow saved project link keeps unrelated team controls out of the first paint", async () => {
  window.history.replaceState({ checkpointIndex: 0 }, "", "#/teams/t1/projects/p1/tasks");
  sessionStorage.setItem("mern_token", "fixture");
  const originalFetch = global.fetch;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  global.fetch = async (path, options) => {
    if (path === "/api/teams/t1") await gate;
    return originalFetch(path, options);
  };
  root = createRoot(document.getElementById("root"));
  try {
    await act(async () => { root.render(React.createElement(App)); await tick(); await tick(); });
    assert(document.body.textContent.includes("Opening workspace…"));
    assert(!document.body.textContent.includes("Create a team"));
    assert.equal(document.querySelector(".sidebar"), null);
    await act(async () => { release(); await tick(); await tick(); });
    assert.equal(document.querySelector('[aria-current="page"]').textContent, "Task board");
  } finally {
    release(); global.fetch = originalFetch;
    await act(async () => root.unmount());
  }
});

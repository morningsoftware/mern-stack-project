// DOM → actual HTTP API → isolated MongoDB smoke check. Start npm run demo first.
const assert = require("node:assert/strict");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const { buildSync } = require("esbuild");
const origin = process.env.CHECKPOINT_DEMO_ORIGIN || "http://127.0.0.1:4002";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname))
  throw Error("Demo smoke checks are restricted to loopback, never production");
const realFetch = global.fetch;
const NativeFile = global.File;
const dom = new JSDOM(
  '<!doctype html><html><body><div id="root"></div></body></html>',
  { url: origin },
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
window.confirm = () => true;
window.HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
window.HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};
global.fetch = (url, options) => realFetch(new URL(url, origin), options);
const React = require("react"),
  { act } = React,
  { createRoot } = require("react-dom/client");
const base = path.resolve(__dirname, "..");
const bundle = path.join(base, "node_modules/.cache/demo-smoke.cjs");
buildSync({
  entryPoints: [path.join(base, "src/App.tsx")],
  outfile: bundle,
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["react"],
  jsx: "automatic",
});
const { App } = require(bundle);
const root = createRoot(document.getElementById("root"));
const tick = () => new Promise((resolve) => setTimeout(resolve, 25));
async function until(check, message) {
  for (let i = 0; i < 160; i++) {
    await act(async () => {
      await tick();
    });
    if (check()) return;
  }
  throw Error(message);
}
const button = (text) => {
  const result = [...document.querySelectorAll("button")].find(
    (item) => item.textContent.trim() === text,
  );
  assert(result, `Missing button ${text}`);
  return result;
};
async function click(text) {
  await act(async () => {
    button(text).click();
    await tick();
  });
}
function field(label) {
  const scope = document.querySelector("dialog[open]") || document;
  const item = [...scope.querySelectorAll("label")].find(
    (row) => row.firstChild?.textContent.trim() === label,
  );
  assert(item, `Missing ${label}`);
  return item.querySelector("input,textarea,select");
}
async function change(label, value) {
  await act(async () => {
    const input = field(label),
      prototype =
        input.tagName === "TEXTAREA"
          ? window.HTMLTextAreaElement.prototype
          : input.tagName === "SELECT"
            ? window.HTMLSelectElement.prototype
            : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(input, value);
    input.dispatchEvent(
      new window.Event(input.tagName === "SELECT" ? "change" : "input", {
        bubbles: true,
      }),
    );
    await tick();
  });
}
async function submit(form) {
  await act(async () => {
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await tick();
  });
}
(async () => {
  try {
    await act(async () => {
      root.render(
        React.createElement(React.StrictMode, null, React.createElement(App)),
      );
      await tick();
    });
    await until(
      () => document.querySelector(".auth-wrap form"),
      "Sign-in form did not load",
    );
    await change("Username", "demo");
    await change("Password", "checkpoint-demo");
    await submit(document.querySelector(".auth-wrap form"));
    await until(
      () => document.querySelector(".teams-list li button"),
      "Real login failed",
    );
    await click("Open");
    await until(
      () =>
        [...document.querySelectorAll("button")].some(
          (item) => item.textContent.trim() === "Open",
        ),
      "Projects did not load",
    );
    await click("Open");
    await until(
      () => document.querySelectorAll(".work-card").length === 2,
      "Real project workspace did not load",
    );
    await click("My work");
    assert(
      document
        .querySelector(".my-work")
        .textContent.includes("Implement player movement"),
    );
    assert(
      !document
        .querySelector(".my-work")
        .textContent.includes("Build the first level"),
    );
    await act(async () => {
      const input = document.querySelector(".my-work select");
      Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        "value",
      ).set.call(input, "in_progress");
      input.dispatchEvent(new window.Event("change", { bubbles: true }));
      await tick();
    });
    await until(
      () =>
        document
          .querySelector(".workspace-notice")
          ?.textContent.includes("saved"),
      "Real task update failed",
    );
    await click("Notifications");
    await until(
      () => document.querySelector(".notifications li"),
      "Notification inbox did not load",
    );
    if (
      ![...document.querySelectorAll(".notifications button")].some(
        (item) => item.textContent.trim() === "Mark read",
      )
    ) {
      await click("Mark unread");
      await until(
        () =>
          [...document.querySelectorAll(".notifications button")].some(
            (item) => item.textContent.trim() === "Mark read",
          ),
        "Unread state did not persist",
      );
    }
    await click("Mark read");
    await until(
      () =>
        document
          .querySelector(".notifications")
          .textContent.includes("0 unread"),
      "Read state did not persist",
    );
    await click("Activity");
    await until(
      () =>
        document
          .querySelector(".activity-list")
          .textContent.includes("in_progress"),
      "Task status activity was not recorded",
    );
    await click("Playtest sessions");
    await until(
      () => document.querySelector(".playtest-sessions article"),
      "Sessions did not load",
    );
    await click("Submit session feedback");
    assert(field("Build tested").disabled);
    await change("Comments", "Local smoke check: tested keyboard and gamepad.");
    await submit(button("Add feedback").form);
    await until(
      () => field("Comments").value === "" && !button("Add feedback").disabled,
      "Session feedback did not save",
    );
    await click("Bug reports");
    await click("Player catches on a ledge");
    await until(
      () => document.querySelector(".screenshot-list img"),
      "Protected screenshot did not load",
    );
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1kAAAAASUVORK5CYII=",
      "base64",
    );
    await act(async () => {
      const input = field("Bug screenshot");
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [new NativeFile([png], "smoke.png", { type: "image/png" })],
      });
      input.dispatchEvent(new window.Event("change", { bubbles: true }));
      await tick();
    });
    await submit(button("Attach screenshot").form);
    await until(
      () => document.querySelectorAll(".screenshot-list li").length === 2,
      "Actual screenshot upload failed",
    );
    await act(async () => {
      document
        .querySelectorAll(".screenshot-list li")[1]
        .querySelector("button")
        .click();
      await tick();
    });
    await until(
      () => document.querySelectorAll(".screenshot-list li").length === 1,
      "Screenshot removal failed",
    );
    await click("Close");
    const projectId = window.location.hash.split("/")[4];
    const token = sessionStorage.getItem("mern_token");
    const response = await realFetch(
      `${origin}/api/playtest-feedback?projectId=${projectId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const feedback = await response.json();
    assert(
      feedback.some(
        (item) => item.sessionId && item.comments.includes("Local smoke check"),
      ),
    );
    console.log(
      "PASS: DOM → real HTTP API → isolated MongoDB across all five features; no mocked API responses.",
    );
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

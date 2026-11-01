const { test } = require("node:test");
const assert = require("node:assert/strict");
const helpers = import("../src/features/planning/milestoneData.js");

test("calendar dates retain their UTC-selected day and tolerate absent/invalid dates", async () => {
  const { dueDateKey, localDayKey, formatDueDate } = await helpers;
  assert.equal(dueDateKey("2026-11-01T00:00:00Z"), "2026-11-01");
  assert.equal(dueDateKey(null), null);
  assert.equal(dueDateKey(""), null);
  assert.equal(dueDateKey("invalid"), null);
  assert.equal(localDayKey(new Date(2026, 10, 1, 0, 1)), "2026-11-01");
  assert.equal(formatDueDate(null), "Unscheduled");
});
test("due today is not overdue; completed deadlines are never overdue", async () => {
  const { milestoneRows } = await helpers;
  const items = [
    {
      _id: "past",
      name: "Past",
      status: "todo",
      dueDate: "2026-10-31T00:00:00Z",
    },
    {
      _id: "today",
      name: "Today",
      status: "in_progress",
      dueDate: "2026-11-01T00:00:00Z",
    },
    {
      _id: "done",
      name: "Done",
      status: "completed",
      dueDate: "2026-10-30T00:00:00Z",
    },
    { _id: "none", name: "Unscheduled", status: "todo", dueDate: null },
  ];
  const rows = milestoneRows(items, [], "2026-11-01");
  assert.equal(rows.find((r) => r.milestone._id === "past").overdue, true);
  assert.equal(rows.find((r) => r.milestone._id === "today").overdue, false);
  assert.equal(rows.find((r) => r.milestone._id === "today").dueToday, true);
  assert.equal(rows.find((r) => r.milestone._id === "done").overdue, false);
  assert.equal(rows.find((r) => r.milestone._id === "none").dueToday, false);
  assert.equal(rows.at(-1).milestone._id, "none");
  assert.deepEqual(
    items.map((i) => i._id),
    ["past", "today", "done", "none"],
  );
});
test("task progress counts only linked work and does not invent completion", async () => {
  const { milestoneRows } = await helpers;
  const rows = milestoneRows(
    [
      { _id: "m1", name: "Prototype", status: "todo" },
      { _id: "m2", name: "Release", status: "completed" },
    ],
    [
      { milestoneId: "m1", status: "done" },
      { milestoneId: "m1", status: "in_progress" },
      { milestoneId: "other", status: "done" },
    ],
    "2026-11-01",
  );
  assert.deepEqual(rows.find((r) => r.milestone._id === "m1").progress, {
    done: 1,
    total: 2,
  });
  assert.deepEqual(rows.find((r) => r.milestone._id === "m2").progress, {
    done: 0,
    total: 0,
  });
});

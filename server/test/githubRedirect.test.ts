import assert from "node:assert/strict";
import { test } from "node:test";
import { safeReturnTarget, githubCallbackUrl } from "../src/githubOauth.js";

test("GitHub redirects accept the configured production origin and reject other origins", () => {
  const origin = process.env.CLIENT_ORIGIN;
  const callback = process.env.GITHUB_REDIRECT_URI;
  try {
    process.env.CLIENT_ORIGIN = "https://checkpoint.morning.codes";
    delete process.env.GITHUB_REDIRECT_URI;
    const fallback = "https://checkpoint.morning.codes/#/teams";
    assert.equal(safeReturnTarget(fallback + "/team1"), fallback + "/team1");
    for (const address of ["https://evil.test", "https://checkpoint.morning.codes.evil.test/", "http://checkpoint.morning.codes", "https://user:pass@checkpoint.morning.codes/", "javascript:alert(1)", "http://127.0.0.1:5173/"])
      assert.equal(safeReturnTarget(address), fallback);
    assert.equal(githubCallbackUrl(), "https://checkpoint.morning.codes/api/github/callback");
    process.env.GITHUB_REDIRECT_URI = "https://checkpoint.morning.codes/custom/callback";
    assert.equal(githubCallbackUrl(), process.env.GITHUB_REDIRECT_URI);
  } finally {
    if (origin === undefined) delete process.env.CLIENT_ORIGIN; else process.env.CLIENT_ORIGIN = origin;
    if (callback === undefined) delete process.env.GITHUB_REDIRECT_URI; else process.env.GITHUB_REDIRECT_URI = callback;
  }
});

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("application routes keep auth and messenger separated", () => {
  const main = read("src/main.jsx");

  assert.match(main, /import AuthPage from "\.\/pages\/AuthPage"/);
  assert.match(main, /import WorkspacePage from "\.\/pages\/WorkspacePage"/);
  assert.match(main, /path:\s*"\/"/);
  assert.match(main, /element:\s*<WorkspacePage \/>/);
  assert.match(main, /path:\s*"\/auth"/);
  assert.match(main, /element:\s*<AuthPage \/>/);
  assert.doesNotMatch(main, /pages\/Home/);
});

test("workspace redirects unauthenticated users to auth page", () => {
  const workspacePage = read("src/pages/WorkspacePage.jsx");

  assert.match(workspacePage, /<Navigate to="\/auth" replace \/>/);
  assert.match(workspacePage, /<Workspace[\s\S]*onLogout=\{logout\}/);
});

test("auth page redirects authenticated users to messenger", () => {
  const authPage = read("src/pages/AuthPage.jsx");

  assert.match(authPage, /<Navigate to="\/" replace \/>/);
  assert.match(authPage, /navigate\("\/", \{ replace: true \}\)/);
});

test("legacy mixed page and old messenger slices are removed", () => {
  const removedFiles = [
    "src/pages/Home.jsx",
    "src/components/ChatPanel.jsx",
    "src/components/WorkspaceDetails.jsx",
    "src/components/WorkspaceRail.jsx",
    "src/components/WorkspaceSidebar.jsx",
  ];

  for (const file of removedFiles) {
    assert.equal(existsSync(file), false, `${file} should stay removed`);
  }
});

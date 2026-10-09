import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const jsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "js");

async function loadGetJiraTicketUrl() {
  const context = vm.createContext({});
  vm.runInContext(await fs.readFile(path.join(jsDir, "table.js"), "utf8"), context);
  return (value) => vm.runInContext(`getJiraTicketUrl(${JSON.stringify(value)})`, context);
}

test("Jira ticket values in every export format become a link", async () => {
  const getJiraTicketUrl = await loadGetJiraTicketUrl();

  assert.equal(
    getJiraTicketUrl("https://hiredexperts.atlassian.net/browse/HED-1"),
    "https://hiredexperts.atlassian.net/browse/HED-1"
  );
  assert.equal(
    getJiraTicketUrl("hiredexperts.atlassian.net/browse/HED-1745"),
    "https://hiredexperts.atlassian.net/browse/HED-1745"
  );
  assert.equal(
    getJiraTicketUrl("hiredexperts.atlassian.net/browse/HED-1743?atlOrigin=…"),
    "https://hiredexperts.atlassian.net/browse/HED-1743"
  );
  assert.equal(getJiraTicketUrl("HED-766"), "https://hiredexperts.atlassian.net/browse/HED-766");
  assert.equal(
    getJiraTicketUrl('{"originalUrl":"https:\\/\\/hiredexperts.atlassian.net\\/browse\\/HED-849?atlOrigin=abc"}'),
    "https://hiredexperts.atlassian.net/browse/HED-849?atlOrigin=abc"
  );
});

test("values that are not tickets give no link", async () => {
  const getJiraTicketUrl = await loadGetJiraTicketUrl();

  assert.equal(getJiraTicketUrl(""), "");
  assert.equal(getJiraTicketUrl("CX - Service request: Update user 6703 to onboarding 1"), "");
});

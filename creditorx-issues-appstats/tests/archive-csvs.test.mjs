import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyze, applyArchive } from "../scripts/archive-csvs.mjs";
import { createDashboardLoader } from "../scripts/lib/dashboard-loader.mjs";

const HEADER =
  "Customer Name,Reported By,Date,Carrier/Provider,Customer ID,IOS or Android,CreditorX Device,Reported Issue,Module/Section,Status,Tier 2 State,Tier 2 Comments,Dev Team Comments,Jira Ticket,Priority";
const realDataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");

function issue(customerId, date, { status = "", text = "problem", jira = "" } = {}) {
  return `Name ${customerId},a@x.com,${date},Carrier,${customerId},Android,Phone,${text},Module,${status},,,,${jira},`;
}

async function makeDataDir(files) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "csv-archive-"));
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(dir, name), content, "utf8");
  }
  return dir;
}

const csv = (...rows) => [HEADER, ...rows].join("\n") + "\n";
const names = (files) => files.map((file) => path.basename(file));

test("a file that is the only place an issue exists is kept", async () => {
  const dir = await makeDataDir({
    "Issues-1-oct-2026.csv": csv(issue("100", "2026-09-01"), issue("200", "2026-09-02")),
    "Issues-2-oct-2026.csv": csv(issue("200", "2026-09-02"), issue("300", "2026-10-02")),
  });
  const result = await analyze(dir);
  assert.deepEqual(names(result.archivable), []);
  assert.deepEqual(names(result.keep), ["Issues-1-oct-2026.csv", "Issues-2-oct-2026.csv"]);
});

test("intermediate files are archivable and the last one keeps the final state and Last Update", async () => {
  const dir = await makeDataDir({
    "Issues-1-oct-2026.csv": csv(issue("100", "2026-09-01", { status: "In progress" })),
    "Issues-2-oct-2026.csv": csv(issue("100", "2026-09-01", { status: "In progress" })),
    "Issues-3-oct-2026.csv": csv(issue("100", "2026-09-01", { status: "Completed" })),
  });
  const result = await analyze(dir);
  assert.deepEqual(names(result.archivable), ["Issues-1-oct-2026.csv", "Issues-2-oct-2026.csv"]);
  assert.deepEqual(names(result.keep), ["Issues-3-oct-2026.csv"]);

  const loader = await createDashboardLoader();
  const { main } = await loader.merge(result.keep);
  const statusIndex = main.headers.indexOf("Status");
  const lastUpdateIndex = main.headers.indexOf("Last Update");
  assert.equal(main.rows[0][statusIndex], "Completed");
  assert.match(main.rows[0][lastUpdateIndex], /Oct 03, 2026/);
});

test("an edited issue text does not make an old file necessary when the customer and date match", async () => {
  const dir = await makeDataDir({
    "Issues-1-oct-2026.csv": csv(issue("100", "2026-09-01", { text: "first wording" })),
    "Issues-2-oct-2026.csv": csv(issue("100", "2026-09-01", { text: "edited wording" })),
  });
  const result = await analyze(dir);
  assert.deepEqual(names(result.archivable), ["Issues-1-oct-2026.csv"]);
});

test("issues that share a Jira ticket stay separate issues", async () => {
  const dir = await makeDataDir({
    "Issues-1-oct-2026.csv": csv(
      issue("100", "2026-09-01", { jira: "CRX-1" }),
      issue("200", "2026-09-01", { jira: "CRX-1" }),
      issue("300", "2026-09-02", { jira: "CRX-1" })
    ),
  });
  const loader = await createDashboardLoader();
  const { main } = await loader.merge([path.join(dir, "Issues-1-oct-2026.csv")]);
  assert.equal(main.rows.length, 3);
});

test("the same customer with two different issues on one day counts as two issues", async () => {
  const dir = await makeDataDir({
    "Issues-1-oct-2026.csv": csv(
      issue("100", "2026-09-01", { text: "cannot log in" }),
      issue("100", "2026-09-01", { text: "password reset fails" })
    ),
    "Issues-2-oct-2026.csv": csv(
      issue("100", "2026-09-01", { text: "cannot log in", status: "Completed" }),
      issue("100", "2026-09-01", { text: "password reset fails" })
    ),
  });
  const loader = await createDashboardLoader();
  const files = ["Issues-1-oct-2026.csv", "Issues-2-oct-2026.csv"].map((name) => path.join(dir, name));
  const { main } = await loader.merge(files);
  const statusIndex = main.headers.indexOf("Status");
  assert.equal(main.rows.length, 2);
  assert.deepEqual(main.rows.map((row) => row[statusIndex]).sort(), ["", "Completed"]);
});

test("editing the text of an issue does not create a second issue", async () => {
  const dir = await makeDataDir({
    "Issues-1-oct-2026.csv": csv(issue("100", "2026-09-01", { text: "first wording" })),
    "Issues-2-oct-2026.csv": csv(issue("100", "2026-09-01", { text: "edited wording" })),
  });
  const loader = await createDashboardLoader();
  const files = ["Issues-1-oct-2026.csv", "Issues-2-oct-2026.csv"].map((name) => path.join(dir, name));
  const { main } = await loader.merge(files);
  assert.equal(main.rows.length, 1);
});

test("a file with a column no other file has is kept even if it owns no issue", async () => {
  const dir = await makeDataDir({
    "Issues-1-oct-2026.csv": `${HEADER},Extra Column\n${issue("100", "2026-09-01")},extra\n`,
    "Issues-2-oct-2026.csv": csv(issue("100", "2026-09-01")),
  });
  const result = await analyze(dir);
  assert.deepEqual(names(result.archivable), []);
  assert.deepEqual(names(result.rejected.map((entry) => entry.file)), ["Issues-1-oct-2026.csv"]);
});

test("files with the same date resolve ties exactly like the dashboard", async () => {
  const dir = await makeDataDir({
    "Issues-5-oct-2026.csv": csv(issue("100", "2026-09-01", { status: "A" })),
    "Issues-5-oct-2026-old.csv": csv(issue("100", "2026-09-01", { status: "B" })),
  });
  const result = await analyze(dir);
  const loader = await createDashboardLoader();
  const all = await loader.merge(result.files);
  const kept = await loader.merge(result.keep);
  assert.equal(result.archivable.length, 1);
  assert.deepEqual(kept.main.rows, all.main.rows);
});

test("a header-only file does not break the analysis", async () => {
  const dir = await makeDataDir({
    "Issues-1-oct-2026.csv": `${HEADER}\n`,
    "Issues-2-oct-2026.csv": csv(issue("100", "2026-09-01")),
  });
  const result = await analyze(dir);
  assert.deepEqual(names(result.keep), ["Issues-2-oct-2026.csv"]);
});

test("analyze is read-only", async () => {
  const dir = await makeDataDir({
    "Issues-1-oct-2026.csv": csv(issue("100", "2026-09-01")),
    "Issues-2-oct-2026.csv": csv(issue("100", "2026-09-01")),
  });
  await analyze(dir);
  assert.deepEqual((await fs.readdir(dir)).sort(), ["Issues-1-oct-2026.csv", "Issues-2-oct-2026.csv"]);
});

test("applyArchive moves only the archivable files and the merged data is unchanged", async () => {
  const dir = await makeDataDir({
    "Issues-1-oct-2026.csv": csv(issue("100", "2026-09-01"), issue("200", "2026-09-02")),
    "Issues-2-oct-2026.csv": csv(issue("100", "2026-09-01"), issue("200", "2026-09-02")),
    "Issues-3-oct-2026.csv": csv(issue("100", "2026-09-01"), issue("300", "2026-10-02")),
  });
  const loader = await createDashboardLoader();
  const before = await loader.merge(await analyze(dir).then((result) => result.files));
  const result = await analyze(dir);
  const moved = await applyArchive(dir, result);

  assert.deepEqual(moved, ["Issues-1-oct-2026.csv"]);
  assert.deepEqual((await fs.readdir(dir)).filter((name) => name.endsWith(".csv")).sort(), [
    "Issues-2-oct-2026.csv",
    "Issues-3-oct-2026.csv",
  ]);
  assert.deepEqual(await fs.readdir(path.join(dir, "archive")), ["Issues-1-oct-2026.csv"]);

  const after = await loader.merge(result.keep);
  assert.equal(after.main.rows.length, before.main.rows.length);
});

test("applyArchive restores everything if a file cannot be moved", async () => {
  const dir = await makeDataDir({
    "Issues-1-oct-2026.csv": csv(issue("100", "2026-09-01")),
    "Issues-2-oct-2026.csv": csv(issue("100", "2026-09-01")),
    "Issues-3-oct-2026.csv": csv(issue("100", "2026-09-01")),
  });
  await fs.mkdir(path.join(dir, "archive"));
  await fs.writeFile(path.join(dir, "archive", "Issues-2-oct-2026.csv"), "already here", "utf8");

  const result = await analyze(dir);
  await assert.rejects(applyArchive(dir, result), /already exists in archive/);
  assert.deepEqual((await fs.readdir(dir)).filter((name) => name.endsWith(".csv")).sort(), [
    "Issues-1-oct-2026.csv",
    "Issues-2-oct-2026.csv",
    "Issues-3-oct-2026.csv",
  ]);
});

test("real data: the proposed archive leaves the dashboard data identical", async (t) => {
  const exists = await fs.access(realDataDir).then(() => true, () => false);
  if (!exists) {
    t.skip("data/ folder not present");
    return;
  }
  const tempCopy = await fs.mkdtemp(path.join(os.tmpdir(), "csv-real-"));
  for (const name of await fs.readdir(realDataDir)) {
    if (name.endsWith(".csv")) {
      await fs.copyFile(path.join(realDataDir, name), path.join(tempCopy, name));
    }
  }
  const result = await analyze(tempCopy);
  const loader = await createDashboardLoader();
  const all = await loader.merge(result.files);

  await applyArchive(tempCopy, result);
  const remaining = (await fs.readdir(tempCopy)).filter((name) => name.endsWith(".csv")).map((name) => path.join(tempCopy, name));
  const merged = await loader.merge(remaining);

  const sortedRows = (dataset) => dataset.rows.map((row) => JSON.stringify(row)).sort();
  assert.deepEqual(merged.main.headers, all.main.headers);
  assert.deepEqual(sortedRows(merged.main), sortedRows(all.main));
  assert.deepEqual(sortedRows(merged.themes), sortedRows(all.themes));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMergedData, MERGED_FILE_NAME } from "../scripts/build-merged-data.mjs";
import { createDashboardLoader } from "../scripts/lib/dashboard-loader.mjs";

const HEADER =
  "Customer Name,Reported By,Date,Carrier/Provider,Customer ID,IOS or Android,CreditorX Device,Reported Issue,Module/Section,Status,Tier 2 State,Tier 2 Comments,Dev Team Comments,Jira Ticket,Priority";
const realDataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");

const issue = (customerId, date, status = "") =>
  `Name ${customerId},a@x.com,${date},Carrier,${customerId},Android,Phone,problem,Module,${status},,,,,`;
const csv = (...rows) => [HEADER, ...rows].join("\n") + "\n";

// A dashboard folder: <root>/data/*.csv (+ files.json like update-files-manifest.mjs writes).
async function makeSite(files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "merged-"));
  const dataDir = path.join(root, "data");
  await fs.mkdir(dataDir);
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(dataDir, name), content, "utf8");
  }
  return { root, dataDir };
}

async function browserView(root, dataDir) {
  const loader = await createDashboardLoader({ root });
  const names = (await fs.readdir(dataDir)).filter((name) => name.endsWith(".csv")).sort();
  const csvUrls = names.map((name) => loader.toUrl(path.join(dataDir, name)));
  return {
    fromMerged: await loader.evaluate("loadMergedData(__csvUrls)", { __csvUrls: csvUrls }),
    fromCsv: await loader.evaluate("loadDataFromCsvFiles(__csvUrls)", { __csvUrls: csvUrls }),
    loader,
    csvUrls,
  };
}

test("loading the merged file gives exactly what loading the CSV files gives", async () => {
  const { root, dataDir } = await makeSite({
    "Issues-1-oct-2026.csv": csv(issue("100", "2026-09-01", "In progress"), issue("200", "2026-09-02")),
    "Issues-2-oct-2026.csv": csv(issue("100", "2026-09-01", "Completed"), issue("300", "2026-10-02")),
  });
  const built = await buildMergedData(dataDir);
  assert.equal(built.issues, 3);

  const { fromMerged, fromCsv } = await browserView(root, dataDir);
  assert.ok(fromMerged, "merged file should be accepted");
  assert.deepEqual(fromMerged, fromCsv);
  assert.equal(fromMerged.fileCount, 2);
  assert.ok(Number.isFinite(fromMerged.latestTimestamp));
});

test("a merged file built from a different list of CSV files is ignored", async () => {
  const { root, dataDir } = await makeSite({
    "Issues-1-oct-2026.csv": csv(issue("100", "2026-09-01")),
  });
  await buildMergedData(dataDir);
  await fs.writeFile(path.join(dataDir, "Issues-2-oct-2026.csv"), csv(issue("200", "2026-09-02")), "utf8");

  const { fromMerged, fromCsv } = await browserView(root, dataDir);
  assert.equal(fromMerged, null);
  assert.equal(fromCsv.rows.length, 2);
});

test("a missing, corrupt or old-format merged file falls back to the CSV files", async () => {
  const { root, dataDir } = await makeSite({
    "Issues-1-oct-2026.csv": csv(issue("100", "2026-09-01")),
  });
  assert.equal((await browserView(root, dataDir)).fromMerged, null);

  await fs.writeFile(path.join(dataDir, MERGED_FILE_NAME), "{ not json", "utf8");
  assert.equal((await browserView(root, dataDir)).fromMerged, null);

  await buildMergedData(dataDir);
  const merged = JSON.parse(await fs.readFile(path.join(dataDir, MERGED_FILE_NAME), "utf8"));
  merged.format = 999;
  await fs.writeFile(path.join(dataDir, MERGED_FILE_NAME), JSON.stringify(merged), "utf8");
  assert.equal((await browserView(root, dataDir)).fromMerged, null);
});

test("archived files in data/archive are not part of the merged file", async () => {
  const { root, dataDir } = await makeSite({
    "Issues-1-oct-2026.csv": csv(issue("100", "2026-09-01")),
    "Issues-2-oct-2026.csv": csv(issue("100", "2026-09-01")),
  });
  await fs.mkdir(path.join(dataDir, "archive"));
  await fs.rename(path.join(dataDir, "Issues-1-oct-2026.csv"), path.join(dataDir, "archive", "Issues-1-oct-2026.csv"));
  await buildMergedData(dataDir);

  const merged = JSON.parse(await fs.readFile(path.join(dataDir, MERGED_FILE_NAME), "utf8"));
  assert.deepEqual(merged.sourceFiles, ["Issues-2-oct-2026.csv"]);
  assert.ok((await browserView(root, dataDir)).fromMerged);
});

test("real data: the merged file matches the 50 CSV files and is much smaller", async (t) => {
  const exists = await fs.access(realDataDir).then(() => true, () => false);
  if (!exists) {
    t.skip("data/ folder not present");
    return;
  }
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "merged-real-"));
  const dataDir = path.join(root, "data");
  await fs.mkdir(dataDir);
  let csvBytes = 0;
  for (const name of await fs.readdir(realDataDir)) {
    if (name.endsWith(".csv")) {
      await fs.copyFile(path.join(realDataDir, name), path.join(dataDir, name));
      csvBytes += (await fs.stat(path.join(dataDir, name))).size;
    }
  }
  const built = await buildMergedData(dataDir);
  const { fromMerged, fromCsv } = await browserView(root, dataDir);

  assert.ok(fromMerged);
  assert.deepEqual(fromMerged, fromCsv);
  assert.ok(built.bytes < csvBytes / 4, `merged ${built.bytes} bytes vs CSV ${csvBytes} bytes`);
});

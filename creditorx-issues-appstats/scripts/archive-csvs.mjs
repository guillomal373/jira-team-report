#!/usr/bin/env node
// Finds CSV files in data/ that can be archived without changing anything the
// dashboard shows. The dashboard keeps, for every issue, the row from the LAST
// file that contains it (that row also sets "Last Update"). A file that is the
// last one for no issue is redundant. Every candidate is proven redundant by
// merging with the dashboard's real code before and after removing it.
//
//   node scripts/archive-csvs.mjs            report only
//   node scripts/archive-csvs.mjs --apply    move redundant files to data/archive/

import { promises as fs } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createDashboardLoader } from "./lib/dashboard-loader.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultDataDir = path.join(projectRoot, "data");

async function listCsvFiles(dataDir) {
  const entries = await fs.readdir(dataDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".csv"))
    .map((entry) => path.join(dataDir, entry.name));
}

// Row order follows the first file an issue appears in, so it can shift when old
// files are removed. Only the content matters: same headers, same rows (including
// "Last Update"). The table re-sorts by date anyway.
function canonical(merged) {
  const normalize = (dataset) =>
    dataset && { headers: dataset.headers, rows: dataset.rows.map((row) => JSON.stringify(row)).sort() };
  return JSON.stringify({ main: normalize(merged.main), themes: normalize(merged.themes) });
}

const sameResult = (left, right) => canonical(left) === canonical(right);

export async function analyze(dataDir = defaultDataDir) {
  const loader = await createDashboardLoader();
  const files = await listCsvFiles(dataDir);
  const baseline = await loader.merge(files);
  const { counts, order } = await loader.countIssuesOwnedByFile(files);

  const rejected = [];
  const archivable = [];
  const rank = new Map(order.map((file, index) => [file, index]));
  const byOrder = (left, right) => (rank.get(left) ?? -1) - (rank.get(right) ?? -1);

  // Oldest first. A candidate is added only if the data is still identical with it
  // AND all the previously accepted ones removed, so the final set is safe together.
  const candidates = files.filter((file) => !(counts.get(file) > 0)).sort(byOrder);

  for (const file of candidates) {
    const remaining = files.filter((other) => other !== file && !archivable.includes(other));
    if (sameResult(await loader.merge(remaining), baseline)) {
      archivable.push(file);
    } else {
      rejected.push({ file, reason: "removing it changes the merged data (e.g. column order or columns only it has)" });
    }
  }

  const withoutAll = files.filter((file) => !archivable.includes(file));
  if (!sameResult(await loader.merge(withoutAll), baseline)) {
    throw new Error("Archiving the candidates together changes the merged data; refusing to propose them.");
  }

  return {
    files: [...files].sort(byOrder),
    counts,
    keep: withoutAll.sort(byOrder),
    archivable: archivable.sort(byOrder),
    rejected,
    issueCount: baseline.main ? baseline.main.rows.length : 0,
  };
}

export async function applyArchive(dataDir, result, { updateManifest = false } = {}) {
  const loader = await createDashboardLoader();
  const archiveDir = path.join(dataDir, "archive");
  const before = await loader.merge(result.files);

  await fs.mkdir(archiveDir, { recursive: true });
  const moved = [];

  try {
    for (const file of result.archivable) {
      const target = path.join(archiveDir, path.basename(file));
      await fs.access(target).then(
        () => { throw new Error(`${path.basename(file)} already exists in archive/`); },
        () => {}
      );
      await fs.rename(file, target);
      moved.push([file, target]);
    }

    if (!sameResult(await loader.merge(result.keep), before)) {
      throw new Error("Merged data changed after archiving.");
    }
  } catch (error) {
    for (const [file, target] of moved.reverse()) {
      await fs.rename(target, file);
    }
    throw error;
  }

  if (updateManifest) {
    execFileSync(process.execPath, [path.join(projectRoot, "scripts", "update-files-manifest.mjs")], {
      stdio: "inherit",
    });
  }

  return moved.map(([file]) => path.basename(file));
}

function printReport(result) {
  const name = (file) => path.basename(file);
  console.log(`${result.files.length} CSV files, ${result.issueCount} issues in the merged dashboard data.\n`);
  console.log("KEEP (each is the latest version of at least one issue):");
  result.keep.forEach((file) => {
    console.log(`  ${name(file).padEnd(28)} ${String(result.counts.get(file) ?? 0).padStart(4)} issues`);
  });
  console.log(`\nARCHIVABLE (${result.archivable.length}, no issue's latest state or Last Update depends on them):`);
  result.archivable.forEach((file) => console.log(`  ${name(file)}`));
  if (result.rejected.length > 0) {
    console.log("\nKEPT ANYWAY:");
    result.rejected.forEach(({ file, reason }) => console.log(`  ${name(file)} - ${reason}`));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dirIndex = args.indexOf("--data-dir");
  const dataDir = dirIndex >= 0 ? path.resolve(args[dirIndex + 1]) : defaultDataDir;
  const result = await analyze(dataDir);
  printReport(result);

  if (!args.includes("--apply")) {
    console.log("\nNothing was moved. Re-run with --apply to move the archivable files to data/archive/.");
    return;
  }

  const movedFiles = await applyArchive(dataDir, result, { updateManifest: dataDir === defaultDataDir });
  console.log(`\nMoved ${movedFiles.length} files to ${path.join(path.basename(dataDir), "archive")}/ and verified the merged data is identical.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

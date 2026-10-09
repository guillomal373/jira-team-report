#!/usr/bin/env node
// Writes data/issues-merged.json: every CSV in data/ already merged the way the
// dashboard merges them (latest row per issue, with "Last Update"). The dashboard
// reads this one file instead of every CSV and falls back to the CSVs if it is
// missing or built from a different list of files.
//
//   node scripts/build-merged-data.mjs
//
// scripts/update-files-manifest.mjs runs this too, so the daily command is enough.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDashboardLoader } from "./lib/dashboard-loader.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultDataDir = path.join(projectRoot, "data");
export const MERGED_FILE_NAME = "issues-merged.json";

export async function buildMergedData(dataDir = defaultDataDir) {
  const entries = await fs.readdir(dataDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".csv"))
    .map((entry) => path.join(dataDir, entry.name));

  const loader = await createDashboardLoader();
  const built = await loader.build(files);

  if (!built) {
    throw new Error("No CSV data could be loaded; issues-merged.json was not written.");
  }

  const { format, data } = built;
  const themesDiffer =
    JSON.stringify([data.themeHeaders, data.themeRows]) !== JSON.stringify([data.headers, data.rows]);

  const output = {
    format,
    generatedAt: new Date().toISOString(),
    sourceFiles: files.map((file) => path.basename(file)).sort(),
    fileCount: data.fileCount,
    themeFileCount: data.themeFileCount,
    latestTimestamp: data.latestTimestamp,
    headers: data.headers,
    rows: data.rows,
    themes: themesDiffer ? { headers: data.themeHeaders, rows: data.themeRows } : null,
  };

  const outFile = path.join(dataDir, MERGED_FILE_NAME);
  const text = JSON.stringify(output);
  await fs.writeFile(outFile, text, "utf8");

  return { outFile, issues: data.rows.length, files: files.length, bytes: Buffer.byteLength(text) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildMergedData()
    .then(({ outFile, issues, files, bytes }) => {
      console.log(
        `Wrote ${path.relative(projectRoot, outFile)}: ${issues} issues from ${files} CSV files (${(bytes / 1024 / 1024).toFixed(2)} MB).`
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

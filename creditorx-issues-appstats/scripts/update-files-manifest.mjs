#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const dataDir = path.join(projectRoot, "data");
const manifestPath = path.join(dataDir, "files.json");
const monthIndexByName = new Map([
  ["jan", 0],
  ["january", 0],
  ["feb", 1],
  ["february", 1],
  ["mar", 2],
  ["march", 2],
  ["apr", 3],
  ["april", 3],
  ["may", 4],
  ["jun", 5],
  ["june", 5],
  ["jul", 6],
  ["july", 6],
  ["aug", 7],
  ["august", 7],
  ["sep", 8],
  ["sept", 8],
  ["september", 8],
  ["oct", 9],
  ["october", 9],
  ["nov", 10],
  ["november", 10],
  ["dec", 11],
  ["december", 11],
]);

function parseDateFromFilename(fileName) {
  const match = fileName.match(/(\d{1,2})-([a-zA-Z]+)(?:-(\d{4}))?/);

  if (!match) {
    return null;
  }

  const [, dayPart, monthPart, yearPart] = match;
  const monthIndex = monthIndexByName.get(monthPart.toLowerCase());

  if (monthIndex === undefined) {
    return null;
  }

  const year = Number(yearPart ?? new Date().getFullYear());
  const day = Number(dayPart);
  const parsedDate = new Date(year, monthIndex, day);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function sortCsvFiles(leftFile, rightFile) {
  const leftDate = parseDateFromFilename(leftFile);
  const rightDate = parseDateFromFilename(rightFile);

  if (leftDate && rightDate) {
    return leftDate.getTime() - rightDate.getTime() || leftFile.localeCompare(rightFile);
  }

  if (leftDate) {
    return -1;
  }

  if (rightDate) {
    return 1;
  }

  return leftFile.localeCompare(rightFile);
}

async function main() {
  const entries = await fs.readdir(dataDir, { withFileTypes: true });
  const csvFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".csv"))
    .map((entry) => entry.name)
    .sort(sortCsvFiles)
    .map((fileName) => `data/${fileName}`);

  const manifest = {
    files: csvFiles,
  };

  await fs.writeFile(`${manifestPath}`, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Updated ${path.relative(projectRoot, manifestPath)} with ${csvFiles.length} CSV files.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

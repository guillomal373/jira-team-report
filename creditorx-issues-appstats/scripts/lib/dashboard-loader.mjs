// Runs the dashboard's real CSV code (js/*.js) inside a Node vm so scripts and
// tests use exactly the same parsing, identity and merge rules as the browser.

import { promises as fs } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DASHBOARD_SOURCES = ["config.js", "csv.js", "dates.js", "data-loading.js"];

// `root` is the folder the dashboard's index.html would live in (so "data/..." URLs resolve).
export async function createDashboardLoader({ root = projectRoot } = {}) {
  const context = vm.createContext({
    window: { location: { href: pathToFileURL(`${root}/`).href } },
    console,
    URL,
    Intl,
    Date,
    __readFile: (fileUrl) => fs.readFile(fileURLToPath(fileUrl), "utf8"),
  });

  vm.runInContext(
    `globalThis.fetch = async (fileUrl) => {
       let text;
       try {
         text = await __readFile(String(fileUrl));
       } catch {
         return { ok: false, status: 404, text: async () => "", json: async () => { throw new Error("404"); }, headers: { get: () => null } };
       }
       return { ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text), headers: { get: () => null } };
     };`,
    context
  );

  for (const source of DASHBOARD_SOURCES) {
    const filePath = path.join(projectRoot, "js", source);
    vm.runInContext(await fs.readFile(filePath, "utf8"), context, { filename: filePath });
  }

  vm.runInContext(
    `const __fileCache = new Map();
     const __load = (url) => {
       if (!__fileCache.has(url)) __fileCache.set(url, loadCsvFile(url));
       return __fileCache.get(url);
     };`,
    context
  );

  const toUrl = (filePath) => pathToFileURL(filePath).href;

  // Mirrors loadCsvTable() in js/app.js: load every file, merge with latestOnly: false.
  async function merge(filePaths) {
    context.__urls = filePaths.map(toUrl);
    const json = await vm.runInContext(
      `(async () => {
         const results = await Promise.allSettled(__urls.map((url) => __load(url)));
         const datasets = results
           .filter((result) => result.status === "fulfilled")
           .map((result) => result.value)
           .filter((dataset) => dataset.headers.length > 0);
         if (datasets.length === 0) return JSON.stringify({ main: null, themes: null });
         return JSON.stringify({
           main: mergeDatasets(datasets, { latestOnly: false }),
           themes: mergeDatasets(getDatasetsThroughToday(datasets), { latestOnly: false }),
         });
       })()`,
      context
    );
    return JSON.parse(json);
  }

  // For every file, how many issues have their final state (and "Last Update") in it.
  // Uses the same file order and issue identity as mergeDatasets().
  async function countIssuesOwnedByFile(filePaths) {
    context.__urls = filePaths.map(toUrl);
    const json = await vm.runInContext(
      `(async () => {
         const results = await Promise.allSettled(__urls.map((url) => __load(url)));
         const datasets = results
           .filter((result) => result.status === "fulfilled")
           .map((result) => result.value)
           .filter((dataset) => dataset.headers.length > 0);
         const ordered = [...datasets].sort((left, right) =>
           (left.sourceTimestamp - right.sourceTimestamp) || left.fileUrl.localeCompare(right.fileUrl)
         );
         const ambiguousKeys = findAmbiguousIssueKeys(ordered);
         const ownerByIssue = new Map();
         ordered.forEach((dataset) => {
           dataset.rows.forEach((row) => {
             ownerByIssue.set(getIssueIdentityKey(getDatasetRowMap(dataset, row), ambiguousKeys), dataset.fileUrl);
           });
         });
         const counts = {};
         datasets.forEach((dataset) => { counts[dataset.fileUrl] = 0; });
         ownerByIssue.forEach((fileUrl) => { counts[fileUrl] += 1; });
         return JSON.stringify({ counts, order: ordered.map((dataset) => dataset.fileUrl) });
       })()`,
      context
    );
    const { counts, order } = JSON.parse(json);
    const byPath = new Map(filePaths.map((filePath) => [toUrl(filePath), filePath]));
    return {
      counts: new Map(Object.entries(counts).map(([url, count]) => [byPath.get(url), count])),
      order: order.map((url) => byPath.get(url)),
    };
  }

  // Same data the dashboard computes from the CSV files (see buildDashboardData in
  // js/data-loading.js), plus the file format number used by data/issues-merged.json.
  async function build(filePaths) {
    context.__urls = filePaths.map(toUrl);
    const json = await vm.runInContext(
      `(async () => {
         const results = await Promise.allSettled(__urls.map((url) => __load(url)));
         const datasets = results
           .filter((result) => result.status === "fulfilled")
           .map((result) => result.value)
           .filter((dataset) => dataset.headers.length > 0);
         if (datasets.length === 0) return "null";
         return JSON.stringify({ format: MERGED_DATA_FORMAT, data: buildDashboardData(datasets) });
       })()`,
      context
    );
    return JSON.parse(json);
  }

  // Runs any expression of the dashboard's own code (e.g. loadMergedData(__urls)) and
  // returns its result as plain JSON.
  async function evaluate(expression, variables = {}) {
    Object.assign(context, variables);
    const json = await vm.runInContext(
      `(async () => JSON.stringify(await (${expression})) ?? "null")()`,
      context
    );
    return JSON.parse(json);
  }

  return { merge, countIssuesOwnedByFile, build, evaluate, toUrl };
}

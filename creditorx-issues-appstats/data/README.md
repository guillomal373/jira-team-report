# Daily CSV Update

Each time you add a new CSV file to this folder, update the manifest before reloading the dashboard.

## Steps

1. Copy the new CSV into this `data/` folder.
2. Open a terminal in `jira-team-report/creditorx-issues-appstats/`.
3. Run:

```bash
node scripts/update-files-manifest.mjs
```

4. Confirm that `data/files.json` now includes the new CSV file.
5. Reload the dashboard in the browser.

## Pre-merged file (`issues-merged.json`)

`node scripts/update-files-manifest.mjs` also writes `data/issues-merged.json`: all the CSVs
already merged (latest row per issue, with "Last Update"). The dashboard reads that one file
(about 1 MB) instead of every CSV. If it is missing, corrupt, or was built from a different
list of CSV files than `files.json`, the dashboard silently falls back to reading the CSVs.

- Run the command again whenever you add, replace or archive a CSV. If you edit a CSV
  **without changing its name**, the dashboard cannot tell, so always re-run the command.
- Do not edit `issues-merged.json` by hand. It is regenerated every time.
- To rebuild only this file: `node scripts/build-merged-data.mjs`.

## Filename format

Use filenames like:

- `Issues-8-may.csv`
- `Issues-8-may-2026.csv`

This allows the dashboard to infer the file date correctly.

## Important

- If you only copy the CSV but do not run the `node` command, the dashboard may not load the new file.
- If `node` is not installed on your machine, the command will fail and `data/files.json` must be updated another way.

## Archiving redundant CSV files

The dashboard identifies an issue by **Customer ID + Date (creation date)**; the Jira ticket is not part of the identity, because one ticket can resolve many issues. Two rows with the same customer and date in one file are told apart by their reported text. For every issue the dashboard keeps the row from the **last** CSV that contains it
(that row also sets its "Last Update"). A CSV that is the last one for no issue is redundant.

```bash
npm run archive-csvs              # report only, nothing is moved
npm run archive-csvs -- --apply   # move redundant files to data/archive/ and refresh files.json
npm test                          # run the tests
```

Before moving anything, the script merges the CSVs with the dashboard's real code
(`js/*.js`) with and without the candidates and refuses to proceed unless the result is
identical. If a move fails or the result changes afterwards, everything is put back.
Files in `data/archive/` are not loaded by the dashboard; move one back and run
`node scripts/update-files-manifest.mjs` to restore it.

## Column names (old vs. current form)

The CSV columns changed on 12-nov and 19-nov. The dashboard renames/merges them when it
loads each file (`HEADER_ALIASES` in `js/config.js`, `normalizeDatasetColumns` in
`js/csv.js`), so old and new CSVs appear in the same columns:

| Old column | Current column |
|---|---|
| IOS or Android | Operating system |
| CreditorX Device | Brand and Model |
| Reported Issue | What was the customer trying to do? |
| Carrier/Provider | Carrier/Provider (also filled from `Carrier/Provider2`; "Otro" uses `Carrier/Provider/Otro`) |
| Module/Section | Module/Section (blank values filled from "Which part of the app has the issue?", e.g. Login → Auth/Login, Blocked / Call blocking → Blocked List) |

New columns shown as-is: `What Happened?`, `Which part of the app has the issue?`,
`Which other part of the app?`, `Time to Call`. `What Happened?` is also used for theme
classification and search.

If the columns change again, add the new name to `config.js` and re-run
`node scripts/update-files-manifest.mjs`. Bump `MERGED_DATA_FORMAT` when column names change.

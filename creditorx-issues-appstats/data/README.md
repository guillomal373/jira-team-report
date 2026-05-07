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

## Filename format

Use filenames like:

- `Issues-8-may.csv`
- `Issues-8-may-2026.csv`

This allows the dashboard to infer the file date correctly.

## Important

- If you only copy the CSV but do not run the `node` command, the dashboard may not load the new file.
- If `node` is not installed on your machine, the command will fail and `data/files.json` must be updated another way.

# creditorx-issues-appstats

## Daily update flow

This dashboard is static. It does not reliably scan the `data/` folder by itself in every hosting environment.

When you add a new daily CSV:

1. Copy the new file into `data/`.
2. Run:

```bash
node scripts/update-files-manifest.mjs
```

3. Reload the page.

## Important behavior

- The app reads `data/files.json` first. That file must contain the CSV list that should be loaded.
- Multiple CSV files are merged, and the newest file now overrides older rows for the same issue, even when the status did not change.
- Keep the filename date pattern like `Issues-8-may.csv` or `Issues-8-may-2026.csv` so the app can infer the update date correctly.

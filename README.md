# Jira Team Report

Static web dashboard to visualize team and sprint metrics from Jira CSV exports. The page consumes local JSON/CSV files and draws charts with Chart.js to show story point trends, member performance, and a summary board for the current sprint.

**Main features**
- Daily story point trend by status and by member.
- Story points completed matrix by member.
- Full CSV table with filters by assignee and status.
- Quick view per selectable sprint.

**How to run**
1. Go to the project folder:
```
cd /Users/guillermomalagon/Library/CloudStorage/OneDrive-DSSOLUTIONSS.A.S/Documentos/team-gamification/jira-team-report
```
2. Start a local server (recommended so `fetch` can read JSON/CSV):
```
python3 -m http.server 8080
```
3. Open in the browser:
```
http://localhost:8080
```

**Key structure**
- `index.html`: dashboard layout and sections.
- `styles.css`: styles and visual theme.
- `script.js`: data loading, aggregations, and charts.
- `data/team.json`: members, roles, Jira aliases, and visual config.
- `data/sprints.json`: sprint catalog and CSV path per sprint.
- `data/sprint_story_points.json`: daily story point series by sprint.
- `data/sprints-csv/`: Jira CSV exports per sprint.

**Expected CSV format**
The dashboard needs at least these columns (names from the Jira export):
- `Assignee`
- `Status`
- `Custom field (Story point estimate)` or any column containing `Story point`
- `Updated` (or `Created`, `Start Date`, `Due Date` as date alternatives)

**Update data (new sprint)**
1. Export the sprint from Jira in CSV (ideally “Sprint Summary export”).
2. Save the file in `data/sprints-csv/`.
3. Add an entry in `data/sprints.json` with `name`, `period`, and `csvFile`.
4. (Optional) Update `data/sprint_story_points.json` if you want the daily trend.
5. If an assignee name changes in Jira, add an alias in `data/team.json` using `csvAliases`.

**Troubleshooting**
- No data appears: verify the CSV column names and that the local server is running.
- Empty filters or missing members: check `data/team.json` and add `csvAliases`.
- Load errors on `file://`: use `python3 -m http.server` instead of opening the HTML directly.

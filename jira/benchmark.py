#!/usr/bin/env python3
"""
benchmark.py — Benchmarks the core data-processing functions from script.js,
re-implemented in Python for portability. Measures the hot-path operations
that run on every sprint switch.

Run: python3 benchmark.py
"""

import json
import os
import re
import time
import unicodedata
from pathlib import Path
from statistics import median, quantiles

# ─── Paths ───────────────────────────────────────────────────────────────────

BASE = Path(__file__).parent
DATA_DIR = BASE / "data"
CSV_DIR = DATA_DIR / "sprints-csv"

# ─── Helpers ─────────────────────────────────────────────────────────────────

STATUS_ORDER = ["To Do", "In Progress", "In Review", "Done"]


def normalize_name(value: str) -> str:
    """Mirrors script.js normalizeName()"""
    s = str(value or "").lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")  # strip accents
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def parse_csv(text: str) -> "list[list[str]]":
    """Mirrors script.js parseCsv() — character-by-character parser."""
    text = text.lstrip("\uFEFF")
    rows: "list[list[str]]" = []
    row: list[str] = []
    value = []
    in_quotes = False
    i = 0
    while i < len(text):
        char = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""
        if in_quotes:
            if char == '"' and nxt == '"':
                value.append('"')
                i += 2
                continue
            elif char == '"':
                in_quotes = False
            else:
                value.append(char)
            i += 1
            continue
        if char == '"':
            in_quotes = True
        elif char == ",":
            row.append("".join(value))
            value = []
        elif char == "\n":
            row.append("".join(value))
            rows.append(row)
            row = []
            value = []
        elif char != "\r":
            value.append(char)
        i += 1
    if value or row:
        row.append("".join(value))
        rows.append(row)
    return rows


def parse_csv_date(value: str) -> "Optional[str]":
    """Mirrors script.js parseCsvDate()"""
    raw = str(value or "").strip()
    if not raw:
        return None
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})", raw)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.search(r"(\d{1,2})/([A-Za-z]{3})/(\d{2,4})", raw)
    if not m:
        return None
    month_map = {
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    }
    month = month_map.get(m.group(2).lower())
    if not month:
        return None
    year_raw = m.group(3)
    year = int("20" + year_raw if len(year_raw) == 2 else year_raw)
    day = int(m.group(1))
    return f"{year:04d}-{month:02d}-{day:02d}"


def get_assignee_index(header: list[str]) -> int:
    for i, c in enumerate(header):
        if c.strip().lower() == "assignee":
            return i
    return -1


def get_status_index(header: list[str]) -> int:
    for i, c in enumerate(header):
        if c.strip().lower() == "status":
            return i
    return -1


def get_story_point_index(header: list[str]) -> int:
    normalized = [c.strip().lower() for c in header]
    for i, c in enumerate(normalized):
        if c == "custom field (story point estimate)":
            return i
    for i, c in enumerate(normalized):
        if "story point estimate" in c:
            return i
    for i, c in enumerate(normalized):
        if "story point" in c:
            return i
    return -1


def build_explicit_alias_map(team_members: list[dict]) -> dict[str, str]:
    m: dict[str, str] = {}
    for member in team_members:
        name = member.get("name")
        if not name:
            continue
        aliases = member.get("csvAliases") or member.get("csvAlias") or []
        if not isinstance(aliases, list):
            aliases = [aliases]
        for alias in aliases:
            norm = normalize_name(alias)
            if alias and norm:
                m[norm] = name
    return m


def build_assignee_alias_map(
    team_members: list[dict],
    csv_assignees: list[str],
    explicit_aliases: dict[str, str],
) -> dict[str, str]:
    """Mirrors script.js buildAssigneeAliasMap()"""
    team_normalized = [
        {"name": m.get("name", ""), "normalized": normalize_name(m.get("name", ""))}
        for m in team_members
        if m.get("name") and normalize_name(m.get("name", ""))
    ]

    alias_map: dict[str, str] = {}
    for assignee in csv_assignees:
        norm_assignee = normalize_name(assignee)
        if not norm_assignee:
            continue
        if norm_assignee in explicit_aliases:
            alias_map[assignee] = explicit_aliases[norm_assignee]
            continue
        match = next((e for e in team_normalized if e["normalized"] == norm_assignee), None)
        if not match:
            matches = [
                e for e in team_normalized
                if norm_assignee in e["normalized"] or e["normalized"] in norm_assignee
            ]
            if matches:
                match = max(matches, key=lambda e: len(e["normalized"]))
        alias_map[assignee] = match["name"] if match else assignee
    return alias_map


def build_member_datasets_from_csv(rows, team_members, explicit_aliases):
    if not rows:
        return {"labels": [], "datasets": []}
    header = [str(c or "").strip() for c in rows[0]]
    header_lower = [c.lower() for c in header]
    assignee_idx = next((i for i, c in enumerate(header_lower) if c == "assignee"), -1)
    status_idx = next((i for i, c in enumerate(header_lower) if c == "status" or "status" in c), -1)
    points_idx = next((i for i, c in enumerate(header_lower) if "story point" in c), -1)
    updated_idx = next((i for i, c in enumerate(header_lower) if c == "updated"), -1)
    if assignee_idx < 0 or status_idx < 0 or points_idx < 0 or updated_idx < 0:
        return {"labels": [], "datasets": []}

    data_rows = rows[1:]
    csv_assignees = list(dict.fromkeys(
        str(r[assignee_idx] or "").strip() for r in data_rows if str(r[assignee_idx] or "").strip()
    ))
    alias_map = build_assignee_alias_map(team_members, csv_assignees, explicit_aliases)
    active_members = [m for m in team_members if m.get("active") is not False]
    active_names = {m["name"] for m in active_members if m.get("name")}

    has_done = any(
        str(r[status_idx] or "").strip().lower() == "done"
        and float(str(r[points_idx] or "0").replace(",", ".") or "0") > 0
        for r in data_rows
    )
    include_all = not has_done

    dates_set: set[str] = set()
    by_member_date: dict[str, dict[str, float]] = {}
    totals_by_member: dict[str, float] = {}

    for r in data_rows:
        raw_assignee = str(r[assignee_idx] or "").strip()
        if not raw_assignee:
            continue
        canonical = alias_map.get(raw_assignee, raw_assignee)
        if canonical not in active_names:
            continue
        status = str(r[status_idx] or "").strip()
        if not status:
            continue
        if not include_all and status.lower() != "done":
            continue
        date_key = parse_csv_date(r[updated_idx])
        if not date_key:
            continue
        try:
            points = float(str(r[points_idx] or "0").replace(",", "."))
        except ValueError:
            points = 0.0
        if not (points > 0):
            continue
        dates_set.add(date_key)
        by_member_date.setdefault(canonical, {})
        by_member_date[canonical][date_key] = by_member_date[canonical].get(date_key, 0) + points
        totals_by_member[canonical] = totals_by_member.get(canonical, 0) + points

    labels = sorted(dates_set)
    datasets = []
    for member in active_members:
        name = member.get("name", "")
        per_date = by_member_date.get(name, {})
        running = 0.0
        data = []
        for day in labels:
            running += per_date.get(day, 0)
            data.append(running)
        total = totals_by_member.get(name, 0)
        datasets.append({"label": name, "data": data, "totals": [total] * len(labels)})
    return {"labels": labels, "datasets": datasets}


def build_trend_data_from_csv(rows, team_members, explicit_aliases):
    if not rows:
        return None
    header = [str(c or "").strip() for c in rows[0]]
    header_lower = [c.lower() for c in header]
    assignee_idx = next((i for i, c in enumerate(header_lower) if c == "assignee"), -1)
    status_idx = next((i for i, c in enumerate(header_lower) if c == "status" or "status" in c), -1)
    points_idx = next((i for i, c in enumerate(header_lower) if "story point" in c), -1)
    date_indexes = [
        next((i for i, c in enumerate(header_lower) if c == "updated"), -1),
        next((i for i, c in enumerate(header_lower) if c == "created"), -1),
        next((i for i, c in enumerate(header_lower) if "start date" in c), -1),
        next((i for i, c in enumerate(header_lower) if c == "due date"), -1),
    ]
    date_indexes = [i for i in date_indexes if i >= 0]
    if status_idx < 0 or points_idx < 0:
        return None

    data_rows = rows[1:]
    csv_assignees = list(dict.fromkeys(
        str(r[assignee_idx] or "").strip() for r in data_rows if assignee_idx >= 0 and str(r[assignee_idx] or "").strip()
    ))
    alias_map = build_assignee_alias_map(team_members, csv_assignees, explicit_aliases)
    active_names = {m["name"] for m in team_members if m.get("name")}

    date_map: dict[str, dict[str, float]] = {}
    seen_states: set[str] = set()

    for r in data_rows:
        if assignee_idx >= 0 and active_names:
            raw_assignee = str(r[assignee_idx] or "").strip()
            if not raw_assignee:
                continue
            canonical = alias_map.get(raw_assignee, raw_assignee)
            if canonical not in active_names:
                continue
        status = str(r[status_idx] or "").strip()
        if not status:
            continue
        date_raw = next((r[i] for i in date_indexes if str(r[i] or "").strip()), None)
        date_key = parse_csv_date(date_raw)
        if not date_key:
            continue
        try:
            points = float(str(r[points_idx] or "0").replace(",", "."))
        except ValueError:
            points = 0.0
        date_map.setdefault(date_key, {})
        date_map[date_key][status] = date_map[date_key].get(status, 0) + points
        seen_states.add(status)

    if not date_map:
        return None
    labels = sorted(date_map.keys())
    states = [s for s in STATUS_ORDER if s in seen_states] + [s for s in seen_states if s not in STATUS_ORDER]
    datasets = [{"label": s, "data": [date_map[d].get(s, 0) for d in labels]} for s in states]
    return {"labels": labels, "datasets": datasets}


def build_status_totals_from_csv(rows, team_members, explicit_aliases):
    if not rows:
        return {"counts": {}, "states": []}
    header = [str(c or "").strip() for c in rows[0]]
    header_lower = [c.lower() for c in header]
    assignee_idx = next((i for i, c in enumerate(header_lower) if c == "assignee"), -1)
    status_idx = next((i for i, c in enumerate(header_lower) if c == "status" or "status" in c), -1)
    points_idx = next((i for i, c in enumerate(header_lower) if "story point" in c), -1)
    if status_idx < 0 or points_idx < 0:
        return {"counts": {}, "states": []}

    data_rows = rows[1:]
    csv_assignees = list(dict.fromkeys(
        str(r[assignee_idx] or "").strip() for r in data_rows if assignee_idx >= 0 and str(r[assignee_idx] or "").strip()
    ))
    alias_map = build_assignee_alias_map(team_members, csv_assignees, explicit_aliases)
    active_names = {m["name"] for m in team_members if m.get("name")}

    counts: dict[str, float] = {}
    states: set[str] = set()
    for r in data_rows:
        if assignee_idx >= 0 and active_names:
            raw = str(r[assignee_idx] or "").strip()
            if not raw:
                continue
            canonical = alias_map.get(raw, raw)
            if canonical not in active_names:
                continue
        status = str(r[status_idx] or "").strip()
        if not status:
            continue
        try:
            points = float(str(r[points_idx] or "0").replace(",", "."))
        except ValueError:
            points = 0.0
        counts[status] = counts.get(status, 0) + points
        states.add(status)
    return {"counts": counts, "states": list(states)}


def build_story_point_matrix_from_csv(rows, team_members, explicit_aliases):
    if not rows:
        return {"header": [], "rows": [], "total": 0}
    header = [str(c or "").strip() for c in rows[0]]
    assignee_idx = get_assignee_index(header)
    status_idx = get_status_index(header)
    points_idx = get_story_point_index(header)
    if assignee_idx < 0 or points_idx < 0:
        return {"header": [], "rows": [], "total": 0}

    data_rows = rows[1:]
    csv_assignees = list(dict.fromkeys(
        str(r[assignee_idx] or "").strip() for r in data_rows if str(r[assignee_idx] or "").strip()
    ))
    alias_map = build_assignee_alias_map(team_members, csv_assignees, explicit_aliases)
    active_members = [m for m in team_members if m.get("active") is not False]
    active_name_set = {m["name"] for m in active_members if m.get("name")}

    counts_by_member: dict[str, dict[str, int]] = {}
    totals_by_member: dict[str, int] = {}
    point_set: set[str] = set()
    total = 0

    for r in data_rows:
        raw = str(r[assignee_idx] or "").strip()
        if not raw:
            continue
        canonical = alias_map.get(raw, raw)
        if active_name_set and canonical not in active_name_set:
            continue
        if status_idx >= 0:
            status = str(r[status_idx] or "").strip()
            if not status or status.lower() != "done":
                continue
        raw_pts = str(r[points_idx] or "").strip()
        pts_label = raw_pts if raw_pts else "Sin estimar"
        point_set.add(pts_label)
        counts_by_member.setdefault(canonical, {})
        counts_by_member[canonical][pts_label] = counts_by_member[canonical].get(pts_label, 0) + 1
        totals_by_member[canonical] = totals_by_member.get(canonical, 0) + 1
        total += 1

    return {"header": ["Member"] + list(point_set), "rows": [], "total": total}


def build_label_map_from_csv(rows, alias_map):
    if not rows:
        return {}
    header = [str(c or "").strip() for c in rows[0]]
    assignee_idx = next((i for i, c in enumerate(header) if c.lower() == "assignee"), -1)
    label_idxs = [i for i, c in enumerate(header) if c.lower().startswith("labels")]
    if assignee_idx < 0 or not label_idxs:
        return {}

    result: dict[str, dict[str, int]] = {}
    for r in rows[1:]:
        assignee = str(r[assignee_idx] or "").strip()
        if not assignee:
            continue
        canonical = alias_map.get(assignee, assignee)
        if canonical not in result:
            result[canonical] = {}
        for idx in label_idxs:
            cell = str(r[idx] or "").strip()
            if not cell:
                continue
            for label in re.split(r"[,;]+", cell):
                v = label.strip()
                if v:
                    result[canonical][v] = result[canonical].get(v, 0) + 1
    return result


def build_member_done_totals_from_csv(rows, team_members, explicit_aliases):
    if not rows:
        return None
    header = [str(c or "").strip() for c in rows[0]]
    assignee_idx = get_assignee_index(header)
    status_idx = get_status_index(header)
    points_idx = get_story_point_index(header)
    if assignee_idx < 0 or status_idx < 0 or points_idx < 0:
        return None

    data_rows = rows[1:]
    csv_assignees = list(dict.fromkeys(
        str(r[assignee_idx] or "").strip() for r in data_rows if str(r[assignee_idx] or "").strip()
    ))
    alias_map = build_assignee_alias_map(team_members, csv_assignees, explicit_aliases)
    active_names = {m["name"] for m in team_members if m.get("active") is not False and m.get("name")}

    totals: dict[str, float] = {}
    for r in data_rows:
        raw = str(r[assignee_idx] or "").strip()
        if not raw:
            continue
        canonical = alias_map.get(raw, raw)
        if active_names and canonical not in active_names:
            continue
        status = str(r[status_idx] or "").strip()
        if not status or status.lower() != "done":
            continue
        try:
            pts = float(str(r[points_idx] or "0").replace(",", "."))
        except ValueError:
            pts = 0.0
        if pts > 0:
            totals[canonical] = totals.get(canonical, 0) + pts
    return totals


# ─── Benchmark harness ──────────────────────────────────────────────────────

def bench(name: str, iterations: int, fn) -> dict:
    # warmup
    for _ in range(min(3, iterations)):
        fn()

    times = []
    for _ in range(iterations):
        t0 = time.perf_counter()
        fn()
        times.append((time.perf_counter() - t0) * 1000)  # ms

    times.sort()
    avg = sum(times) / len(times)
    med = median(times)
    p95 = times[int(len(times) * 0.95)]
    return {"name": name, "iterations": iterations, "avg": avg, "median": med,
            "p95": p95, "min": times[0], "max": times[-1]}


def fmt_ms(n: float) -> str:
    if n < 1:
        return f"{n * 1000:.0f}µs"
    return f"{n:.3f}ms"


def print_results(results: list[dict]) -> None:
    name_w = max(len(r["name"]) for r in results)
    hdr = f"{'FUNCTION':<{name_w}}  {'ITERS':>6}  {'AVG':>9}  {'MEDIAN':>9}  {'P95':>9}  {'MIN':>9}  {'MAX':>9}"
    sep = "─" * len(hdr)
    print(f"\n{sep}")
    print(hdr)
    print(sep)
    for r in results:
        print(f"{r['name']:<{name_w}}  {r['iterations']:>6}  {fmt_ms(r['avg']):>9}  "
              f"{fmt_ms(r['median']):>9}  {fmt_ms(r['p95']):>9}  "
              f"{fmt_ms(r['min']):>9}  {fmt_ms(r['max']):>9}")
    print(sep)
    worst = sorted(results, key=lambda r: r["avg"], reverse=True)
    print("\n⚠️  WORST PERFORMERS (by avg):")
    for i, r in enumerate(worst[:3], 1):
        print(f"  {i}. {r['name']}: avg={fmt_ms(r['avg'])}, p95={fmt_ms(r['p95'])}")


# ─── Load test data ──────────────────────────────────────────────────────────

team_data = json.loads((DATA_DIR / "team.json").read_text(encoding="utf-8"))
team_members: list[dict] = team_data.get("team", [])
explicit_aliases = build_explicit_alias_map(team_members)

csv_files = sorted(CSV_DIR.glob("*.csv"))
parsed_csvs = []
for f in csv_files:
    text = f.read_text(encoding="utf-8", errors="replace")
    rows = [r for r in parse_csv(text) if any(str(c or "").strip() for c in r)]
    parsed_csvs.append({"name": f.name, "text": text, "rows": rows})

largest = max(parsed_csvs, key=lambda x: len(x["rows"]))
print(f"\nLoaded {len(csv_files)} CSV files.")
print(f'Using "{largest["name"]}" ({len(largest["rows"])} rows) for single-file benchmarks.')
print(f"Team members: {len(team_members)}")

# Precompute assignees for largest CSV
lh = [str(c or "").strip() for c in largest["rows"][0]] if largest["rows"] else []
l_assignee_idx = get_assignee_index(lh)
l_csv_assignees = list(dict.fromkeys(
    str(r[l_assignee_idx] or "").strip()
    for r in largest["rows"][1:]
    if l_assignee_idx >= 0 and str(r[l_assignee_idx] or "").strip()
)) if l_assignee_idx >= 0 else []

# Precompute alias map for label benchmark
alias_map_for_label = build_assignee_alias_map(team_members, l_csv_assignees, explicit_aliases)

# ─── Run benchmarks ───────────────────────────────────────────────────────────

ITERS = 500
results = []

print("\nRunning benchmarks...\n")

results.append(bench("parseCsv (largest CSV)", ITERS,
    lambda: parse_csv(largest["text"])))

results.append(bench("normalizeName (all team + CSV assignees)", ITERS,
    lambda: [normalize_name(m.get("name", "")) for m in team_members] +
            [normalize_name(a) for a in l_csv_assignees]))

results.append(bench("buildAssigneeAliasMap", ITERS,
    lambda: build_assignee_alias_map(team_members, l_csv_assignees, explicit_aliases)))

results.append(bench("buildAssigneeAliasMap ×4 (1 sprint switch)", ITERS, lambda: (
    build_assignee_alias_map(team_members, l_csv_assignees, explicit_aliases),
    build_assignee_alias_map(team_members, l_csv_assignees, explicit_aliases),
    build_assignee_alias_map(team_members, l_csv_assignees, explicit_aliases),
    build_assignee_alias_map(team_members, l_csv_assignees, explicit_aliases),
)))

results.append(bench("buildTrendDataFromCsvRows", ITERS,
    lambda: build_trend_data_from_csv(largest["rows"], team_members, explicit_aliases)))

results.append(bench("buildMemberDatasetsFromCsvRows", ITERS,
    lambda: build_member_datasets_from_csv(largest["rows"], team_members, explicit_aliases)))

results.append(bench("buildStatusTotalsFromCsvRows", ITERS,
    lambda: build_status_totals_from_csv(largest["rows"], team_members, explicit_aliases)))

results.append(bench("buildStoryPointMatrixFromCsvRows", ITERS,
    lambda: build_story_point_matrix_from_csv(largest["rows"], team_members, explicit_aliases)))

results.append(bench("buildLabelMapFromCsv", ITERS,
    lambda: build_label_map_from_csv(largest["rows"], alias_map_for_label)))

results.append(bench("buildMemberDoneTotalsFromCsvRows", ITERS,
    lambda: build_member_done_totals_from_csv(largest["rows"], team_members, explicit_aliases)))

results.append(bench("buildStatusTotals × all sprints (sequential)", 100, lambda: [
    build_status_totals_from_csv(c["rows"], team_members, explicit_aliases) for c in parsed_csvs
]))

results.append(bench("Full sprint-switch pipeline (no DOM)", ITERS, lambda: (
    build_trend_data_from_csv(largest["rows"], team_members, explicit_aliases),
    build_member_datasets_from_csv(largest["rows"], team_members, explicit_aliases),
    build_story_point_matrix_from_csv(largest["rows"], team_members, explicit_aliases),
    build_member_done_totals_from_csv(largest["rows"], team_members, explicit_aliases),
)))

print_results(results)

print("""
📊 PROFILING NOTES (for browser DevTools):
  • buildAssigneeAliasMap is called 4+ times per sprint switch, each time
    calling normalizeName() on every team member. The team list is static
    but the normalized version is recomputed on every call.
  • buildTrendDataFromCsvRows, buildMemberDatasetsFromCsvRows,
    buildStoryPointMatrixFromCsvRows and buildMemberDoneTotalsFromCsvRows
    each call buildAssigneeAliasMap independently.
  • Date comparisons in getLatestStatusEntry / computeSprintStatusCounts use
    new Date(string) inside a loop — ISO strings can be compared lexicographically.
  • loadCsvStatusSummaryForAllSprints processes sprint CSVs sequentially
    with await in a for-of loop instead of Promise.all.
  • renderCsvTable / renderStoryPointMatrix use createElement per cell
    (~60 rows × 19 cols = 1,140 DOM operations per render).

💡 BROWSER DEVTOOLS GUIDE:
  1. Open Chrome → DevTools → Performance tab
  2. Click Record, switch sprints 2–3 times, then Stop
  3. In the flame chart look for long tasks (red triangle = > 50ms)
  4. Expected hot spots:
     - innerHTML table rebuild (renderCsvTable)
     - buildAssigneeAliasMap × 4 calls
     - Chart.destroy() + new Chart() × 2-3 charts
     - updateWordClouds (rebuilds all member word clouds on every sprint switch)
""")

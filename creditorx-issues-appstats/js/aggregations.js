// Counts and groupings that feed the charts.

function renderStatusSummary(rows, headers) {
  statusSummaryList.replaceChildren();
  const counts = getStatusCounts(rows, headers);

  const summaryItems = [
    { label: "Total", value: rows.length, className: "status-total" },
    ...getStatusEntriesByVolume(counts).map(([status, value]) => ({
        label: status,
        value,
        className: STATUS_CLASS_MAP[status.toLowerCase()] ?? "status-default",
      })),
  ];

  summaryItems.forEach(({ label, value, className }, index) => {
    if (index % 3 === 0) {
      const group = document.createElement("div");
      group.className = "status-summary__group";
      statusSummaryList.appendChild(group);
    }

    const item = document.createElement("article");
    item.className = `status-summary__item ${className}`;
    item.title = label;

    const title = document.createElement("span");
    title.className = "status-summary__label";
    title.textContent = label;
    title.title = label;

    const count = document.createElement("strong");
    count.className = "status-summary__value";
    count.textContent = value.toLocaleString("en-US");

    item.append(title, count);
    statusSummaryList.lastElementChild.appendChild(item);
  });
}

function getStatusCounts(rows, headers) {
  const statusColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey(STATUS_COLUMN_NAME)
  );
  const tier2StateColumnIndex = getTier2StateColumnIndex(headers);
  const counts = new Map();

  rows.forEach((row) => {
    const rawStatus = getEffectiveRawStatus(row, statusColumnIndex, tier2StateColumnIndex);
    const status = normalizeStatusForCharts(rawStatus) || "Unknown";
    counts.set(status, (counts.get(status) ?? 0) + 1);
  });

  return counts;
}

function normalizePlatform(value) {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized.includes("android")) {
    return "Android";
  }

  if (
    normalized.includes("ios") ||
    normalized.includes("iphone") ||
    normalized.includes("ipad")
  ) {
    return "iOS";
  }

  return "Unknown";
}

function getPlatformCounts(rows, headers) {
  const platformColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey(PLATFORM_COLUMN_NAME)
  );
  const counts = new Map([
    ["Android", 0],
    ["iOS", 0],
    ["Unknown", 0],
  ]);

  rows.forEach((row) => {
    const platform = normalizePlatform(
      platformColumnIndex >= 0 ? row[platformColumnIndex] : ""
    );
    counts.set(platform, (counts.get(platform) ?? 0) + 1);
  });

  return counts;
}

// Classifies each issue by who answered it, based on the "O:"/"E:" markers
// left in its Tier 2 Comments. Both present on the same issue -> "E+O";
// neither present (or the column is empty) -> "No match".
function getTier2OwnerColumnIndices(headers) {
  return {
    tier2CommentsColumnIndex: headers.findIndex(
      (header) => normalizeColumnKey(header) === normalizeColumnKey(TIER_2_COMMENTS_COLUMN_NAME)
    ),
    devTeamCommentsColumnIndex: headers.findIndex(
      (header) => normalizeColumnKey(header) === normalizeColumnKey(DEV_TEAM_COMMENTS_COLUMN_NAME)
    ),
  };
}

function getTier2OwnerMarkers(row, tier2CommentsColumnIndex, devTeamCommentsColumnIndex) {
  const tier2Comments =
    tier2CommentsColumnIndex >= 0 ? row[tier2CommentsColumnIndex] ?? "" : "";
  const devTeamComments =
    devTeamCommentsColumnIndex >= 0 ? row[devTeamCommentsColumnIndex] ?? "" : "";
  const combinedText = `${tier2Comments}\n${devTeamComments}`;

  return {
    hasEngel: TIER_2_OWNER_MARKER_E.test(combinedText),
    hasOdana: TIER_2_OWNER_MARKER_O.test(combinedText),
    hasDiana: TIER_2_OWNER_MARKER_D.test(combinedText),
  };
}

function getTier2OwnerCounts(rows, headers) {
  const { tier2CommentsColumnIndex, devTeamCommentsColumnIndex } = getTier2OwnerColumnIndices(headers);
  const counts = new Map([
    ["Engel", 0],
    ["Odana", 0],
    ["Diana", 0],
    ["E+O", 0],
    ["E+D", 0],
    ["O+D", 0],
    ["E+O+D", 0],
    ["No match", 0],
  ]);

  rows.forEach((row) => {
    const { hasEngel, hasOdana, hasDiana } = getTier2OwnerMarkers(
      row,
      tier2CommentsColumnIndex,
      devTeamCommentsColumnIndex
    );

    let owner = "No match";
    if (hasEngel && hasOdana && hasDiana) {
      owner = "E+O+D";
    } else if (hasOdana && hasDiana) {
      owner = "O+D";
    } else if (hasEngel && hasDiana) {
      owner = "E+D";
    } else if (hasEngel && hasOdana) {
      owner = "E+O";
    } else if (hasDiana) {
      owner = "Diana";
    } else if (hasOdana) {
      owner = "Odana";
    } else if (hasEngel) {
      owner = "Engel";
    }

    counts.set(owner, (counts.get(owner) ?? 0) + 1);
  });

  return counts;
}

function getReportedByEntries(rows, headers) {
  const reportedByColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey(REPORTED_BY_COLUMN_NAME)
  );
  const statusColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey(STATUS_COLUMN_NAME)
  );
  const tier2StateColumnIndex = getTier2StateColumnIndex(headers);
  const counts = new Map();

  rows.forEach((row) => {
    const rawValue =
      reportedByColumnIndex >= 0 ? (row[reportedByColumnIndex] ?? "").trim() : "";
    const statusValue = getEffectiveRawStatus(row, statusColumnIndex, tier2StateColumnIndex);
    const status = normalizeStatusForCharts(statusValue) || "Unknown";
    const fullLabel = rawValue || "Unknown";
    const displayLabel = formatReportedByValue(fullLabel) || "Unknown";
    const current = counts.get(fullLabel) ?? {
      fullLabel,
      displayLabel,
      count: 0,
      statusCounts: new Map(),
    };

    current.count += 1;
    current.statusCounts.set(status, (current.statusCounts.get(status) ?? 0) + 1);
    counts.set(fullLabel, current);
  });

  return [...counts.values()]
    .map((entry) => ({
      ...entry,
      statusEntries: getStatusEntriesByVolume(entry.statusCounts),
    }))
    .sort((leftEntry, rightEntry) => {
      const countDifference = rightEntry.count - leftEntry.count;

      if (countDifference !== 0) {
        return countDifference;
      }

      return leftEntry.displayLabel.localeCompare(rightEntry.displayLabel);
    });
}

function getOrderedStatusEntries(counts) {
  const orderedEntries = [
    ...STATUS_SUMMARY_ORDER.filter((status) => counts.has(status)).map((status) => [
      status,
      counts.get(status) ?? 0,
    ]),
    ...[...counts.entries()].filter(
      ([status]) =>
        !STATUS_SUMMARY_ORDER.includes(status) && status !== "Unknown"
    ),
  ];

  if (counts.has("Unknown")) {
    orderedEntries.push(["Unknown", counts.get("Unknown") ?? 0]);
  }

  return orderedEntries;
}

function getStatusEntriesByVolume(counts) {
  return [...counts.entries()].sort((leftEntry, rightEntry) => {
    const countDifference = rightEntry[1] - leftEntry[1];

    if (countDifference !== 0) {
      return countDifference;
    }

    return leftEntry[0].localeCompare(rightEntry[0]);
  });
}

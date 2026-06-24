const DATA_DIRECTORY = "data/";
const CSV_MANIFEST_PATH = `${DATA_DIRECTORY}files.json`;
const FALLBACK_CSV_FILES = [
  "data/Issues-4-may.csv",
  "data/Issues-5-may.csv",
  "data/issues-6-may.csv",
  "data/Issues-7-may.csv",
  "data/Issues-8-may.csv",
];
const COLUMN_PREFS_STORAGE_KEY = "creditorx-issues-visible-columns-v1";
const DATE_COLUMN_NAME = "Date";
const LAST_UPDATE_COLUMN_NAME = "Last Update";
const REPORTED_BY_COLUMN_NAME = "Reported By";
const JIRA_TICKET_COLUMN_NAME = "Jira ticket";
const STATUS_COLUMN_NAME = "Status";
const PLATFORM_COLUMN_NAME = "IOS or Android";
const DEV_TEAM_COMMENTS_COLUMN_NAME = "Dev Team comments";
const ISSUE_IDENTITY_COLUMN_NAMES = [
  "Customer Name",
  DATE_COLUMN_NAME,
  "Customer ID",
  "IOS or Android",
  "Reported Issue",
];
const REQUIRED_COLUMN_NAMES = [
  DATE_COLUMN_NAME,
  "Reported Issue",
  STATUS_COLUMN_NAME,
];
const DEFAULT_VISIBLE_COLUMN_NAMES = [
  DATE_COLUMN_NAME,
  LAST_UPDATE_COLUMN_NAME,
  "Reported Issue",
  STATUS_COLUMN_NAME,
  DEV_TEAM_COMMENTS_COLUMN_NAME,
  JIRA_TICKET_COLUMN_NAME,
];
const ISSUE_THEME_CONFIG = window.CREDITORX_ISSUE_THEME_CONFIG ?? {};
const ISSUE_THEME_RULES = ISSUE_THEME_CONFIG.rules ?? [];
const FALLBACK_ISSUE_THEME = ISSUE_THEME_CONFIG.fallbackTheme ?? {
  label: "Other / Needs Review",
  shortLabel: "Other",
  keywords: [],
};
const THEME_STOP_WORDS = new Set(ISSUE_THEME_CONFIG.stopWords ?? []);

const recordsCount = document.getElementById("records-count");
const recordsHead = document.getElementById("records-head");
const recordsBody = document.getElementById("records-body");
const recordsSubtitle = document.getElementById("records-subtitle");
const startDateFilter = document.getElementById("start-date-filter");
const endDateFilter = document.getElementById("end-date-filter");
const statusFilter = document.getElementById("status-filter");
const statusSummaryList = document.getElementById("status-summary-list");
const statusPieChart = document.getElementById("status-pie-chart");
const statusPieLegend = document.getElementById("status-pie-legend");
const statusPieSubtitle = document.getElementById("status-pie-subtitle");
const platformSubtitle = document.getElementById("platform-subtitle");
const platformBar = document.getElementById("platform-bar");
const platformList = document.getElementById("platform-list");
const timelineChart = document.getElementById("timeline-chart");
const timelineSubtitle = document.getElementById("timeline-subtitle");
const timelineLegend = document.getElementById("timeline-legend");
const topicsSubtitle = document.getElementById("topics-subtitle");
const topicsRankingTotal = document.getElementById("topics-ranking-total");
const topicsRankingCard = document.querySelector(".topics-card--ranking");
const topicsGroupingCard = document.querySelector(".topics-card--grouping");
const topicsBars = document.getElementById("topics-bars");
const topicsTopTickets = document.getElementById("topics-top-tickets");
const topicsGroupingCoverage = document.getElementById("topics-grouping-coverage");
const topicsGroupingMetrics = document.getElementById("topics-grouping-metrics");
const topicsGroupingList = document.getElementById("topics-grouping-list");
const columnsControl = document.getElementById("columns-control");
const columnsToggle = document.getElementById("columns-toggle");
const columnsMenu = document.getElementById("columns-menu");
const columnsList = document.getElementById("columns-list");
const columnsSelectAll = document.getElementById("columns-select-all");
const columnsReset = document.getElementById("columns-reset");

let tableHeaders = [];
let allRows = [];
let dateSortDirection = "desc";
let visibleColumns = new Set();
let timelineTooltip = null;
let issueTextTooltip = null;
let selectedIssueThemeLabel = "";

const STATUS_CLASS_MAP = {
  new: "status-new",
  triage: "status-triage",
  "call agent (additional information)": "status-call-agent",
  "in queue": "status-in-queue",
  "in progress": "status-in-progress",
  completed: "status-completed",
  "resolved with cx": "status-resolved-cx",
  "unresolved with cx": "status-unresolved-cx",
  "follow up": "status-follow-up",
};
const STATUS_SUMMARY_ORDER = [
  "New",
  "Triage",
  "Call Agent (Additional information)",
  "In queue",
  "In progress",
  "Completed",
  "Resolved with cx",
  "Unresolved with cx",
  "Follow up",
];
const STATUS_COLOR_MAP = {
  new: "#525252",
  triage: "#7e2ba1",
  "call agent (additional information)": "#ad7104",
  "in queue": "#0e87d7",
  "in progress": "#1aa8ee",
  completed: "#11a86a",
  "resolved with cx": "#7ca313",
  "unresolved with cx": "#b1163d",
  "follow up": "#c38711",
  unknown: "#8b8b8b",
};
const PLATFORM_COLOR_MAP = {
  Android: "#11a86a",
  iOS: "#1aa8ee",
  Unknown: "#696969",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let index = 0;
  let insideQuotes = false;

  while (index < text.length) {
    const char = text[index];

    if (insideQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          index += 2;
          continue;
        }

        insideQuotes = false;
        index += 1;
        continue;
      }

      value += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = true;
      index += 1;
      continue;
    }

    if (char === ",") {
      row.push(value);
      value = "";
      index += 1;
      continue;
    }

    if (char === "\n" || char === "\r") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";

      if (char === "\r" && text[index + 1] === "\n") {
        index += 2;
      } else {
        index += 1;
      }

      continue;
    }

    value += char;
    index += 1;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows.filter((currentRow) =>
    currentRow.some((cell) => cell.trim() !== "")
  );
}

function normalizeHeader(header) {
  return header.trim() || "Unnamed Column";
}

function normalizeColumnKey(header) {
  return normalizeHeader(header).toLowerCase();
}

function normalizeIdentityValue(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeCustomerId(value) {
  return normalizeIdentityValue(value).replace(/^cordoba-/, "");
}

function getIssueIdentityKey(rowMap) {
  const jiraTicket = normalizeIdentityValue(rowMap.get(JIRA_TICKET_COLUMN_NAME));

  if (jiraTicket) {
    return `jira:${jiraTicket}`;
  }

  const customerId = normalizeCustomerId(rowMap.get("Customer ID"));
  const issueDate = normalizeIdentityValue(rowMap.get(DATE_COLUMN_NAME));

  if (customerId && issueDate) {
    return `customer-date:${customerId}||${issueDate}`;
  }

  return `details:${ISSUE_IDENTITY_COLUMN_NAMES.map((header) =>
    normalizeIdentityValue(rowMap.get(header))
  ).join("||")}`;
}

function isRequiredColumn(header) {
  return REQUIRED_COLUMN_NAMES.some(
    (requiredHeader) =>
      normalizeColumnKey(requiredHeader) === normalizeColumnKey(header)
  );
}

function readStoredVisibleColumns() {
  try {
    const rawValue = window.localStorage.getItem(COLUMN_PREFS_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

function persistVisibleColumns() {
  try {
    window.localStorage.setItem(
      COLUMN_PREFS_STORAGE_KEY,
      JSON.stringify([...visibleColumns])
    );
  } catch {
    // Ignore storage failures and keep the current in-memory selection.
  }
}

function initializeVisibleColumns(headers) {
  const storedColumns = readStoredVisibleColumns();
  const nextVisibleColumns = new Set();
  const storedKeys = new Set(
    (storedColumns ?? []).map((header) => normalizeColumnKey(header))
  );
  const defaultKeys = new Set(
    DEFAULT_VISIBLE_COLUMN_NAMES.map((header) => normalizeColumnKey(header))
  );

  headers.forEach((header) => {
    if (isRequiredColumn(header)) {
      nextVisibleColumns.add(header);
      return;
    }

    if (
      (!storedColumns && defaultKeys.has(normalizeColumnKey(header))) ||
      (storedColumns && storedKeys.has(normalizeColumnKey(header)))
    ) {
      nextVisibleColumns.add(header);
    }
  });

  visibleColumns = nextVisibleColumns;
  persistVisibleColumns();
}

function resetVisibleColumns() {
  const defaultKeys = new Set(
    DEFAULT_VISIBLE_COLUMN_NAMES.map((header) => normalizeColumnKey(header))
  );
  visibleColumns = new Set(
    tableHeaders.filter(
      (header) =>
        isRequiredColumn(header) || defaultKeys.has(normalizeColumnKey(header))
    )
  );
  persistVisibleColumns();
  renderColumnsMenu(tableHeaders);
  refreshTable();
}

function showAllColumns() {
  visibleColumns = new Set(tableHeaders);
  persistVisibleColumns();
  renderColumnsMenu(tableHeaders);
  refreshTable();
}

function getVisibleColumnIndices(headers) {
  return headers
    .map((header, index) => ({ header, index }))
    .filter(
      ({ header }) => isRequiredColumn(header) || visibleColumns.has(header)
    );
}

function renderColumnsMenu(headers) {
  columnsList.replaceChildren();

  headers.forEach((header) => {
    const item = document.createElement("div");
    item.className = "columns-menu__item";

    const label = document.createElement("label");
    label.className = "columns-menu__label";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "columns-menu__checkbox";
    checkbox.checked = isRequiredColumn(header) || visibleColumns.has(header);
    checkbox.disabled = isRequiredColumn(header);

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        visibleColumns.add(header);
      } else {
        visibleColumns.delete(header);
      }

      persistVisibleColumns();
      refreshTable();
    });

    const text = document.createElement("span");
    text.className = "columns-menu__text";
    text.textContent = header;

    label.append(checkbox, text);
    item.appendChild(label);

    if (isRequiredColumn(header)) {
      const meta = document.createElement("span");
      meta.className = "columns-menu__meta";
      meta.textContent = "Required";
      item.appendChild(meta);
    }

    columnsList.appendChild(item);
  });
}

function openColumnsMenu() {
  columnsMenu.hidden = false;
  columnsToggle.setAttribute("aria-expanded", "true");
}

function closeColumnsMenu() {
  columnsMenu.hidden = true;
  columnsToggle.setAttribute("aria-expanded", "false");
}

function toggleColumnsMenu() {
  if (columnsMenu.hidden) {
    openColumnsMenu();
  } else {
    closeColumnsMenu();
  }
}

function formatDisplayDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function formatCompactDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function getTimelineTooltip() {
  if (timelineTooltip) {
    return timelineTooltip;
  }

  timelineTooltip = document.createElement("div");
  timelineTooltip.className = "timeline-tooltip";
  timelineTooltip.hidden = true;
  document.body.appendChild(timelineTooltip);
  return timelineTooltip;
}

function hideTimelineTooltip() {
  const tooltip = getTimelineTooltip();
  tooltip.hidden = true;
}

function setTimelineTooltipPosition(clientX, clientY) {
  const tooltip = getTimelineTooltip();
  const offset = 16;
  const { innerWidth, innerHeight } = window;
  const { width, height } = tooltip.getBoundingClientRect();
  let left = clientX + offset;
  let top = clientY + offset;

  if (left + width > innerWidth - 12) {
    left = Math.max(12, clientX - width - offset);
  }

  if (top + height > innerHeight - 12) {
    top = Math.max(12, clientY - height - offset);
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function getIssueTextTooltip() {
  if (issueTextTooltip) {
    return issueTextTooltip;
  }

  issueTextTooltip = document.createElement("div");
  issueTextTooltip.className = "issue-text-tooltip";
  issueTextTooltip.hidden = true;
  document.body.appendChild(issueTextTooltip);
  return issueTextTooltip;
}

function hideIssueTextTooltip() {
  const tooltip = getIssueTextTooltip();
  tooltip.hidden = true;
}

function setIssueTextTooltipPosition(clientX, clientY) {
  const tooltip = getIssueTextTooltip();
  const offset = 14;
  const { innerWidth, innerHeight } = window;
  const { width, height } = tooltip.getBoundingClientRect();
  let left = clientX + offset;
  let top = clientY + offset;

  if (left + width > innerWidth - 12) {
    left = Math.max(12, clientX - width - offset);
  }

  if (top + height > innerHeight - 12) {
    top = Math.max(12, clientY - height - offset);
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function showIssueTextTooltip(issueText, clientX, clientY) {
  const tooltip = getIssueTextTooltip();
  tooltip.textContent = issueText;
  tooltip.hidden = false;
  setIssueTextTooltipPosition(clientX, clientY);
}

function getTimelineTooltipText(point) {
  const lines = [
    `${formatDisplayDate(point.date)}: ${point.total} issue${point.total === 1 ? "" : "s"}`,
  ];

  point.segments.forEach((segment) => {
    lines.push(`${segment.status}: ${segment.value}`);
  });

  return lines.join("\n");
}

function showTimelineTooltip(point, clientX, clientY) {
  const tooltip = getTimelineTooltip();
  tooltip.replaceChildren();

  const dateLabel = document.createElement("p");
  dateLabel.className = "timeline-tooltip__date";
  dateLabel.textContent = formatDisplayDate(point.date);

  const totalLabel = document.createElement("p");
  totalLabel.className = "timeline-tooltip__total";
  totalLabel.textContent = `${point.total} issue${point.total === 1 ? "" : "s"} total`;

  const conventionLabel = document.createElement("p");
  conventionLabel.className = "timeline-tooltip__section-label";
  conventionLabel.textContent = "Status convention";

  const list = document.createElement("div");
  list.className = "timeline-tooltip__list";

  point.segments.forEach((segment) => {
    const item = document.createElement("div");
    item.className = "timeline-tooltip__item";

    const statusGroup = document.createElement("div");
    statusGroup.className = "timeline-tooltip__status";

    const swatch = document.createElement("span");
    swatch.className = "timeline-tooltip__swatch";
    swatch.style.setProperty("--tooltip-color", getStatusColor(segment.status));

    const label = document.createElement("span");
    label.className = "timeline-tooltip__label";
    label.textContent = segment.status;

    const value = document.createElement("span");
    value.className = "timeline-tooltip__value";
    value.textContent = String(segment.value);

    statusGroup.append(swatch, label);
    item.append(statusGroup, value);
    list.appendChild(item);
  });

  tooltip.append(dateLabel, totalLabel, conventionLabel, list);
  tooltip.hidden = false;
  setTimelineTooltipPosition(clientX, clientY);
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value) {
  const trimmed = (value ?? "").trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const [, yearPart, monthPart, dayPart] = match;
  const parsedDate = new Date(
    Number(yearPart),
    Number(monthPart) - 1,
    Number(dayPart)
  );

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function parseFileDateFromFilename(fileUrl) {
  const fileName = decodeURIComponent(fileUrl.split("/").pop() ?? "");
  const match = fileName.match(/(\d{1,2})-([a-zA-Z]+)(?:-(\d{4}))?/);

  if (!match) {
    return null;
  }

  const [, dayPart, monthPart, yearPart] = match;
  const inferredYear = yearPart ?? String(new Date().getFullYear());
  const parsedDate = new Date(`${monthPart} ${dayPart}, ${inferredYear}`);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function parseDateFromFilename(fileUrl) {
  const parsedDate = parseFileDateFromFilename(fileUrl);
  return parsedDate ? formatDisplayDate(parsedDate) : "";
}

function getFileUpdateMeta(response, fileUrl) {
  const fileDate = parseFileDateFromFilename(fileUrl);

  if (fileDate) {
    return {
      timestamp: fileDate.getTime(),
      label: formatDisplayDate(fileDate),
    };
  }

  const lastModifiedHeader = response.headers.get("Last-Modified");

  if (lastModifiedHeader) {
    const parsedDate = new Date(lastModifiedHeader);

    if (!Number.isNaN(parsedDate.getTime())) {
      return {
        timestamp: parsedDate.getTime(),
        label: formatDisplayDate(parsedDate),
      };
    }
  }

  return {
    timestamp: Number.NEGATIVE_INFINITY,
    label: parseDateFromFilename(fileUrl),
  };
}

function setSubtitle(fileCount) {
  const label = fileCount === 1 ? "file" : "files";
  recordsSubtitle.innerHTML = `Data loaded from ${fileCount} CSV ${label} in <code>data/</code>.`;
}

async function discoverCsvFiles() {
  const manifestUrl = new URL(CSV_MANIFEST_PATH, window.location.href);

  try {
    const response = await fetch(manifestUrl, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const manifest = await response.json();
    const fileEntries = Array.isArray(manifest)
      ? manifest
      : Array.isArray(manifest.files)
        ? manifest.files
        : [];
    const manifestFiles = fileEntries
      .map((filePath) => String(filePath || "").trim())
      .filter(
        (filePath) =>
          filePath.length > 0 && filePath.toLowerCase().endsWith(".csv")
      )
      .map((filePath) => new URL(filePath, window.location.href).toString());

    if (manifestFiles.length > 0) {
      return manifestFiles;
    }
  } catch (error) {
    console.warn("Unable to load CSV manifest.", error);
  }

  const directoryUrl = new URL(DATA_DIRECTORY, window.location.href);

  try {
    const response = await fetch(directoryUrl, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const documentFragment = new DOMParser().parseFromString(html, "text/html");
    const files = [...documentFragment.querySelectorAll("a[href]")]
      .map((link) => new URL(link.getAttribute("href"), directoryUrl))
      .filter(
        (url) =>
          url.origin === window.location.origin &&
          url.pathname.toLowerCase().includes("/data/") &&
          url.pathname.toLowerCase().endsWith(".csv")
      )
      .map((url) => url.toString());

    const uniqueFiles = [...new Map(
      files.map((fileUrl) => [new URL(fileUrl).pathname, fileUrl])
    ).values()];

    if (uniqueFiles.length > 0) {
      return uniqueFiles;
    }
  } catch (error) {
    console.warn("Unable to auto-discover CSV files in data/.", error);
  }

  return FALLBACK_CSV_FILES.map((filePath) =>
    new URL(filePath, window.location.href).toString()
  );
}

async function loadCsvFile(fileUrl) {
  const response = await fetch(fileUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const csvText = await response.text();
  const parsedRows = parseCsv(csvText);
  const updateMeta = getFileUpdateMeta(response, fileUrl);

  if (parsedRows.length === 0) {
    return {
      headers: [],
      rows: [],
      sourceTimestamp: updateMeta.timestamp,
      sourceLastUpdate: updateMeta.label,
      fileUrl,
    };
  }

  const [headers, ...dataRows] = parsedRows;
  const normalizedHeaders = headers.map(normalizeHeader);

  return {
    headers: normalizedHeaders,
    rows: dataRows.map((row) =>
      normalizedHeaders.map((_, columnIndex) => row[columnIndex] ?? "")
    ),
    sourceTimestamp: updateMeta.timestamp,
    sourceLastUpdate: updateMeta.label,
    fileUrl,
  };
}

function mergeDatasets(datasets) {
  const mergedHeaders = [];
  const seenHeaders = new Set();

  const datasetsInOrder = [...datasets].sort((leftDataset, rightDataset) => {
    const timestampDifference =
      leftDataset.sourceTimestamp - rightDataset.sourceTimestamp;

    if (timestampDifference !== 0) {
      return timestampDifference;
    }

    return leftDataset.fileUrl.localeCompare(rightDataset.fileUrl);
  });

  datasetsInOrder.forEach(({ headers }) => {
    headers.forEach((header) => {
      if (!seenHeaders.has(header)) {
        seenHeaders.add(header);
        mergedHeaders.push(header);
      }
    });
  });

  if (!mergedHeaders.includes(LAST_UPDATE_COLUMN_NAME)) {
    const dateColumnIndex = mergedHeaders.findIndex(
      (header) => normalizeColumnKey(header) === normalizeColumnKey(DATE_COLUMN_NAME)
    );
    const insertionIndex =
      dateColumnIndex >= 0 ? dateColumnIndex + 1 : mergedHeaders.length;
    mergedHeaders.splice(insertionIndex, 0, LAST_UPDATE_COLUMN_NAME);
  }

  const consolidatedIssues = new Map();
  const latestTimestamp = Math.max(
    ...datasetsInOrder.map((dataset) => dataset.sourceTimestamp)
  );
  const latestIssueKeys = new Set();

  datasetsInOrder.forEach((dataset) => {
    dataset.rows.forEach((row) => {
      const rowMap = new Map(
        dataset.headers.map((header, columnIndex) => [header, row[columnIndex] ?? ""])
      );
      const identityKey = getIssueIdentityKey(rowMap);
      const nextStatus = (rowMap.get(STATUS_COLUMN_NAME) ?? "").trim();
      const existingIssue = consolidatedIssues.get(identityKey);

      if (dataset.sourceTimestamp === latestTimestamp) {
        latestIssueKeys.add(identityKey);
      }

      if (!existingIssue) {
        const nextRow = mergedHeaders.map((header) =>
          header === LAST_UPDATE_COLUMN_NAME
            ? dataset.sourceLastUpdate
            : rowMap.get(header) ?? ""
        );
        consolidatedIssues.set(identityKey, {
          row: nextRow,
          status: nextStatus.toLowerCase(),
        });
        return;
      }

      existingIssue.row = mergedHeaders.map((header) =>
        header === LAST_UPDATE_COLUMN_NAME
          ? dataset.sourceLastUpdate
          : rowMap.get(header) ?? ""
      );
      existingIssue.status = nextStatus.toLowerCase();
    });
  });

  const mergedRows = [...consolidatedIssues.entries()]
    .filter(([identityKey]) => latestIssueKeys.has(identityKey))
    .map(([, issue]) => issue.row);

  return {
    headers: mergedHeaders,
    rows: mergedRows,
  };
}

function renderMessage(message, columnCount = 1, isError = false) {
  recordsHead.replaceChildren();
  recordsBody.replaceChildren();

  const row = document.createElement("tr");
  row.className = isError
    ? "records-table__empty records-table__empty--error"
    : "records-table__empty";

  const cell = document.createElement("td");
  cell.colSpan = columnCount;
  cell.textContent = message;
  row.appendChild(cell);
  recordsBody.appendChild(row);
}

function extractYear(dateValue) {
  const trimmed = (dateValue ?? "").trim();
  const match = trimmed.match(/^(\d{4})/);
  return match ? match[1] : "";
}

function parseSortableDate(dateValue) {
  const trimmed = (dateValue ?? "").trim();
  const timestamp = Date.parse(trimmed);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function sortRowsByDate(rows, headers, direction = "desc") {
  const dateColumnIndex = headers.findIndex(
    (header) => header.trim().toLowerCase() === DATE_COLUMN_NAME.toLowerCase()
  );

  if (dateColumnIndex < 0) {
    return [...rows];
  }

  return [...rows].sort((leftRow, rightRow) => {
    const difference =
      parseSortableDate(rightRow[dateColumnIndex]) -
      parseSortableDate(leftRow[dateColumnIndex]);

    return direction === "asc" ? -difference : difference;
  });
}

function updateRecordCount(rows) {
  recordsCount.textContent = rows.length.toLocaleString("en-US");
}

function formatReportedByValue(value) {
  const trimmed = (value ?? "").trim();

  if (!trimmed.includes("@")) {
    return trimmed;
  }

  return trimmed.split("@")[0].trim();
}

function getJiraTicketUrl(value) {
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    return "";
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed?.originalUrl) {
      return parsed.originalUrl.replaceAll("\\/", "/");
    }
  } catch {
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    if (/^[A-Z]+-\d+$/i.test(trimmed)) {
      return `https://hiredexperts.atlassian.net/browse/${trimmed}`;
    }
  }

  return "";
}

function formatJiraTicketLabel(value) {
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    return "";
  }

  try {
    const parsed = JSON.parse(trimmed);
    const originalUrl = parsed?.originalUrl?.replaceAll("\\/", "/");

    if (originalUrl) {
      return originalUrl.split("/").filter(Boolean).pop() ?? "Jira Ticket";
    }
  } catch {
    if (/^[A-Z]+-\d+$/i.test(trimmed)) {
      return trimmed.toUpperCase();
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed.split("/").filter(Boolean).pop() ?? "Jira Ticket";
    }
  }

  return trimmed;
}

function getDateColumnIndex(headers) {
  return headers.findIndex(
    (header) => header.trim().toLowerCase() === DATE_COLUMN_NAME.toLowerCase()
  );
}

function getAvailableDateRange(headers, rows) {
  const dateColumnIndex = headers.findIndex(
    (header) => header.trim().toLowerCase() === DATE_COLUMN_NAME.toLowerCase()
  );

  if (dateColumnIndex < 0) {
    return null;
  }

  const dates = [
    ...new Set(
      rows
        .map((row) => (row[dateColumnIndex] ?? "").trim())
        .filter((value) => parseIsoDate(value))
    ),
  ].sort((left, right) => left.localeCompare(right));

  if (dates.length === 0) {
    return null;
  }

  return {
    min: dates[0],
    max: dates[dates.length - 1],
    dates,
  };
}

function populateDateRangeFilter(headers, rows) {
  const availableRange = getAvailableDateRange(headers, rows);

  if (!availableRange) {
    startDateFilter.disabled = true;
    startDateFilter.value = "";
    startDateFilter.min = "";
    startDateFilter.max = "";
    endDateFilter.disabled = true;
    endDateFilter.value = "";
    endDateFilter.min = "";
    endDateFilter.max = "";
    return;
  }

  const currentYear = String(new Date().getFullYear());
  const currentYearDates = availableRange.dates.filter(
    (dateValue) => extractYear(dateValue) === currentYear
  );
  const defaultStart = currentYearDates[0] ?? availableRange.min;
  const defaultEnd =
    currentYearDates[currentYearDates.length - 1] ?? availableRange.max;

  [startDateFilter, endDateFilter].forEach((filter) => {
    filter.min = availableRange.min;
    filter.max = availableRange.max;
    filter.disabled = false;
  });

  startDateFilter.value = defaultStart;
  endDateFilter.value = defaultEnd;
}

function getSelectedDateRange() {
  const startDate = parseIsoDate(startDateFilter.value);
  const endDate = parseIsoDate(endDateFilter.value);

  if (!startDate || !endDate) {
    return null;
  }

  if (endDate < startDate) {
    return {
      startDate: endDate,
      endDate: startDate,
    };
  }

  return {
    startDate,
    endDate,
  };
}

function getRangeFilteredRows() {
  const selectedRange = getSelectedDateRange();
  const dateColumnIndex = getDateColumnIndex(tableHeaders);

  if (!selectedRange || dateColumnIndex < 0) {
    return allRows;
  }

  const { startDate, endDate } = selectedRange;

  return allRows.filter((row) => {
    const parsedDate = parseIsoDate(row[dateColumnIndex] ?? "");
    return parsedDate && parsedDate >= startDate && parsedDate <= endDate;
  });
}

function populateStatusFilter(rows, headers) {
  const statusColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey(STATUS_COLUMN_NAME)
  );
  const previousValue = statusFilter.value || "all";

  statusFilter.replaceChildren();

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All";
  statusFilter.appendChild(allOption);

  if (statusColumnIndex < 0) {
    statusFilter.disabled = true;
    statusFilter.value = "all";
    return;
  }

  const statuses = [...new Set(
    rows
      .map((row) => (row[statusColumnIndex] ?? "").trim())
      .filter(Boolean)
  )].sort((left, right) => left.localeCompare(right));

  statuses.forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    statusFilter.appendChild(option);
  });

  statusFilter.disabled = false;
  statusFilter.value = statuses.includes(previousValue) ? previousValue : "all";
}

function getStatusFilteredRows(rows, headers) {
  if (statusFilter.disabled || statusFilter.value === "all") {
    return rows;
  }

  const statusColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey(STATUS_COLUMN_NAME)
  );

  if (statusColumnIndex < 0) {
    return rows;
  }

  return rows.filter(
    (row) => (row[statusColumnIndex] ?? "").trim() === statusFilter.value
  );
}

function getTableFilteredRows(rows, headers) {
  return sortRowsByDate(rows, headers, dateSortDirection);
}

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
  const counts = new Map();

  rows.forEach((row) => {
    const rawStatus =
      statusColumnIndex >= 0 ? (row[statusColumnIndex] ?? "").trim() : "";
    const status = rawStatus || "Unknown";
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

function getStatusColor(status) {
  return STATUS_COLOR_MAP[status.toLowerCase()] ?? STATUS_COLOR_MAP.unknown;
}

function parseHexColor(color) {
  const trimmed = String(color ?? "").trim();
  const normalized = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;

  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return null;
  }

  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function getSegmentLabelColor(color) {
  const rgb = parseHexColor(color);

  if (!rgb) {
    return "#f5f5f5";
  }

  const brightness = (rgb.red * 299 + rgb.green * 587 + rgb.blue * 114) / 1000;
  return brightness > 160 ? "#161616" : "#f6f6f6";
}

function clampColorChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function shiftHexColor(color, amount) {
  const rgb = parseHexColor(color);

  if (!rgb) {
    return color;
  }

  const shifted = [rgb.red, rgb.green, rgb.blue]
    .map((channel) => clampColorChannel(channel + amount))
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("");

  return `#${shifted}`;
}

function getStatusGradient(status) {
  const color = getStatusColor(status);
  return `linear-gradient(180deg, ${shiftHexColor(color, 42)}, ${shiftHexColor(color, -34)})`;
}

function getTimelineScale(maxObservedValue) {
  const safeMaxValue = Math.max(1, Math.ceil(maxObservedValue));

  if (safeMaxValue <= 6) {
    return {
      axisMax: safeMaxValue,
      tickStep: 1,
      tickCount: safeMaxValue,
    };
  }

  const tickCount = 4;
  const tickStep = Math.max(1, Math.ceil(safeMaxValue / tickCount));

  return {
    axisMax: tickStep * tickCount,
    tickStep,
    tickCount,
  };
}

function describeDateRangeSelection() {
  const selectedRange = getSelectedDateRange();

  if (!selectedRange) {
    return "the selected range";
  }

  return `${formatCompactDate(selectedRange.startDate)} to ${formatCompactDate(selectedRange.endDate)}`;
}

function buildTimelineRange() {
  const selectedRange = getSelectedDateRange();

  if (selectedRange) {
    return selectedRange;
  }

  const availableRange = getAvailableDateRange(tableHeaders, allRows);

  if (availableRange) {
    return {
      startDate: parseIsoDate(availableRange.min),
      endDate: parseIsoDate(availableRange.max),
    };
  }

  const today = new Date();
  return {
    startDate: today,
    endDate: today,
  };
}

function getTimelineSeries(rows, headers) {
  const dateColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey(DATE_COLUMN_NAME)
  );
  const statusColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey(STATUS_COLUMN_NAME)
  );
  const { startDate, endDate } = buildTimelineRange();
  const series = [];
  const counts = new Map();
  const currentDate = new Date(startDate);
  const timelineStatusCounts = new Map();

  rows.forEach((row) => {
    if (dateColumnIndex < 0) {
      return;
    }

    const parsedDate = parseIsoDate(row[dateColumnIndex] ?? "");

    if (!parsedDate || parsedDate < startDate || parsedDate > endDate) {
      return;
    }

    const isoDate = toIsoDate(parsedDate);
    const rawStatus =
      statusColumnIndex >= 0 ? (row[statusColumnIndex] ?? "").trim() : "";
    const status = rawStatus || "Unknown";
    const dateCounts = counts.get(isoDate) ?? new Map();
    dateCounts.set(status, (dateCounts.get(status) ?? 0) + 1);
    counts.set(isoDate, dateCounts);
    timelineStatusCounts.set(status, (timelineStatusCounts.get(status) ?? 0) + 1);
  });

  const orderedStatuses = getOrderedStatusEntries(timelineStatusCounts).map(
    ([status]) => status
  );

  while (currentDate <= endDate) {
    const isoDate = toIsoDate(currentDate);
    const dateCounts = counts.get(isoDate) ?? new Map();
    const segments = orderedStatuses
      .map((status) => ({
        status,
        value: dateCounts.get(status) ?? 0,
      }))
      .filter(({ value }) => value > 0);
    const total = segments.reduce((sum, segment) => sum + segment.value, 0);

    series.push({
      isoDate,
      label: formatCompactDate(currentDate),
      value: total,
      total,
      segments,
      date: new Date(currentDate),
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return {
    series,
    orderedStatuses,
    startDate,
    endDate,
  };
}

function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });

  return element;
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(centerX, centerY, radius, startAngle, endAngle) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M",
    centerX,
    centerY,
    "L",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
    "Z",
  ].join(" ");
}

function renderStatusPie(rows, headers) {
  statusPieChart.replaceChildren();
  statusPieLegend.replaceChildren();

  const counts = getStatusCounts(rows, headers);
  const entries = getStatusEntriesByVolume(counts);
  const total = rows.length;
  statusPieSubtitle.textContent = `Ticket share by current status for ${describeDateRangeSelection()}.`;

  if (total === 0 || entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "status-pie-card__empty";
    empty.textContent = "No records available for the selected range.";
    statusPieLegend.appendChild(empty);
    return;
  }

  let currentAngle = 0;
  entries.forEach(([status, value]) => {
    const percentage = value / total;
    const sweepAngle = percentage * 360;
    const slice = createSvgElement("path", {
      d: describeArc(160, 160, 118, currentAngle, currentAngle + sweepAngle),
      fill: getStatusColor(status),
      class: "status-pie-slice",
    });
    const title = createSvgElement("title");
    title.textContent = `${status}: ${value} ticket${value === 1 ? "" : "s"} (${(percentage * 100).toFixed(1)}%)`;
    slice.appendChild(title);
    statusPieChart.appendChild(slice);
    currentAngle += sweepAngle;
  });

  const centerRing = createSvgElement("circle", {
    cx: 160,
    cy: 160,
    r: 66,
    class: "status-pie-center-ring",
  });
  statusPieChart.appendChild(centerRing);

  const centerLabel = createSvgElement("text", {
    x: 160,
    y: 146,
    class: "status-pie-center-label",
  });
  centerLabel.textContent = "Total";
  statusPieChart.appendChild(centerLabel);

  const centerValue = createSvgElement("text", {
    x: 160,
    y: 186,
    class: "status-pie-center-value",
  });
  centerValue.textContent = total.toLocaleString("en-US");
  statusPieChart.appendChild(centerValue);

  entries.forEach(([status, value]) => {
    const percentage = (value / total) * 100;
    const item = document.createElement("div");
    item.className = "status-pie-card__legend-item";
    item.title = `${status}: ${value} ticket${value === 1 ? "" : "s"} (${percentage.toFixed(1)}%)`;

    const swatch = document.createElement("span");
    swatch.className = "status-pie-card__legend-swatch";
    swatch.style.setProperty("--legend-color", getStatusColor(status));

    const label = document.createElement("span");
    label.className = "status-pie-card__legend-label";
    label.textContent = status;

    const legendValue = document.createElement("span");
    legendValue.className = "status-pie-card__legend-value";
    legendValue.textContent = `${percentage.toFixed(1)}%`;

    item.append(swatch, label, legendValue);
    statusPieLegend.appendChild(item);
  });
}

function renderPlatformDistribution(rows, headers) {
  platformBar.replaceChildren();
  platformList.replaceChildren();

  const counts = getPlatformCounts(rows, headers);
  const total = rows.length;
  const knownPlatforms = ["Android", "iOS"];
  const knownTotal = knownPlatforms.reduce(
    (sum, platform) => sum + (counts.get(platform) ?? 0),
    0
  );
  const unknownCount = counts.get("Unknown") ?? 0;

  platformSubtitle.textContent = `Android and iOS share for ${describeDateRangeSelection()}. Unknown platform is listed separately.`;

  if (total === 0) {
    const empty = document.createElement("p");
    empty.className = "platform-card__empty";
    empty.textContent = "No records available for the selected range.";
    platformList.appendChild(empty);
    return;
  }

  knownPlatforms.forEach((platform) => {
    const value = counts.get(platform) ?? 0;
    const percentage = knownTotal === 0 ? 0 : (value / knownTotal) * 100;
    const segment = document.createElement("span");
    segment.className = "platform-card__bar-segment";
    segment.style.setProperty("--platform-color", PLATFORM_COLOR_MAP[platform]);
    segment.style.width = `${percentage}%`;
    segment.title = `${platform}: ${value.toLocaleString("en-US")} issue${value === 1 ? "" : "s"} (${percentage.toFixed(1)}% of known platform records)`;
    platformBar.appendChild(segment);
  });

  if (knownTotal === 0) {
    const emptyBar = document.createElement("span");
    emptyBar.className = "platform-card__bar-empty";
    emptyBar.textContent = "No platform data";
    platformBar.appendChild(emptyBar);
  }

  [
    ...knownPlatforms.map((platform) => ({
      label: platform,
      value: counts.get(platform) ?? 0,
      percentage: knownTotal === 0 ? 0 : ((counts.get(platform) ?? 0) / knownTotal) * 100,
      denominatorLabel: "known",
    })),
    {
      label: "Unknown",
      value: unknownCount,
      percentage: total === 0 ? 0 : (unknownCount / total) * 100,
      denominatorLabel: "all",
    },
  ].forEach(({ label, value, percentage, denominatorLabel }) => {
    const item = document.createElement("div");
    item.className = "platform-card__item";
    item.title = `${label}: ${value.toLocaleString("en-US")} issue${value === 1 ? "" : "s"} (${percentage.toFixed(1)}% of ${denominatorLabel} records)`;

    const swatch = document.createElement("span");
    swatch.className = "platform-card__swatch";
    swatch.style.setProperty("--platform-color", PLATFORM_COLOR_MAP[label]);

    const name = document.createElement("span");
    name.className = "platform-card__label";
    name.textContent = label;

    const count = document.createElement("span");
    count.className = "platform-card__count";
    count.textContent = `${value.toLocaleString("en-US")} issues`;

    const percent = document.createElement("strong");
    percent.className = "platform-card__percent";
    percent.textContent = `${percentage.toFixed(1)}%`;

    item.append(swatch, name, count, percent);
    platformList.appendChild(item);
  });
}

function renderTimeline(rows, headers, scaleRows = rows) {
  const { series, orderedStatuses, startDate, endDate } = getTimelineSeries(
    rows,
    headers
  );
  const { series: scaleSeries } = getTimelineSeries(scaleRows, headers);

  timelineSubtitle.textContent = `Daily issue volume by status from ${formatCompactDate(startDate)} to ${formatCompactDate(endDate)}.`;
  timelineChart.replaceChildren();
  timelineLegend.replaceChildren();
  hideTimelineTooltip();

  const width = Math.max(960, series.length * 22);
  const height = 320;
  const margin = { top: 16, right: 22, bottom: 40, left: 46 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const observedMaxValue = Math.max(0, ...scaleSeries.map((point) => point.total));
  const { axisMax, tickStep, tickCount } = getTimelineScale(observedMaxValue);

  timelineChart.setAttribute("viewBox", `0 0 ${width} ${height}`);

  orderedStatuses.forEach((status) => {
    const item = document.createElement("div");
    item.className = "timeline-panel__legend-item";

    const swatch = document.createElement("span");
    swatch.className = "timeline-panel__legend-swatch";
    swatch.style.setProperty("--legend-color", getStatusColor(status));

    const label = document.createElement("span");
    label.className = "timeline-panel__legend-label";
    label.textContent = status;

    item.append(swatch, label);
    timelineLegend.appendChild(item);
  });

  for (let tick = 0; tick <= tickCount; tick += 1) {
    const value = tickStep * tick;
    const y =
      margin.top + innerHeight - (innerHeight * tick) / tickCount;

    const gridLine = createSvgElement("line", {
      x1: margin.left,
      y1: y,
      x2: width - margin.right,
      y2: y,
      class: tick === 0 ? "timeline-baseline" : "timeline-grid-line",
    });
    timelineChart.appendChild(gridLine);

    const label = createSvgElement("text", {
      x: margin.left - 10,
      y: y + 4,
      class: "timeline-axis-text timeline-axis-text--y",
    });
    label.textContent = String(value);
    timelineChart.appendChild(label);
  }

  if (series.length === 0) {
    return;
  }

  const getY = (value) =>
    margin.top + innerHeight - (value / axisMax) * innerHeight;
  const slotWidth = innerWidth / Math.max(series.length, 1);
  const barWidth = Math.max(10, Math.min(26, slotWidth * 0.72));
  const getBarX = (index) =>
    margin.left + index * slotWidth + (slotWidth - barWidth) / 2;

  const xLabelIndices = new Set([0, series.length - 1]);
  series.forEach((point, index) => {
    if (point.date.getDate() === 1 || index % 7 === 0) {
      xLabelIndices.add(index);
    }
  });

  series.forEach((point, index) => {
    const x = getBarX(index);
    const slotX = margin.left + index * slotWidth;
    let accumulatedValue = 0;

    point.segments.forEach((segment) => {
      const nextValue = accumulatedValue + segment.value;
      const y = getY(nextValue);
      const segmentHeight = getY(accumulatedValue) - y;
      const color = getStatusColor(segment.status);
      const rect = createSvgElement("rect", {
        x,
        y,
        width: barWidth,
        height: segmentHeight,
        rx: nextValue === point.total ? 4 : 0,
        ry: nextValue === point.total ? 4 : 0,
        fill: color,
        class: "timeline-bar-segment",
      });
      const title = createSvgElement("title");
      title.textContent = `${point.isoDate} · ${segment.status}: ${segment.value} issue${segment.value === 1 ? "" : "s"}`;
      rect.appendChild(title);
      timelineChart.appendChild(rect);

      if (segmentHeight >= 18) {
        const segmentLabel = createSvgElement("text", {
          x: x + barWidth / 2,
          y: y + segmentHeight / 2 + 4,
          class: "timeline-bar-value",
          fill: getSegmentLabelColor(color),
        });
        segmentLabel.textContent = String(segment.value);
        timelineChart.appendChild(segmentLabel);
      }

      accumulatedValue = nextValue;
    });

    if (point.total > 0) {
      const totalLabel = createSvgElement("text", {
        x: x + barWidth / 2,
        y: getY(point.total) - 8,
        class: "timeline-bar-total",
      });
      totalLabel.textContent = String(point.total);
      timelineChart.appendChild(totalLabel);

      const hitbox = createSvgElement("rect", {
        x: slotX,
        y: margin.top,
        width: slotWidth,
        height: innerHeight,
        fill: "transparent",
        class: "timeline-bar-hitbox",
        tabindex: 0,
      });
      hitbox.setAttribute("aria-label", getTimelineTooltipText(point));
      const title = createSvgElement("title");
      title.textContent = getTimelineTooltipText(point);
      hitbox.appendChild(title);

      hitbox.addEventListener("mousemove", (event) => {
        showTimelineTooltip(point, event.clientX, event.clientY);
      });
      hitbox.addEventListener("mouseenter", (event) => {
        showTimelineTooltip(point, event.clientX, event.clientY);
      });
      hitbox.addEventListener("mouseleave", () => {
        hideTimelineTooltip();
      });
      hitbox.addEventListener("focus", () => {
        const bounds = hitbox.getBoundingClientRect();
        showTimelineTooltip(
          point,
          bounds.left + bounds.width / 2,
          bounds.top + Math.min(bounds.height * 0.3, 48)
        );
      });
      hitbox.addEventListener("blur", () => {
        hideTimelineTooltip();
      });

      timelineChart.appendChild(hitbox);
    }

    if (xLabelIndices.has(index)) {
      const label = createSvgElement("text", {
        x: x + barWidth / 2,
        y: height - 12,
        class: "timeline-axis-text timeline-axis-text--x",
      });
      label.textContent = point.label;
      timelineChart.appendChild(label);
    }
  });
}

function normalizeIssueText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keywordMatchesIssue(normalizedText, keyword) {
  const normalizedKeyword = normalizeIssueText(keyword);

  if (!normalizedKeyword) {
    return false;
  }

  if (normalizedKeyword.includes(" ")) {
    return normalizedText.includes(normalizedKeyword);
  }

  return new RegExp(`\\b${normalizedKeyword}\\b`, "i").test(normalizedText);
}

function getIssueTheme(issueText) {
  const normalizedText = normalizeIssueText(issueText);

  if (!normalizedText) {
    return {
      theme: FALLBACK_ISSUE_THEME,
      matchedKeywords: [],
      normalizedText,
    };
  }

  let bestMatch = null;

  for (const theme of ISSUE_THEME_RULES) {
    const matchedKeywords = theme.keywords.filter((keyword) =>
      keywordMatchesIssue(normalizedText, keyword)
    );

    if (matchedKeywords.length > 0) {
      const score = matchedKeywords.reduce(
        (sum, keyword) => sum + normalizeIssueText(keyword).length,
        matchedKeywords.length * 10
      );

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          score,
          theme,
          matchedKeywords,
        };
      }
    }
  }

  if (bestMatch) {
    return {
      theme: bestMatch.theme,
      matchedKeywords: bestMatch.matchedKeywords,
      normalizedText,
    };
  }

  return {
    theme: FALLBACK_ISSUE_THEME,
    matchedKeywords: [],
    normalizedText,
  };
}

function getTopWords(textEntries, limit = 4) {
  const counts = new Map();

  textEntries.forEach((text) => {
    normalizeIssueText(text)
      .split(" ")
      .filter((word) => word.length > 3 && !THEME_STOP_WORDS.has(word))
      .forEach((word) => {
        counts.set(word, (counts.get(word) ?? 0) + 1);
      });
  });

  return [...counts.entries()]
    .sort((leftEntry, rightEntry) => {
      const countDifference = rightEntry[1] - leftEntry[1];

      if (countDifference !== 0) {
        return countDifference;
      }

      return leftEntry[0].localeCompare(rightEntry[0]);
    })
    .slice(0, limit)
    .map(([word]) => word);
}

function getIssueThemeAnalysis(rows, headers) {
  const issueColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey("Reported Issue")
  );
  const dateColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey(DATE_COLUMN_NAME)
  );
  const statusColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey(STATUS_COLUMN_NAME)
  );
  const jiraTicketColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey(JIRA_TICKET_COLUMN_NAME)
  );
  const devTeamCommentsColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey(DEV_TEAM_COMMENTS_COLUMN_NAME)
  );
  const themes = new Map();
  let issueTextCount = 0;
  let automaticallyGroupedCount = 0;

  if (issueColumnIndex < 0) {
    return {
      entries: [],
      total: rows.length,
      issueTextCount,
      automaticallyGroupedCount,
    };
  }

  rows.forEach((row) => {
    const issueText = row[issueColumnIndex] ?? "";

    if (!normalizeIssueText(issueText)) {
      return;
    }

    issueTextCount += 1;
    const { theme, matchedKeywords } = getIssueTheme(issueText);
    const current = themes.get(theme.label) ?? {
      label: theme.label,
      shortLabel: theme.shortLabel,
      count: 0,
      matchedKeywords: new Map(),
      statusCounts: new Map(),
      texts: [],
      tickets: [],
      isFallback: theme.label === FALLBACK_ISSUE_THEME.label,
    };
    const statusValue =
      statusColumnIndex >= 0 ? (row[statusColumnIndex] ?? "").trim() : "";
    const jiraTicketValue =
      jiraTicketColumnIndex >= 0 ? row[jiraTicketColumnIndex] ?? "" : "";
    const devTeamComments =
      devTeamCommentsColumnIndex >= 0
        ? (row[devTeamCommentsColumnIndex] ?? "").trim()
        : "";

    current.count += 1;
    current.statusCounts.set(
      statusValue || "Unknown",
      (current.statusCounts.get(statusValue || "Unknown") ?? 0) + 1
    );
    current.texts.push(issueText);
    current.tickets.push({
      date: dateColumnIndex >= 0 ? row[dateColumnIndex] ?? "" : "",
      status: statusValue,
      ticketLabel: formatJiraTicketLabel(jiraTicketValue),
      ticketUrl: getJiraTicketUrl(jiraTicketValue),
      issueText,
      devTeamComments,
    });
    matchedKeywords.forEach((keyword) => {
      current.matchedKeywords.set(
        keyword,
        (current.matchedKeywords.get(keyword) ?? 0) + 1
      );
    });

    if (!current.isFallback) {
      automaticallyGroupedCount += 1;
    }

    themes.set(theme.label, current);
  });

  const entries = [...themes.values()]
    .map((entry) => ({
      ...entry,
      signals:
        entry.matchedKeywords.size > 0
          ? [...entry.matchedKeywords.entries()]
              .sort((leftEntry, rightEntry) => rightEntry[1] - leftEntry[1])
              .slice(0, 4)
              .map(([keyword]) => keyword)
          : getTopWords(entry.texts, 4),
      statusEntries: getStatusEntriesByVolume(entry.statusCounts),
    }))
    .sort((leftEntry, rightEntry) => {
      const countDifference = rightEntry.count - leftEntry.count;

      if (countDifference !== 0) {
        return countDifference;
      }

      return leftEntry.label.localeCompare(rightEntry.label);
    });

  return {
    entries,
    total: rows.length,
    issueTextCount,
    automaticallyGroupedCount,
  };
}

function renderTopicInsights(rows, headers) {
  const analysis = getIssueThemeAnalysis(rows, headers);
  const topEntries = analysis.entries.slice(0, 10);
  const maxCount = Math.max(1, ...topEntries.map((entry) => entry.count));
  const coverage =
    analysis.issueTextCount === 0
      ? 0
      : (analysis.automaticallyGroupedCount / analysis.issueTextCount) * 100;

  topicsSubtitle.textContent = `Top 10 issue topics from reported issue text for ${describeDateRangeSelection()}.`;
  topicsRankingTotal.textContent = `${analysis.issueTextCount.toLocaleString("en-US")} Issues`;
  topicsGroupingCoverage.textContent = `${coverage.toFixed(0)}% Covered`;
  topicsBars.replaceChildren();
  topicsTopTickets.replaceChildren();
  topicsGroupingMetrics.replaceChildren();
  topicsGroupingList.replaceChildren();

  if (topEntries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "topics-empty";
    empty.textContent = "No reported issue text available for the selected range.";
    topicsBars.appendChild(empty);
    selectedIssueThemeLabel = "";
    return;
  }

  const selectedEntry =
    topEntries.find((entry) => entry.label === selectedIssueThemeLabel) ??
    topEntries[0];
  selectedIssueThemeLabel = selectedEntry.label;

  topEntries.forEach((entry, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "topics-bar";
    item.dataset.themeLabel = entry.label;
    const statusBreakdown = entry.statusEntries
      .map(([status, count]) => `${status}: ${count}`)
      .join("\n");
    item.title = `${entry.label}: ${entry.count} issue${entry.count === 1 ? "" : "s"}\n${statusBreakdown}`;
    item.setAttribute(
      "aria-label",
      `Show issues for ${entry.label}, ${entry.count} issue${entry.count === 1 ? "" : "s"}`
    );
    item.setAttribute(
      "aria-pressed",
      entry.label === selectedEntry.label ? "true" : "false"
    );

    const value = document.createElement("span");
    value.className = "topics-bar__value";
    value.textContent = entry.count.toLocaleString("en-US");

    const track = document.createElement("div");
    track.className = "topics-bar__track";

    const fill = document.createElement("span");
    fill.className = "topics-bar__fill";
    fill.style.height = `${Math.max(10, (entry.count / maxCount) * 100)}%`;
    fill.style.setProperty("--bar-rank", String(index + 1));

    entry.statusEntries.forEach(([status, count]) => {
      const segment = document.createElement("span");
      segment.className = "topics-bar__segment";
      segment.style.height = `${(count / entry.count) * 100}%`;
      segment.style.background = getStatusGradient(status);
      segment.title = `${status}: ${count} issue${count === 1 ? "" : "s"}`;
      fill.appendChild(segment);
    });

    const label = document.createElement("span");
    label.className = "topics-bar__label";
    label.textContent = entry.shortLabel;

    track.appendChild(fill);
    item.append(value, track, label);
    item.addEventListener("click", () => {
      selectedIssueThemeLabel = entry.label;
      renderTopicInsights(rows, headers);
    });
    topicsBars.appendChild(item);
  });

  renderSelectedThemeTickets(selectedEntry);

  const metrics = [
    {
      label: "Grouped",
      value: analysis.automaticallyGroupedCount.toLocaleString("en-US"),
      description:
        "Issues automatically assigned to one of the defined topic groups using keyword signals from the reported issue text.",
    },
    {
      label: "Review",
      value: Math.max(
        0,
        analysis.issueTextCount - analysis.automaticallyGroupedCount
      ).toLocaleString("en-US"),
      description:
        "Issues with reported text that did not match the current grouping rules and should be reviewed manually.",
    },
    {
      label: "Themes",
      value: analysis.entries.length.toLocaleString("en-US"),
      description:
        "Total topic groups currently represented in the selected data, including the manual review bucket when present.",
    },
  ];

  metrics.forEach(({ label, value, description }) => {
    const metric = document.createElement("div");
    metric.className = "topics-grouping__metric";

    const metricHeader = document.createElement("div");
    metricHeader.className = "topics-grouping__metric-header";

    const metricLabel = document.createElement("span");
    metricLabel.textContent = label;

    const info = document.createElement("button");
    info.type = "button";
    info.className = "topics-grouping__info";
    info.setAttribute("aria-label", `${label} info`);
    info.dataset.tooltip = description;
    info.textContent = "i";

    const metricValue = document.createElement("strong");
    metricValue.textContent = value;

    metricHeader.append(metricLabel, info);
    metric.append(metricHeader, metricValue);
    topicsGroupingMetrics.appendChild(metric);
  });

  topEntries.forEach((entry) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "topics-grouping__item";
    item.setAttribute(
      "aria-label",
      `Show issues for ${entry.label}, ${entry.count} issue${entry.count === 1 ? "" : "s"}`
    );
    item.setAttribute(
      "aria-pressed",
      entry.label === selectedEntry.label ? "true" : "false"
    );

    const title = document.createElement("div");
    title.className = "topics-grouping__item-title";

    const label = document.createElement("strong");
    label.textContent = entry.label;

    const count = document.createElement("span");
    count.textContent = `${entry.count} issue${entry.count === 1 ? "" : "s"}`;

    const signals = document.createElement("p");
    signals.className = "topics-grouping__signals";
    signals.textContent =
      entry.signals.length > 0
        ? `Signals: ${entry.signals.join(", ")}`
        : "Signals: manual review needed";

    title.append(label, count);
    item.append(title, signals);
    item.addEventListener("click", () => {
      selectedIssueThemeLabel = entry.label;
      renderTopicInsights(rows, headers);
    });
    topicsGroupingList.appendChild(item);
  });

  syncTopicCardHeights();
}

function renderSelectedThemeTickets(selectedEntry) {
  const header = document.createElement("div");
  header.className = "topics-top-tickets__header";

  const title = document.createElement("h4");
  title.textContent = "Issues linked to selected theme";

  const theme = document.createElement("span");
  theme.textContent = `${selectedEntry.label} · ${selectedEntry.count} issue${selectedEntry.count === 1 ? "" : "s"}`;

  header.append(title, theme);
  topicsTopTickets.appendChild(header);

  const ticketEntries = [...selectedEntry.tickets].sort((leftTicket, rightTicket) => {
    const difference =
      parseSortableDate(rightTicket.date) - parseSortableDate(leftTicket.date);

    if (difference !== 0) {
      return difference;
    }

    return (rightTicket.ticketLabel || "").localeCompare(
      leftTicket.ticketLabel || ""
    );
  });

  if (ticketEntries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "topics-top-tickets__empty";
    empty.textContent = "No issues recorded for this theme.";
    topicsTopTickets.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "topics-top-tickets__list";

  ticketEntries.forEach((ticket) => {
    const item = document.createElement("div");
    item.className = "topics-top-tickets__item";

    const link = document.createElement(ticket.ticketUrl ? "a" : "span");
    link.className = "topics-top-tickets__link";
    link.textContent = ticket.ticketLabel || "No Jira ticket";

    if (ticket.ticketUrl) {
      link.href = ticket.ticketUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }

    const meta = document.createElement("span");
    meta.className = "topics-top-tickets__meta";
    meta.textContent = [ticket.date, ticket.status].filter(Boolean).join(" · ");

    const issue = document.createElement("p");
    issue.className = "topics-top-tickets__issue";
    issue.textContent = ticket.issueText;

    const comments = document.createElement("p");
    comments.className = "topics-top-tickets__comments";
    comments.textContent = `Dev Team Comments: ${
      ticket.devTeamComments || "No comments recorded"
    }`;

    item.addEventListener("mouseenter", (event) => {
      const tooltipText = [
        ticket.issueText,
        `Dev Team Comments: ${ticket.devTeamComments || "No comments recorded"}`,
      ].join("\n\n");
      showIssueTextTooltip(tooltipText, event.clientX, event.clientY);
    });
    item.addEventListener("mousemove", (event) => {
      setIssueTextTooltipPosition(event.clientX, event.clientY);
    });
    item.addEventListener("mouseleave", hideIssueTextTooltip);

    item.append(link, meta, issue, comments);
    list.appendChild(item);
  });

  topicsTopTickets.appendChild(list);
}

function syncTopicCardHeights() {
  if (!topicsRankingCard || !topicsGroupingCard) {
    return;
  }

  window.requestAnimationFrame(() => {
    if (window.matchMedia("(max-width: 980px)").matches) {
      topicsRankingCard.style.height = "";
      return;
    }

    topicsRankingCard.style.height = "";
    const groupingHeight = topicsGroupingCard.offsetHeight;

    if (groupingHeight > 0) {
      topicsRankingCard.style.height = `${groupingHeight}px`;
    }
  });
}

function refreshTable() {
  const rangeFilteredRows = getRangeFilteredRows();
  populateStatusFilter(rangeFilteredRows, tableHeaders);

  const baseFilteredRows = getStatusFilteredRows(rangeFilteredRows, tableHeaders);
  renderStatusSummary(baseFilteredRows, tableHeaders);
  renderStatusPie(baseFilteredRows, tableHeaders);
  renderPlatformDistribution(baseFilteredRows, tableHeaders);
  renderTimeline(baseFilteredRows, tableHeaders);
  renderTopicInsights(baseFilteredRows, tableHeaders);

  const filteredRows = getTableFilteredRows(baseFilteredRows, tableHeaders);
  const visibleColumnCount = Math.max(getVisibleColumnIndices(tableHeaders).length, 1);
  updateRecordCount(filteredRows);

  if (filteredRows.length === 0) {
    renderMessage("No records found for the selected filters.", visibleColumnCount);
    return;
  }

  renderTable(tableHeaders, filteredRows);
}

function handleDateRangeFilterChange() {
  const startDate = parseIsoDate(startDateFilter.value);
  const endDate = parseIsoDate(endDateFilter.value);

  if (startDate && endDate && endDate < startDate) {
    startDateFilter.value = toIsoDate(endDate);
    endDateFilter.value = toIsoDate(startDate);
  }

  refreshTable();
}

function openDatePicker(event) {
  const dateInput = event.currentTarget;

  if (
    typeof dateInput.showPicker === "function" &&
    !dateInput.disabled
  ) {
    try {
      dateInput.showPicker();
    } catch {
      // Ignore browsers that block programmatic picker opening.
    }
  }
}

function renderTable(headers, rows) {
  const headerRow = document.createElement("tr");
  const visibleColumnIndices = getVisibleColumnIndices(headers);
  const statusColumnIndex = headers.findIndex(
    (header) => header.trim().toLowerCase() === STATUS_COLUMN_NAME.toLowerCase()
  );

  visibleColumnIndices.forEach(({ header }) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    const normalizedHeader = header.trim().toLowerCase();

    if (
      normalizedHeader === DATE_COLUMN_NAME.toLowerCase() ||
      normalizedHeader === LAST_UPDATE_COLUMN_NAME.toLowerCase()
    ) {
      cell.classList.add("records-table__date-column");
    }

    if (normalizedHeader === DATE_COLUMN_NAME.toLowerCase()) {
      const sortButton = document.createElement("button");
      sortButton.type = "button";
      sortButton.className = "records-table__sort";
      sortButton.setAttribute("aria-label", `Sort by date ${dateSortDirection === "desc" ? "descending" : "ascending"}`);
      sortButton.dataset.direction = dateSortDirection;

      const label = document.createElement("span");
      label.textContent = header.trim() || "Unnamed Column";

      const icon = document.createElement("span");
      icon.className = "records-table__sort-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = dateSortDirection === "desc" ? "▼" : "▲";

      sortButton.append(label, icon);
      sortButton.addEventListener("click", () => {
        dateSortDirection = dateSortDirection === "desc" ? "asc" : "desc";
        refreshTable();
      });

      cell.appendChild(sortButton);
    } else {
      cell.textContent = header.trim() || "Unnamed Column";
    }

    headerRow.appendChild(cell);
  });

  recordsHead.replaceChildren(headerRow);
  recordsBody.replaceChildren();

  rows.forEach((rowData) => {
    const row = document.createElement("tr");
    const statusValue =
      statusColumnIndex >= 0 ? (rowData[statusColumnIndex] ?? "").trim() : "";
    const statusClass =
      STATUS_CLASS_MAP[statusValue.toLowerCase()] ?? "status-default";

    row.classList.add("records-table__row", statusClass);

    visibleColumnIndices.forEach(({ header, index: columnIndex }) => {
      const cell = document.createElement("td");
      const normalizedHeader = header.trim().toLowerCase();
      const cellValue =
        normalizedHeader === REPORTED_BY_COLUMN_NAME.toLowerCase()
          ? formatReportedByValue(rowData[columnIndex] ?? "")
          : rowData[columnIndex] ?? "";

      if (normalizedHeader === JIRA_TICKET_COLUMN_NAME.toLowerCase()) {
        const jiraUrl = getJiraTicketUrl(cellValue);

        if (jiraUrl) {
          const link = document.createElement("a");
          link.className = "records-table__jira-link";
          link.href = jiraUrl;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.setAttribute("aria-label", "Open Jira ticket in a new tab");
          link.title = "Open Jira ticket";
          link.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M10.59 13.41a1 1 0 0 1 0-1.41l4.17-4.17H12a1 1 0 1 1 0-2h5.17A1.83 1.83 0 0 1 19 7.66v5.17a1 1 0 1 1-2 0V10l-4.17 4.17a1 1 0 0 1-1.41 0Z"></path>
              <path d="M6 7a2 2 0 0 1 2-2h2a1 1 0 1 1 0 2H8v9h9v-2a1 1 0 1 1 2 0v2a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7Z"></path>
            </svg>
          `;
          cell.classList.add("records-table__jira-cell");
          cell.appendChild(link);
        } else {
          cell.textContent = "";
        }
      } else {
        cell.textContent = cellValue;
      }

      if (
        normalizedHeader === DATE_COLUMN_NAME.toLowerCase() ||
        normalizedHeader === LAST_UPDATE_COLUMN_NAME.toLowerCase()
      ) {
        cell.classList.add("records-table__date-column");
      }

      if (normalizedHeader === STATUS_COLUMN_NAME.toLowerCase()) {
        cell.classList.add("records-table__status-cell");
      }

      row.appendChild(cell);
    });

    recordsBody.appendChild(row);
  });
}

async function loadCsvTable() {
  try {
    const csvFiles = await discoverCsvFiles();
    const results = await Promise.allSettled(
      csvFiles.map((fileUrl) => loadCsvFile(fileUrl))
    );
    const successfulDatasets = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value)
      .filter((dataset) => dataset.headers.length > 0);

    if (successfulDatasets.length === 0) {
      updateRecordCount([]);
      renderMessage("No CSV data could be loaded from the data folder.");
      return;
    }
    const { headers, rows } = mergeDatasets(successfulDatasets);

    if (rows.length === 0) {
      updateRecordCount([]);
      renderMessage("CSV files were found, but they do not contain data rows.", headers.length);
      return;
    }

    setSubtitle(successfulDatasets.length);
    tableHeaders = headers;
    allRows = rows;

    initializeVisibleColumns(headers);
    renderColumnsMenu(headers);
    populateDateRangeFilter(headers, rows);
    refreshTable();
  } catch (error) {
    updateRecordCount([]);
    renderMessage(`Unable to load CSV data: ${error.message}`, 1, true);
  }
}

startDateFilter.addEventListener("change", handleDateRangeFilterChange);
endDateFilter.addEventListener("change", handleDateRangeFilterChange);
statusFilter.addEventListener("change", refreshTable);
startDateFilter.addEventListener("click", openDatePicker);
startDateFilter.addEventListener("focus", openDatePicker);
endDateFilter.addEventListener("click", openDatePicker);
endDateFilter.addEventListener("focus", openDatePicker);
columnsToggle.addEventListener("click", toggleColumnsMenu);
columnsSelectAll.addEventListener("click", showAllColumns);
columnsReset.addEventListener("click", resetVisibleColumns);

document.addEventListener("click", (event) => {
  if (!columnsControl.contains(event.target)) {
    closeColumnsMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeColumnsMenu();
  }
});

window.addEventListener("resize", syncTopicCardHeights);

loadCsvTable();

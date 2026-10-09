// Records table helpers and rendering.

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

function renderTable(headers, rows) {
  const headerRow = document.createElement("tr");
  const visibleColumnIndices = getVisibleColumnIndices(headers);
  const statusColumnIndex = headers.findIndex(
    (header) => header.trim().toLowerCase() === STATUS_COLUMN_NAME.toLowerCase()
  );
  const tier2StateColumnIndex = getTier2StateColumnIndex(headers);

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
    const statusValue = getEffectiveRawStatus(rowData, statusColumnIndex, tier2StateColumnIndex);
    const normalizedStatusValue = normalizeStatusForCharts(statusValue);
    const statusClass =
      STATUS_CLASS_MAP[statusValue.toLowerCase()] ??
      STATUS_CLASS_MAP[normalizedStatusValue.toLowerCase()] ??
      "status-default";

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

// Status, module, coverage, owner and search filters.

let selectedStatuses = new Set();

let statusFilterDisabled = false;

function syncStatusFilterAllCheckbox() {
  statusFilterAllCheckbox.checked = selectedStatuses.size === 0;
}

function updateStatusFilterToggleLabel() {
  if (selectedStatuses.size === 0) {
    statusFilterToggleLabel.textContent = "All";
  } else if (selectedStatuses.size === 1) {
    statusFilterToggleLabel.textContent = [...selectedStatuses][0];
  } else {
    statusFilterToggleLabel.textContent = `${selectedStatuses.size} selected`;
  }
}

function closeStatusFilterMenu() {
  statusFilterMenu.hidden = true;
  statusFilterToggle.setAttribute("aria-expanded", "false");
}

function populateStatusFilter(rows, headers) {
  const statusColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey(STATUS_COLUMN_NAME)
  );
  const tier2StateColumnIndex = getTier2StateColumnIndex(headers);

  statusFilterOptionsContainer.replaceChildren();

  if (statusColumnIndex < 0 && tier2StateColumnIndex < 0) {
    statusFilterDisabled = true;
    statusFilterToggle.disabled = true;
    selectedStatuses.clear();
    syncStatusFilterAllCheckbox();
    updateStatusFilterToggleLabel();
    return;
  }

  statusFilterDisabled = false;
  statusFilterToggle.disabled = false;

  const statuses = [...new Set(
    rows.map((row) =>
      normalizeStatusForCharts(
        getEffectiveRawStatus(row, statusColumnIndex, tier2StateColumnIndex)
      )
    )
  )]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  const availableStatuses = new Set(statuses);
  [...selectedStatuses].forEach((status) => {
    if (!availableStatuses.has(status)) {
      selectedStatuses.delete(status);
    }
  });

  statuses.forEach((status) => {
    const label = document.createElement("label");
    label.className = "status-multiselect__option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = status;
    checkbox.checked = selectedStatuses.has(status);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedStatuses.add(status);
      } else {
        selectedStatuses.delete(status);
      }
      syncStatusFilterAllCheckbox();
      updateStatusFilterToggleLabel();
      refreshTable();
    });

    const text = document.createElement("span");
    text.textContent = status;

    label.append(checkbox, text);
    statusFilterOptionsContainer.appendChild(label);
  });

  syncStatusFilterAllCheckbox();
  updateStatusFilterToggleLabel();
}

// Each toggle, when on, accepts issues that have that column filled in
// (independent of what value it holds). Active toggles combine with OR —
// e.g. with both on, an issue passes if EITHER column has data, not only
// when both do. With both off, the OR is vacuous and nothing passes.
function getCoverageFilteredRows(rows, headers) {
  const requireStatus = statusCoverageToggle.checked;
  const requireTier2State = tier2CoverageToggle.checked;

  const statusColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey(STATUS_COLUMN_NAME)
  );
  const tier2StateColumnIndex = getTier2StateColumnIndex(headers);

  return rows.filter((row) => {
    const hasStatus = statusColumnIndex >= 0 && Boolean((row[statusColumnIndex] ?? "").trim());
    const hasTier2State = tier2StateColumnIndex >= 0 && Boolean((row[tier2StateColumnIndex] ?? "").trim());

    return (requireStatus && hasStatus) || (requireTier2State && hasTier2State);
  });
}

// Each toggle, when on, accepts issues where that person's marker ("E:" for
// Engel, "O:" for Odana) appears in Tier 2 Comments. Combines with OR, so
// an "E+O" issue matches when EITHER toggle is on. With both off, the OR
// is vacuous and nothing passes — same convention as Tracking Data.
function getTier2OwnerFilteredRows(rows, headers) {
  const includeEngel = engelOwnerToggle.checked;
  const includeOdana = odanaOwnerToggle.checked;
  const includeDiana = dianaOwnerToggle.checked;

  const { tier2CommentsColumnIndex, devTeamCommentsColumnIndex } = getTier2OwnerColumnIndices(headers);

  return rows.filter((row) => {
    const { hasEngel, hasOdana, hasDiana } = getTier2OwnerMarkers(
      row,
      tier2CommentsColumnIndex,
      devTeamCommentsColumnIndex
    );

    return (
      (includeEngel && hasEngel) ||
      (includeOdana && hasOdana) ||
      (includeDiana && hasDiana)
    );
  });
}

// Exact (case-insensitive) substring match against ISSUE_SEARCH_COLUMN_NAMES
// — no fuzzy matching or tokenization. A row matches if the term appears in
// ANY of those columns.
function getIssueSearchFilteredRows(rows, headers) {
  const searchTerm = issueSearchFilter.value.trim().toLowerCase();

  if (!searchTerm) {
    return rows;
  }

  const searchColumnIndices = ISSUE_SEARCH_COLUMN_NAMES.map((columnName) =>
    headers.findIndex(
      (header) => normalizeColumnKey(header) === normalizeColumnKey(columnName)
    )
  ).filter((columnIndex) => columnIndex >= 0);

  if (searchColumnIndices.length === 0) {
    return rows;
  }

  return rows.filter((row) =>
    searchColumnIndices.some((columnIndex) =>
      (row[columnIndex] ?? "").toLowerCase().includes(searchTerm)
    )
  );
}

function getStatusFilteredRows(rows, headers) {
  if (statusFilterDisabled || selectedStatuses.size === 0) {
    return rows;
  }

  const statusColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey(STATUS_COLUMN_NAME)
  );
  const tier2StateColumnIndex = getTier2StateColumnIndex(headers);

  if (statusColumnIndex < 0 && tier2StateColumnIndex < 0) {
    return rows;
  }

  return rows.filter((row) =>
    selectedStatuses.has(
      normalizeStatusForCharts(
        getEffectiveRawStatus(row, statusColumnIndex, tier2StateColumnIndex)
      )
    )
  );
}

let selectedModules = new Set();

let moduleFilterDisabled = false;

function syncModuleFilterAllCheckbox() {
  moduleFilterAllCheckbox.checked = selectedModules.size === 0;
}

function updateModuleFilterToggleLabel() {
  if (selectedModules.size === 0) {
    moduleFilterToggleLabel.textContent = "All";
  } else if (selectedModules.size === 1) {
    moduleFilterToggleLabel.textContent = [...selectedModules][0];
  } else {
    moduleFilterToggleLabel.textContent = `${selectedModules.size} selected`;
  }
}

function closeModuleFilterMenu() {
  moduleFilterMenu.hidden = true;
  moduleFilterToggle.setAttribute("aria-expanded", "false");
}

// Options are derived live from whatever Module/Section values exist in the
// currently loaded data, so new module names showing up in future CSV
// exports appear here automatically — no code changes needed.
function populateModuleFilter(rows, headers) {
  const moduleColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey(MODULE_COLUMN_NAME)
  );

  moduleFilterOptionsContainer.replaceChildren();

  if (moduleColumnIndex < 0) {
    moduleFilterDisabled = true;
    moduleFilterToggle.disabled = true;
    selectedModules.clear();
    syncModuleFilterAllCheckbox();
    updateModuleFilterToggleLabel();
    return;
  }

  moduleFilterDisabled = false;
  moduleFilterToggle.disabled = false;

  const modules = [...new Set(
    rows.map((row) => (row[moduleColumnIndex] ?? "").trim())
  )]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  const availableModules = new Set(modules);
  [...selectedModules].forEach((moduleName) => {
    if (!availableModules.has(moduleName)) {
      selectedModules.delete(moduleName);
    }
  });

  modules.forEach((moduleName) => {
    const label = document.createElement("label");
    label.className = "status-multiselect__option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = moduleName;
    checkbox.checked = selectedModules.has(moduleName);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedModules.add(moduleName);
      } else {
        selectedModules.delete(moduleName);
      }
      syncModuleFilterAllCheckbox();
      updateModuleFilterToggleLabel();
      refreshTable();
    });

    const text = document.createElement("span");
    text.textContent = moduleName;

    label.append(checkbox, text);
    moduleFilterOptionsContainer.appendChild(label);
  });

  syncModuleFilterAllCheckbox();
  updateModuleFilterToggleLabel();
}

function getModuleFilteredRows(rows, headers) {
  if (moduleFilterDisabled || selectedModules.size === 0) {
    return rows;
  }

  const moduleColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey(MODULE_COLUMN_NAME)
  );

  if (moduleColumnIndex < 0) {
    return rows;
  }

  return rows.filter((row) => selectedModules.has((row[moduleColumnIndex] ?? "").trim()));
}

function getTableFilteredRows(rows, headers) {
  return sortRowsByDate(rows, headers, dateSortDirection);
}

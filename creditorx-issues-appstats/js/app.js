// Entry point: refreshTable, initial load and event wiring.

function refreshTable() {
  const rangeFilteredRows = getRangeFilteredRows();
  const coverageFilteredRows = getCoverageFilteredRows(rangeFilteredRows, tableHeaders);
  const ownerFilteredRows = getTier2OwnerFilteredRows(coverageFilteredRows, tableHeaders);
  const searchFilteredRows = getIssueSearchFilteredRows(ownerFilteredRows, tableHeaders);
  populateStatusFilter(searchFilteredRows, tableHeaders);

  const statusFilteredRows = getStatusFilteredRows(searchFilteredRows, tableHeaders);
  populateModuleFilter(statusFilteredRows, tableHeaders);

  const timelineRows = getModuleFilteredRows(statusFilteredRows, tableHeaders);
  const baseFilteredRows = getTimelineDayFilteredRows(timelineRows, tableHeaders);
  renderStatusSummary(baseFilteredRows, tableHeaders);
  renderStatusPie(baseFilteredRows, tableHeaders);
  renderPlatformDistribution(baseFilteredRows, tableHeaders);
  renderTier2OwnerDistribution(baseFilteredRows, tableHeaders);
  renderTimeline(timelineRows, tableHeaders);
  renderTimelineDayChip();
  renderTopicInsights(baseFilteredRows, tableHeaders);
  renderReportedByDistribution(baseFilteredRows, tableHeaders);

  const filteredRows = getTableFilteredRows(baseFilteredRows, tableHeaders);
  const visibleColumnCount = Math.max(getVisibleColumnIndices(tableHeaders).length, 1);
  updateRecordCount(filteredRows);

  if (filteredRows.length === 0) {
    renderMessage("No records found for the selected filters.", visibleColumnCount);
    return;
  }

  renderTable(tableHeaders, filteredRows);
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
    const { headers, rows } = mergeDatasets(successfulDatasets, {
      latestOnly: false,
    });
    const issueThemeDatasets = getDatasetsThroughToday(successfulDatasets);
    const issueThemeDataset = mergeDatasets(issueThemeDatasets, {
      latestOnly: false,
    });

    if (rows.length === 0) {
      updateRecordCount([]);
      renderMessage("CSV files were found, but they do not contain data rows.", headers.length);
      return;
    }

    setSubtitle(successfulDatasets.length);
    tableHeaders = headers;
    allRows = rows;
    issueThemeHeaders = issueThemeDataset.headers;
    issueThemeRows = issueThemeDataset.rows;
    issueThemeSourceCount = issueThemeDatasets.length;
    issueThemeThroughDateLabel = formatCompactDate(getEndOfToday());

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

statusCoverageToggle.addEventListener("change", refreshTable);

tier2CoverageToggle.addEventListener("change", refreshTable);

engelOwnerToggle.addEventListener("change", refreshTable);

odanaOwnerToggle.addEventListener("change", refreshTable);

dianaOwnerToggle.addEventListener("change", refreshTable);

let issueSearchDebounceTimer = null;

issueSearchFilter.addEventListener("input", () => {
  clearTimeout(issueSearchDebounceTimer);
  issueSearchDebounceTimer = setTimeout(refreshTable, 250);
});

statusFilterToggle.addEventListener("click", () => {
  if (statusFilterToggle.disabled) {
    return;
  }

  const isOpen = !statusFilterMenu.hidden;
  statusFilterMenu.hidden = isOpen;
  statusFilterToggle.setAttribute("aria-expanded", String(!isOpen));
});

document.addEventListener("click", (event) => {
  if (!statusFilterMenu.hidden && !event.target.closest("#status-multiselect")) {
    closeStatusFilterMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !statusFilterMenu.hidden) {
    closeStatusFilterMenu();
  }
});

statusFilterAllCheckbox.addEventListener("change", () => {
  if (!statusFilterAllCheckbox.checked) {
    statusFilterAllCheckbox.checked = true;
    return;
  }

  selectedStatuses.clear();
  statusFilterOptionsContainer
    .querySelectorAll("input[type=checkbox]")
    .forEach((checkbox) => {
      checkbox.checked = false;
    });
  updateStatusFilterToggleLabel();
  refreshTable();
});

moduleFilterToggle.addEventListener("click", () => {
  if (moduleFilterToggle.disabled) {
    return;
  }

  const isOpen = !moduleFilterMenu.hidden;
  moduleFilterMenu.hidden = isOpen;
  moduleFilterToggle.setAttribute("aria-expanded", String(!isOpen));
});

document.addEventListener("click", (event) => {
  if (!moduleFilterMenu.hidden && !event.target.closest("#module-multiselect")) {
    closeModuleFilterMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !moduleFilterMenu.hidden) {
    closeModuleFilterMenu();
  }
});

moduleFilterAllCheckbox.addEventListener("change", () => {
  if (!moduleFilterAllCheckbox.checked) {
    moduleFilterAllCheckbox.checked = true;
    return;
  }

  selectedModules.clear();
  moduleFilterOptionsContainer
    .querySelectorAll("input[type=checkbox]")
    .forEach((checkbox) => {
      checkbox.checked = false;
    });
  updateModuleFilterToggleLabel();
  refreshTable();
});

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

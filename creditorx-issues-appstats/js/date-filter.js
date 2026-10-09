// Date range filter.

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

  const defaultRange = getDefaultDateRange();

  [startDateFilter, endDateFilter].forEach((filter) => {
    filter.min = availableRange.min;
    filter.max = defaultRange.end;
    filter.disabled = false;
  });

  startDateFilter.value = defaultRange.start;
  endDateFilter.value = defaultRange.end;
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

function handleDateRangeFilterChange() {
  const startDate = parseIsoDate(startDateFilter.value);
  const endDate = parseIsoDate(endDateFilter.value);

  if (startDate && endDate && endDate < startDate) {
    startDateFilter.value = toIsoDate(endDate);
    endDateFilter.value = toIsoDate(startDate);
  }

  pruneTimelineDaysToRange();
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

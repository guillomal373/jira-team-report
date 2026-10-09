// Click-a-day filter driven by the timeline chart.

function getTimelineDayFilteredRows(rows, headers) {
  if (selectedTimelineDays.size === 0) {
    return rows;
  }

  const dateColumnIndex = getDateColumnIndex(headers);

  if (dateColumnIndex < 0) {
    return rows;
  }

  return rows.filter((row) => {
    const parsedDate = parseIsoDate(row[dateColumnIndex] ?? "");
    return parsedDate && selectedTimelineDays.has(toIsoDate(parsedDate));
  });
}

function toggleTimelineDay(isoDate, additive) {
  if (additive) {
    if (selectedTimelineDays.has(isoDate)) {
      selectedTimelineDays.delete(isoDate);
    } else {
      selectedTimelineDays.add(isoDate);
    }
  } else if (selectedTimelineDays.size === 1 && selectedTimelineDays.has(isoDate)) {
    selectedTimelineDays.clear();
  } else {
    selectedTimelineDays = new Set([isoDate]);
  }

  refreshTable();
}

function clearTimelineDays() {
  selectedTimelineDays.clear();
  refreshTable();
}

function pruneTimelineDaysToRange() {
  const selectedRange = getSelectedDateRange();

  if (!selectedRange) {
    return;
  }

  selectedTimelineDays.forEach((isoDate) => {
    const day = parseIsoDate(isoDate);

    if (!day || day < selectedRange.startDate || day > selectedRange.endDate) {
      selectedTimelineDays.delete(isoDate);
    }
  });
}

function renderTimelineDayChip() {
  timelineDayFilter.replaceChildren();
  timelineDayFilter.hidden = selectedTimelineDays.size === 0;

  if (selectedTimelineDays.size === 0) {
    return;
  }

  const labels = [...selectedTimelineDays]
    .sort()
    .map((isoDate) => {
      const day = parseIsoDate(isoDate);
      return day ? formatCompactDate(day) : isoDate;
    });
  const label = document.createElement("span");
  label.textContent = `${labels.length === 1 ? "Day" : "Days"}: ${labels.join(", ")}`;

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "timeline-day-chip__clear";
  clearButton.setAttribute("aria-label", "Clear day filter");
  clearButton.textContent = "\u2715";
  clearButton.addEventListener("click", clearTimelineDays);

  timelineDayFilter.append(label, clearButton);
}

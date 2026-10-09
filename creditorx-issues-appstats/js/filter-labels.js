// Human-readable descriptions of the active filters.

function describeDateRangeSelection() {
  const selectedRange = getSelectedDateRange();

  if (!selectedRange) {
    return "the selected range";
  }

  const rangeLabel = `${formatCompactDate(selectedRange.startDate)} to ${formatCompactDate(selectedRange.endDate)}`;

  if (selectedTimelineDays.size === 0) {
    return rangeLabel;
  }

  const dayLabels = [...selectedTimelineDays]
    .sort()
    .map((isoDate) => {
      const day = parseIsoDate(isoDate);
      return day ? formatCompactDate(day) : isoDate;
    });

  return `${rangeLabel} (${dayLabels.join(", ")})`;
}

function describeActiveFilterSelection() {
  const dateRangeLabel = describeDateRangeSelection();
  const parts = [dateRangeLabel];

  if (!statusFilterDisabled && selectedStatuses.size > 0) {
    const statusLabel = [...selectedStatuses].sort((left, right) => left.localeCompare(right)).join(", ");
    parts.push(`with status ${statusLabel}`);
  }

  if (!moduleFilterDisabled && selectedModules.size > 0) {
    const moduleLabel = [...selectedModules].sort((left, right) => left.localeCompare(right)).join(", ");
    parts.push(`module ${moduleLabel}`);
  }

  const requiredColumns = [
    statusCoverageToggle.checked ? "Status" : null,
    tier2CoverageToggle.checked ? "Tier 2 Status" : null,
  ].filter(Boolean);

  if (requiredColumns.length > 0) {
    parts.push(`${requiredColumns.join(" or ")} filled`);
  }

  const owners = [
    engelOwnerToggle.checked ? "Engel" : null,
    odanaOwnerToggle.checked ? "Odana" : null,
    dianaOwnerToggle.checked ? "Diana" : null,
  ].filter(Boolean);

  if (owners.length > 0 && owners.length < 3) {
    parts.push(`answered by ${owners.join(" or ")}`);
  }

  const searchTerm = issueSearchFilter.value.trim();
  if (searchTerm) {
    parts.push(`matching "${searchTerm}"`);
  }

  return parts.join(", ");
}

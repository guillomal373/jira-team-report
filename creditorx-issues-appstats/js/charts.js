// SVG helpers and the pie, platform, owner and reporter charts.

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
    if (percentage < 0.02) {
      // Thin slices would be swallowed by the 2px dark separator stroke.
      slice.style.strokeWidth = "0";
    }
    const showTip = (event) =>
      renderTimelineTooltip(
        {
          title: `${status}: ${(percentage * 100).toFixed(1)}%`,
          totalText: `${total} ticket${total === 1 ? "" : "s"} total`,
          segments: entries.map(([name, count]) => ({ status: name, value: count })),
          activeStatus: status,
        },
        event.clientX,
        event.clientY,
      );
    slice.addEventListener("mouseenter", showTip);
    slice.addEventListener("mousemove", showTip);
    slice.addEventListener("mouseleave", hideTimelineTooltip);
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

const CARRIER_VISIBLE_COUNT = 6;

function renderCarrierDistribution(rows, headers) {
  carrierList.replaceChildren();

  const { carriers, notReported } = getCarrierPlatformCounts(rows, headers);
  const reportedTotal = carriers.reduce((sum, entry) => sum + entry.total, 0);

  carrierSubtitle.textContent = `Carrier by platform for ${describeDateRangeSelection()}. ${notReported.toLocaleString("en-US")} issue${notReported === 1 ? "" : "s"} with no carrier reported are not counted.`;

  if (reportedTotal === 0) {
    const empty = document.createElement("p");
    empty.className = "platform-card__empty";
    empty.textContent = "No carrier data for the selected range.";
    carrierList.appendChild(empty);
    return;
  }

  // "Other" always goes last, whatever its size.
  const named = carriers
    .filter((entry) => entry.label !== "Other")
    .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label));
  const visible = named.slice(0, CARRIER_VISIBLE_COUNT);
  const other = {
    label: "Other",
    Android: 0,
    iOS: 0,
    Unknown: 0,
    total: 0,
  };

  [...named.slice(CARRIER_VISIBLE_COUNT), ...carriers.filter((entry) => entry.label === "Other")].forEach(
    (entry) => {
      other.Android += entry.Android;
      other.iOS += entry.iOS;
      other.Unknown += entry.Unknown;
      other.total += entry.total;
    }
  );

  const entries = other.total > 0 ? [...visible, other] : visible;
  const maxTotal = Math.max(...entries.map((entry) => entry.total));

  entries.forEach((entry) => {
    const percentage = (entry.total / reportedTotal) * 100;
    const item = document.createElement("div");
    item.className = "carrier-row";
    item.title = `${entry.label}: ${entry.total.toLocaleString("en-US")} issues (${percentage.toFixed(1)}% of issues with a carrier)\nAndroid: ${entry.Android} · iOS: ${entry.iOS}${entry.Unknown > 0 ? ` · Unknown platform: ${entry.Unknown}` : ""}`;

    const name = document.createElement("span");
    name.className = "platform-card__label";
    name.textContent = entry.label;

    const track = document.createElement("div");
    track.className = "carrier-row__track";

    const bar = document.createElement("div");
    bar.className = "carrier-row__bar";
    bar.style.width = `${(entry.total / maxTotal) * 100}%`;

    ["Android", "iOS", "Unknown"].forEach((platform) => {
      if (entry[platform] === 0) {
        return;
      }

      const segment = document.createElement("span");
      segment.className = "platform-card__bar-segment";
      segment.style.setProperty("--platform-color", PLATFORM_COLOR_MAP[platform]);
      segment.style.width = `${(entry[platform] / entry.total) * 100}%`;
      bar.appendChild(segment);
    });

    track.appendChild(bar);

    const count = document.createElement("span");
    count.className = "platform-card__count carrier-row__count";
    count.textContent = `${entry.total.toLocaleString("en-US")} issues`;

    const percent = document.createElement("strong");
    percent.className = "platform-card__percent";
    percent.textContent = `${percentage.toFixed(1)}%`;

    item.append(name, track, count, percent);
    carrierList.appendChild(item);
  });
}

function renderTier2OwnerDistribution(rows, headers) {
  tier2OwnerBar.replaceChildren();
  tier2OwnerList.replaceChildren();

  const counts = getTier2OwnerCounts(rows, headers);
  const total = rows.length;
  const knownOwners = ["Diana", "Engel", "Odana", "E+O", "E+D", "O+D", "E+O+D"];
  const knownTotal = knownOwners.reduce(
    (sum, owner) => sum + (counts.get(owner) ?? 0),
    0
  );
  const noMatchCount = counts.get("No match") ?? 0;

  tier2OwnerSubtitle.textContent = `Who answered each issue for ${describeDateRangeSelection()}, from Tier 2 Comments and Dev Team Comments. Issues with no "O:"/"E:"/"D-" marker are listed separately.`;

  if (total === 0) {
    const empty = document.createElement("p");
    empty.className = "platform-card__empty";
    empty.textContent = "No records available for the selected range.";
    tier2OwnerList.appendChild(empty);
    return;
  }

  knownOwners
    .filter((owner) => (counts.get(owner) ?? 0) > 0)
    .forEach((owner) => {
      const value = counts.get(owner) ?? 0;
      const percentage = knownTotal === 0 ? 0 : (value / knownTotal) * 100;
      const segment = document.createElement("span");
      segment.className = "platform-card__bar-segment";
      segment.style.setProperty("--platform-color", TIER_2_OWNER_COLOR_MAP[owner]);
      segment.style.width = `${percentage}%`;
      segment.title = `${owner}: ${value.toLocaleString("en-US")} issue${value === 1 ? "" : "s"} (${percentage.toFixed(1)}% of matched records)`;
      tier2OwnerBar.appendChild(segment);
    });

  if (knownTotal === 0) {
    const emptyBar = document.createElement("span");
    emptyBar.className = "platform-card__bar-empty";
    emptyBar.textContent = "No Tier 2 owner data";
    tier2OwnerBar.appendChild(emptyBar);
  }

  [
    ...knownOwners.map((owner) => ({
      label: owner,
      value: counts.get(owner) ?? 0,
      percentage: knownTotal === 0 ? 0 : ((counts.get(owner) ?? 0) / knownTotal) * 100,
      denominatorLabel: "matched",
    })),
    {
      label: "No match",
      value: noMatchCount,
      percentage: total === 0 ? 0 : (noMatchCount / total) * 100,
      denominatorLabel: "all",
    },
  ]
    .filter(({ value }) => value > 0)
    .forEach(({ label, value, percentage, denominatorLabel }) => {
    const item = document.createElement("div");
    item.className = "platform-card__item";
    item.title = `${label}: ${value.toLocaleString("en-US")} issue${value === 1 ? "" : "s"} (${percentage.toFixed(1)}% of ${denominatorLabel} records)`;

    const swatch = document.createElement("span");
    swatch.className = "platform-card__swatch";
    swatch.style.setProperty("--platform-color", TIER_2_OWNER_COLOR_MAP[label]);

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
    tier2OwnerList.appendChild(item);
  });
}

function renderReportedByDistribution(rows, headers) {
  reportedChart.replaceChildren();

  const entries = getReportedByEntries(rows, headers);
  const total = rows.length;
  const maxCount = Math.max(1, ...entries.map((entry) => entry.count));

  reportedSubtitle.textContent = `Issue volume by reporter for ${describeActiveFilterSelection()}.`;
  reportedTotal.textContent = `${entries.length.toLocaleString("en-US")} Reporter${entries.length === 1 ? "" : "s"}`;
  reportedChart.setAttribute(
    "aria-label",
    `Issue volume by reporter for ${describeActiveFilterSelection()}`
  );

  if (total === 0 || entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "reported-panel__empty";
    empty.textContent = "No reporter data available for the selected filters.";
    reportedChart.appendChild(empty);
    return;
  }

  entries.forEach((entry, index) => {
    const percentage = (entry.count / total) * 100;
    const statusBreakdown = entry.statusEntries
      .map(([status, count]) => `${status}: ${count}`)
      .join("\n");
    const item = document.createElement("div");
    item.className = "reported-bar";
    item.title = `${entry.fullLabel}: ${entry.count.toLocaleString("en-US")} issue${entry.count === 1 ? "" : "s"} (${percentage.toFixed(1)}%)\n${statusBreakdown}`;

    const value = document.createElement("span");
    value.className = "reported-bar__value";
    value.textContent = entry.count.toLocaleString("en-US");

    const track = document.createElement("div");
    track.className = "reported-bar__track";

    const fill = document.createElement("span");
    fill.className = "reported-bar__fill";
    fill.style.height = `${Math.max(8, (entry.count / maxCount) * 100)}%`;
    fill.style.setProperty("--reported-rank", String(index + 1));

    entry.statusEntries.forEach(([status, count]) => {
      const segment = document.createElement("span");
      segment.className = "reported-bar__segment";
      segment.style.height = `${(count / entry.count) * 100}%`;
      segment.style.background = getStatusGradient(status);
      segment.title = `${status}: ${count} issue${count === 1 ? "" : "s"}`;
      fill.appendChild(segment);
    });

    const label = document.createElement("span");
    label.className = "reported-bar__label";
    label.textContent = entry.displayLabel;

    track.appendChild(fill);
    item.append(value, track, label);
    reportedChart.appendChild(item);
  });
}

// Weekly theme trend: stacked bars of the top issue themes per week.

const THEME_TREND_TOP_COUNT = 5;

const THEME_TREND_OTHER_LABEL = "All other themes";

const THEME_TREND_COLORS = ["#cdaa56", "#1aa8ee", "#11a86a", "#b06fe0", "#e08f3f"];

const THEME_TREND_OTHER_COLOR = "#696969";

function getWeekStart(date) {
  const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - daysSinceMonday);
  return weekStart;
}

function getThemeTrendData(rows, headers) {
  const indexOfColumn = (name) =>
    headers.findIndex((header) => normalizeColumnKey(header) === normalizeColumnKey(name));
  const issueColumnIndex = indexOfColumn("Reported Issue");
  const dateColumnIndex = indexOfColumn(DATE_COLUMN_NAME);
  const devTeamCommentsColumnIndex = indexOfColumn(DEV_TEAM_COMMENTS_COLUMN_NAME);
  const tier2CommentsColumnIndex = indexOfColumn(TIER_2_COMMENTS_COLUMN_NAME);
  const { startDate, endDate } = buildTimelineRange();
  const themeTotals = new Map();
  const weekCounts = new Map();
  let issueCount = 0;

  if (issueColumnIndex >= 0 && dateColumnIndex >= 0) {
    rows.forEach((row) => {
      const issueText = row[issueColumnIndex] ?? "";
      const parsedDate = parseIsoDate(row[dateColumnIndex] ?? "");

      if (
        !normalizeIssueText(issueText) ||
        !parsedDate ||
        parsedDate < startDate ||
        parsedDate > endDate
      ) {
        return;
      }

      // Same classification text as the Top Issue Themes panel.
      const classificationText = [
        issueText,
        tier2CommentsColumnIndex >= 0 ? (row[tier2CommentsColumnIndex] ?? "").trim() : "",
        devTeamCommentsColumnIndex >= 0 ? (row[devTeamCommentsColumnIndex] ?? "").trim() : "",
      ]
        .filter(Boolean)
        .join(" ");
      const { theme } = getIssueTheme(classificationText);
      const weekKey = toIsoDate(getWeekStart(parsedDate));
      const counts = weekCounts.get(weekKey) ?? new Map();

      counts.set(theme.label, (counts.get(theme.label) ?? 0) + 1);
      weekCounts.set(weekKey, counts);
      themeTotals.set(theme.label, (themeTotals.get(theme.label) ?? 0) + 1);
      issueCount += 1;
    });
  }

  // The fallback theme never takes a top slot; it belongs in "other".
  const topThemes = [...themeTotals.entries()]
    .filter(([label]) => label !== FALLBACK_ISSUE_THEME.label)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, THEME_TREND_TOP_COUNT)
    .map(([label], index) => ({ label, color: THEME_TREND_COLORS[index] }));
  const topLabels = new Set(topThemes.map((theme) => theme.label));
  const layers = [
    ...topThemes,
    { label: THEME_TREND_OTHER_LABEL, color: THEME_TREND_OTHER_COLOR },
  ];

  const weeks = [];
  const lastWeekStart = getWeekStart(endDate);

  for (
    const weekStart = getWeekStart(startDate);
    weekStart <= lastWeekStart;
    weekStart.setDate(weekStart.getDate() + 7)
  ) {
    const counts = weekCounts.get(toIsoDate(weekStart)) ?? new Map();
    const segments = layers
      .map((layer) => {
        let value = 0;

        counts.forEach((count, label) => {
          const isOther = !topLabels.has(label);

          if (layer.label === THEME_TREND_OTHER_LABEL ? isOther : label === layer.label) {
            value += count;
          }
        });

        return { label: layer.label, color: layer.color, value };
      })
      .filter(({ value }) => value > 0);

    weeks.push({
      isoDate: toIsoDate(weekStart),
      label: formatCompactDate(weekStart),
      total: segments.reduce((sum, segment) => sum + segment.value, 0),
      segments,
    });
  }

  return { weeks, layers, startDate, endDate, issueCount };
}

function renderThemeTrend(rows, headers) {
  const { weeks, layers, startDate, endDate, issueCount } = getThemeTrendData(rows, headers);

  themeTrendChart.replaceChildren();
  themeTrendLegend.replaceChildren();

  if (issueCount === 0) {
    themeTrendSubtitle.textContent = "No issues with reported text in the selected range.";
    themeTrendChart.style.height = "0px";
    return;
  }

  const isPartialWeek =
    startDate > parseIsoDate(weeks[0].isoDate) || endDate.getDay() !== 0;
  themeTrendSubtitle.textContent = `Weekly issue volume by theme from ${formatCompactDate(startDate)} to ${formatCompactDate(endDate)}. Top ${THEME_TREND_TOP_COUNT} themes; the rest are grouped.${isPartialWeek ? " First and last weeks may be partial." : ""}`;

  layers.forEach((layer) => {
    if (!weeks.some((week) => week.segments.some((segment) => segment.label === layer.label))) {
      return;
    }

    const item = document.createElement("div");
    item.className = "timeline-panel__legend-item";

    const swatch = document.createElement("span");
    swatch.className = "timeline-panel__legend-swatch";
    swatch.style.setProperty("--legend-color", layer.color);

    const label = document.createElement("span");
    label.className = "timeline-panel__legend-label";
    label.textContent = layer.label;

    item.append(swatch, label);
    themeTrendLegend.appendChild(item);
  });

  const topBand = 22;
  const width = Math.max(960, weeks.length * 90);
  const height = 340;
  const margin = { top: topBand, right: 22, bottom: 40, left: 46 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const { axisMax, tickStep, tickCount } = getTimelineScale(
    Math.max(0, ...weeks.map((week) => week.total))
  );

  themeTrendChart.setAttribute("viewBox", `0 0 ${width} ${height}`);
  themeTrendChart.style.height = `${height}px`;

  for (let tick = 0; tick <= tickCount; tick += 1) {
    const y = margin.top + innerHeight - (innerHeight * tick) / tickCount;

    themeTrendChart.appendChild(
      createSvgElement("line", {
        x1: margin.left,
        y1: y,
        x2: width - margin.right,
        y2: y,
        class: tick === 0 ? "timeline-baseline" : "timeline-grid-line",
      })
    );

    const label = createSvgElement("text", {
      x: margin.left - 10,
      y: y + 4,
      class: "timeline-axis-text timeline-axis-text--y",
    });
    label.textContent = String(tickStep * tick);
    themeTrendChart.appendChild(label);
  }

  const getY = (value) => margin.top + innerHeight - (value / axisMax) * innerHeight;
  const slotWidth = innerWidth / weeks.length;
  const barWidth = Math.max(18, Math.min(64, slotWidth * 0.6));

  weeks.forEach((week, index) => {
    const x = margin.left + index * slotWidth + (slotWidth - barWidth) / 2;
    let accumulatedValue = 0;

    week.segments.forEach((segment) => {
      const nextValue = accumulatedValue + segment.value;
      const y = getY(nextValue);
      const segmentHeight = getY(accumulatedValue) - y;
      const rect = createSvgElement("rect", {
        x,
        y,
        width: barWidth,
        height: segmentHeight,
        rx: nextValue === week.total ? 4 : 0,
        ry: nextValue === week.total ? 4 : 0,
        fill: segment.color,
        class: "timeline-bar-segment",
      });
      const title = createSvgElement("title");
      title.textContent = `Week of ${week.label} · ${segment.label}: ${segment.value} issue${segment.value === 1 ? "" : "s"} (${Math.round((segment.value / week.total) * 100)}% of the week)`;
      rect.appendChild(title);
      themeTrendChart.appendChild(rect);

      if (segmentHeight >= 18) {
        const segmentLabel = createSvgElement("text", {
          x: x + barWidth / 2,
          y: y + segmentHeight / 2 + 4,
          class: "timeline-bar-value",
          fill: getSegmentLabelColor(segment.color),
        });
        segmentLabel.textContent = String(segment.value);
        themeTrendChart.appendChild(segmentLabel);
      }

      accumulatedValue = nextValue;
    });

    if (week.total > 0) {
      const totalLabel = createSvgElement("text", {
        x: x + barWidth / 2,
        y: getY(week.total) - 8,
        class: "timeline-bar-total",
      });
      totalLabel.textContent = String(week.total);
      themeTrendChart.appendChild(totalLabel);
    }

    const weekLabel = createSvgElement("text", {
      x: x + barWidth / 2,
      y: height - 12,
      class: "timeline-axis-text timeline-axis-text--x",
    });
    weekLabel.textContent = week.label;
    themeTrendChart.appendChild(weekLabel);
  });
}

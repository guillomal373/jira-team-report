// Daily issues timeline: scale, series and SVG rendering.

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
  const tier2StateColumnIndex = getTier2StateColumnIndex(headers);
  const { startDate, endDate } = buildTimelineRange();
  const series = [];
  const counts = new Map();
  const currentDate = new Date(startDate);
  const timelineStatusCounts = new Map();

  rows.forEach((row) => {
    if (dateColumnIndex < 0 || tier2StateColumnIndex < 0) {
      return;
    }

    // The timeline only plots Tier 2 State; rows without one are skipped
    // (no fallback to the older "Status" column).
    const tier2State = (row[tier2StateColumnIndex] ?? "").trim();

    if (!tier2State) {
      return;
    }

    const parsedDate = parseIsoDate(row[dateColumnIndex] ?? "");

    if (!parsedDate || parsedDate < startDate || parsedDate > endDate) {
      return;
    }

    const isoDate = toIsoDate(parsedDate);
    const status = normalizeStatusForCharts(tier2State);
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

  const visibleEvents = TIMELINE_EVENTS.filter((event) =>
    series.some((point) => point.isoDate === event.date)
  );
  const topBand = 16;
  const eventBandHeight = visibleEvents.length > 0 ? 34 : 0;

  const width = Math.max(960, series.length * 22);
  const height = 320 + eventBandHeight;
  const margin = { top: topBand + eventBandHeight, right: 22, bottom: 40, left: 46 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const observedMaxValue = Math.max(0, ...scaleSeries.map((point) => point.total));
  const { axisMax, tickStep, tickCount } = getTimelineScale(observedMaxValue);

  timelineChart.setAttribute("viewBox", `0 0 ${width} ${height}`);
  timelineChart.style.height = `${height}px`;

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
    const isDaySelected = selectedTimelineDays.has(point.isoDate);
    const isDayDimmed = selectedTimelineDays.size > 0 && !isDaySelected;
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
        class: `timeline-bar-segment${isDayDimmed ? " timeline-bar-segment--dimmed" : ""}`,
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
        class: `timeline-bar-hitbox${isDaySelected ? " timeline-bar-hitbox--selected" : ""}`,
        tabindex: 0,
        role: "button",
        "aria-pressed": isDaySelected ? "true" : "false",
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
      hitbox.addEventListener("click", (event) => {
        toggleTimelineDay(point.isoDate, event.ctrlKey || event.metaKey || event.shiftKey);
      });
      hitbox.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleTimelineDay(point.isoDate, event.ctrlKey || event.metaKey || event.shiftKey);
        }
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

  visibleEvents.forEach((event) => {
    const index = series.findIndex((point) => point.isoDate === event.date);

    if (index < 0) {
      return;
    }

    const eventX = margin.left + index * slotWidth + slotWidth / 2;
    const dotY = topBand + eventBandHeight / 2;
    const eventDate = parseIsoDate(event.date);
    const tooltipText = `${event.label} — ${eventDate ? formatCompactDate(eventDate) : event.date}`;

    const line = createSvgElement("line", {
      x1: eventX,
      y1: dotY,
      x2: eventX,
      y2: margin.top + innerHeight,
      stroke: event.color,
      class: "timeline-event-line",
    });
    timelineChart.appendChild(line);

    const label = createSvgElement("text", {
      x: eventX,
      y: dotY - 13,
      fill: event.color,
      class: "timeline-event-label",
    });
    label.textContent = event.label;
    timelineChart.appendChild(label);

    const dot = createSvgElement("circle", {
      cx: eventX,
      cy: dotY,
      r: 9,
      fill: event.color,
      class: "timeline-event-dot",
    });
    const dotTitle = createSvgElement("title");
    dotTitle.textContent = tooltipText;
    dot.appendChild(dotTitle);
    timelineChart.appendChild(dot);

    if (event.icon === "apple") {
      const iconHeight = 12;
      const iconWidth = iconHeight * (384 / 512);
      const scale = iconHeight / 512;
      const iconGroup = createSvgElement("g", {
        transform: `translate(${eventX - iconWidth / 2}, ${dotY - iconHeight / 2}) scale(${scale})`,
        class: "timeline-event-icon",
      });
      const iconPath = createSvgElement("path", {
        d: APPLE_LOGO_PATH_D,
        fill: "#ffffff",
      });
      iconGroup.appendChild(iconPath);
      timelineChart.appendChild(iconGroup);
    } else if (event.icon === "android") {
      const iconHeight = 13;
      const scale = iconHeight / 345;
      const viewBoxCenterY = -70 + 345 / 2;
      const iconGroup = createSvgElement("g", {
        transform: `translate(${eventX}, ${dotY}) scale(${scale}) translate(0, ${-viewBoxCenterY})`,
        fill: "#ffffff",
        class: "timeline-event-icon",
      });
      const shapes = [
        createSvgElement("ellipse", { cx: 0, cy: 41, rx: 91, ry: 84 }),
        createSvgElement("rect", { x: -91, y: 20, width: 182, height: 182, rx: 22 }),
        createSvgElement("rect", {
          x: 14,
          y: -86,
          width: 13,
          height: 86,
          rx: 6.5,
          transform: "rotate(29)",
        }),
        createSvgElement("rect", {
          x: 14,
          y: -86,
          width: 13,
          height: 86,
          rx: 6.5,
          transform: "scale(-1,1) rotate(29)",
        }),
        createSvgElement("rect", { x: -143, y: 41, width: 48, height: 133, rx: 24 }),
        createSvgElement("rect", { x: 95, y: 41, width: 48, height: 133, rx: 24 }),
        createSvgElement("rect", { x: -58, y: 138, width: 48, height: 133, rx: 24 }),
        createSvgElement("rect", { x: 10, y: 138, width: 48, height: 133, rx: 24 }),
      ];
      shapes.forEach((shape) => iconGroup.appendChild(shape));
      timelineChart.appendChild(iconGroup);
    } else if (event.icon === "megaphone") {
      const iconSize = 12;
      const scale = iconSize / 512;
      const iconGroup = createSvgElement("g", {
        transform: `translate(${eventX - iconSize / 2}, ${dotY - iconSize / 2}) scale(${scale})`,
        class: "timeline-event-icon",
      });
      const iconPath = createSvgElement("path", {
        d: MEGAPHONE_PATH_D,
        fill: "#ffffff",
      });
      iconGroup.appendChild(iconPath);
      timelineChart.appendChild(iconGroup);
    } else if (event.icon === "database") {
      const iconHeight = 12;
      const iconWidth = iconHeight * (448 / 512);
      const scale = iconHeight / 512;
      const iconGroup = createSvgElement("g", {
        transform: `translate(${eventX - iconWidth / 2}, ${dotY - iconHeight / 2}) scale(${scale})`,
        class: "timeline-event-icon",
      });
      const iconPath = createSvgElement("path", {
        d: DATABASE_PATH_D,
        fill: "#ffffff",
      });
      iconGroup.appendChild(iconPath);
      timelineChart.appendChild(iconGroup);
    } else {
      const icon = createSvgElement("text", {
        x: eventX,
        y: dotY + 3.5,
        class: "timeline-event-icon",
      });
      icon.textContent = event.icon;
      timelineChart.appendChild(icon);
    }
  });
}

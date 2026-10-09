// Timeline and issue-text tooltips.

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

function getTimelineEventsForDate(isoDate) {
  return TIMELINE_EVENTS.filter((event) => event.date === isoDate);
}

function getTimelineTooltipText(point) {
  const lines = [
    `${formatDisplayDate(point.date)}: ${point.total} issue${point.total === 1 ? "" : "s"}`,
  ];

  point.segments.forEach((segment) => {
    lines.push(`${segment.status}: ${segment.value}`);
  });

  getTimelineEventsForDate(point.isoDate).forEach((event) => {
    lines.push(`Event: ${event.label}`);
  });

  return lines.join("\n");
}

function renderTimelineTooltip({ title, totalText, segments, activeStatus, events = [] }, clientX, clientY) {
  const tooltip = getTimelineTooltip();
  tooltip.replaceChildren();

  const dateLabel = document.createElement("p");
  dateLabel.className = "timeline-tooltip__date";
  dateLabel.textContent = title;

  const totalLabel = document.createElement("p");
  totalLabel.className = "timeline-tooltip__total";
  totalLabel.textContent = totalText;

  const conventionLabel = document.createElement("p");
  conventionLabel.className = "timeline-tooltip__section-label";
  conventionLabel.textContent = "Status convention";

  const list = document.createElement("div");
  list.className = "timeline-tooltip__list";

  segments.forEach((segment) => {
    const item = document.createElement("div");
    item.className = "timeline-tooltip__item";
    if (activeStatus && segment.status !== activeStatus) {
      item.style.opacity = "0.55";
    }

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

  if (events.length > 0) {
    const eventsLabel = document.createElement("p");
    eventsLabel.className = "timeline-tooltip__section-label";
    eventsLabel.textContent = events.length === 1 ? "Event" : "Events";

    const eventsList = document.createElement("div");
    eventsList.className = "timeline-tooltip__list timeline-tooltip__events";

    events.forEach((event) => {
      const item = document.createElement("div");
      item.className = "timeline-tooltip__item";

      const statusGroup = document.createElement("div");
      statusGroup.className = "timeline-tooltip__status";

      const swatch = document.createElement("span");
      swatch.className = "timeline-tooltip__swatch";
      swatch.style.setProperty("--tooltip-color", event.color || "#cdaa56");

      const label = document.createElement("span");
      label.className = "timeline-tooltip__label";
      label.textContent = event.label;

      statusGroup.append(swatch, label);
      item.appendChild(statusGroup);
      eventsList.appendChild(item);
    });

    tooltip.append(eventsLabel, eventsList);
  }

  tooltip.hidden = false;
  setTimelineTooltipPosition(clientX, clientY);
}

function showTimelineTooltip(point, clientX, clientY) {
  renderTimelineTooltip(
    {
      title: formatDisplayDate(point.date),
      totalText: `${point.total} issue${point.total === 1 ? "" : "s"} total`,
      segments: point.segments,
      events: getTimelineEventsForDate(point.isoDate),
    },
    clientX,
    clientY,
  );
}

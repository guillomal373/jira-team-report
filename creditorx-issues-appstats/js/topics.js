// Issue theme analysis and topic insights.

function normalizeIssueText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keywordMatchesIssue(normalizedText, keyword) {
  const normalizedKeyword = normalizeIssueText(keyword);

  if (!normalizedKeyword) {
    return false;
  }

  if (normalizedKeyword.includes(" ")) {
    return normalizedText.includes(normalizedKeyword);
  }

  return new RegExp(`\\b${normalizedKeyword}\\b`, "i").test(normalizedText);
}

function getIssueTheme(issueText) {
  const normalizedText = normalizeIssueText(issueText);

  if (!normalizedText) {
    return {
      theme: FALLBACK_ISSUE_THEME,
      matchedKeywords: [],
      normalizedText,
    };
  }

  let bestMatch = null;

  for (const theme of ISSUE_THEME_RULES) {
    const matchedKeywords = theme.keywords.filter((keyword) =>
      keywordMatchesIssue(normalizedText, keyword)
    );

    if (matchedKeywords.length > 0) {
      const score = matchedKeywords.reduce(
        (sum, keyword) => sum + normalizeIssueText(keyword).length,
        matchedKeywords.length * 10
      );

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          score,
          theme,
          matchedKeywords,
        };
      }
    }
  }

  if (bestMatch) {
    return {
      theme: bestMatch.theme,
      matchedKeywords: bestMatch.matchedKeywords,
      normalizedText,
    };
  }

  return {
    theme: FALLBACK_ISSUE_THEME,
    matchedKeywords: [],
    normalizedText,
  };
}

function getTopWords(textEntries, limit = 4) {
  const counts = new Map();

  textEntries.forEach((text) => {
    normalizeIssueText(text)
      .split(" ")
      .filter((word) => word.length > 3 && !THEME_STOP_WORDS.has(word))
      .forEach((word) => {
        counts.set(word, (counts.get(word) ?? 0) + 1);
      });
  });

  return [...counts.entries()]
    .sort((leftEntry, rightEntry) => {
      const countDifference = rightEntry[1] - leftEntry[1];

      if (countDifference !== 0) {
        return countDifference;
      }

      return leftEntry[0].localeCompare(rightEntry[0]);
    })
    .slice(0, limit)
    .map(([word]) => word);
}

function renderPlaybookMatches(themeLabel) {
  const matches = PLAYBOOK_THEME_MATCHES[themeLabel] ?? [];
  const wrapper = document.createElement("div");
  wrapper.className = "topics-grouping__playbook";

  const heading = document.createElement("span");
  heading.className = "topics-grouping__playbook-label";
  heading.textContent = "Playbook matches";
  wrapper.appendChild(heading);

  if (matches.length === 0) {
    const empty = document.createElement("p");
    empty.className = "topics-grouping__playbook-empty";
    empty.textContent = "No playbook category mapped yet.";
    wrapper.appendChild(empty);
    return wrapper;
  }

  matches.forEach((match) => {
    const group = document.createElement("div");
    group.className = "topics-grouping__playbook-group";

    const category = document.createElement("strong");
    category.textContent = match.category;

    const articles = document.createElement("span");
    articles.textContent = match.articles.join(", ");

    group.append(category, articles);
    wrapper.appendChild(group);
  });

  return wrapper;
}

function getIssueThemeAnalysis(rows, headers) {
  const issueColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey("Reported Issue")
  );
  const dateColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey(DATE_COLUMN_NAME)
  );
  const statusColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey(STATUS_COLUMN_NAME)
  );
  const tier2StateColumnIndex = getTier2StateColumnIndex(headers);
  const jiraTicketColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey(JIRA_TICKET_COLUMN_NAME)
  );
  const devTeamCommentsColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey(DEV_TEAM_COMMENTS_COLUMN_NAME)
  );
  const tier2CommentsColumnIndex = headers.findIndex(
    (header) => normalizeColumnKey(header) === normalizeColumnKey(TIER_2_COMMENTS_COLUMN_NAME)
  );
  const themes = new Map();
  let issueTextCount = 0;
  let automaticallyGroupedCount = 0;

  if (issueColumnIndex < 0) {
    return {
      entries: [],
      total: rows.length,
      issueTextCount,
      automaticallyGroupedCount,
    };
  }

  rows.forEach((row) => {
    const issueText = row[issueColumnIndex] ?? "";

    if (!normalizeIssueText(issueText)) {
      return;
    }

    issueTextCount += 1;
    const statusValue = getEffectiveRawStatus(row, statusColumnIndex, tier2StateColumnIndex);
    const jiraTicketValue =
      jiraTicketColumnIndex >= 0 ? row[jiraTicketColumnIndex] ?? "" : "";
    const devTeamComments =
      devTeamCommentsColumnIndex >= 0
        ? (row[devTeamCommentsColumnIndex] ?? "").trim()
        : "";
    const tier2Comments =
      tier2CommentsColumnIndex >= 0
        ? (row[tier2CommentsColumnIndex] ?? "").trim()
        : "";
    const classificationText = [issueText, tier2Comments, devTeamComments]
      .filter(Boolean)
      .join(" ");
    const { theme, matchedKeywords } = getIssueTheme(classificationText);
    const current = themes.get(theme.label) ?? {
      label: theme.label,
      shortLabel: theme.shortLabel,
      count: 0,
      matchedKeywords: new Map(),
      statusCounts: new Map(),
      texts: [],
      tickets: [],
      isFallback: theme.label === FALLBACK_ISSUE_THEME.label,
    };

    const normalizedStatus = normalizeStatusForCharts(statusValue) || "Unknown";
    current.count += 1;
    current.statusCounts.set(
      normalizedStatus,
      (current.statusCounts.get(normalizedStatus) ?? 0) + 1
    );
    current.texts.push(issueText);
    current.tickets.push({
      date: dateColumnIndex >= 0 ? row[dateColumnIndex] ?? "" : "",
      status: statusValue,
      ticketLabel: formatJiraTicketLabel(jiraTicketValue),
      ticketUrl: getJiraTicketUrl(jiraTicketValue),
      issueText,
      tier2Comments,
      devTeamComments,
    });
    matchedKeywords.forEach((keyword) => {
      current.matchedKeywords.set(
        keyword,
        (current.matchedKeywords.get(keyword) ?? 0) + 1
      );
    });

    if (!current.isFallback) {
      automaticallyGroupedCount += 1;
    }

    themes.set(theme.label, current);
  });

  const entries = [...themes.values()]
    .map((entry) => ({
      ...entry,
      signals:
        entry.matchedKeywords.size > 0
          ? [...entry.matchedKeywords.entries()]
              .sort((leftEntry, rightEntry) => rightEntry[1] - leftEntry[1])
              .slice(0, 4)
              .map(([keyword]) => keyword)
          : getTopWords(entry.texts, 4),
      statusEntries: getStatusEntriesByVolume(entry.statusCounts),
    }))
    .sort((leftEntry, rightEntry) => {
      const countDifference = rightEntry.count - leftEntry.count;

      if (countDifference !== 0) {
        return countDifference;
      }

      return leftEntry.label.localeCompare(rightEntry.label);
    });

  return {
    entries,
    total: rows.length,
    issueTextCount,
    automaticallyGroupedCount,
  };
}

function renderTopicInsights(rows, headers) {
  const analysis = getIssueThemeAnalysis(rows, headers);
  const topEntries = analysis.entries.slice(0, 10);
  const maxCount = Math.max(1, ...topEntries.map((entry) => entry.count));
  const coverage =
    analysis.issueTextCount === 0
      ? 0
      : (analysis.automaticallyGroupedCount / analysis.issueTextCount) * 100;

  topicsSubtitle.textContent = `AI-assisted issue clusters from reported issue text for ${describeActiveFilterSelection()}.`;
  topicsRankingTotal.textContent = `${analysis.issueTextCount.toLocaleString("en-US")} Issues`;
  topicsGroupingCoverage.textContent = `${coverage.toFixed(0)}% Covered`;
  topicsBars.replaceChildren();
  topicsTopTickets.replaceChildren();
  topicsGroupingMetrics.replaceChildren();
  topicsGroupingList.replaceChildren();

  if (topEntries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "topics-empty";
    empty.textContent = "No reported issue text available for the selected range.";
    topicsBars.appendChild(empty);
    selectedIssueThemeLabel = "";
    return;
  }

  const selectedEntry =
    topEntries.find((entry) => entry.label === selectedIssueThemeLabel) ??
    topEntries[0];
  selectedIssueThemeLabel = selectedEntry.label;

  topEntries.forEach((entry, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "topics-bar";
    item.dataset.themeLabel = entry.label;
    const statusBreakdown = entry.statusEntries
      .map(([status, count]) => `${status}: ${count}`)
      .join("\n");
    item.title = `${entry.label}: ${entry.count} issue${entry.count === 1 ? "" : "s"}\n${statusBreakdown}`;
    item.setAttribute(
      "aria-label",
      `Show issues for ${entry.label}, ${entry.count} issue${entry.count === 1 ? "" : "s"}`
    );
    item.setAttribute(
      "aria-pressed",
      entry.label === selectedEntry.label ? "true" : "false"
    );

    const value = document.createElement("span");
    value.className = "topics-bar__value";
    value.textContent = entry.count.toLocaleString("en-US");

    const track = document.createElement("div");
    track.className = "topics-bar__track";

    const fill = document.createElement("span");
    fill.className = "topics-bar__fill";
    fill.style.height = `${Math.max(10, (entry.count / maxCount) * 100)}%`;
    fill.style.setProperty("--bar-rank", String(index + 1));

    entry.statusEntries.forEach(([status, count]) => {
      const segment = document.createElement("span");
      segment.className = "topics-bar__segment";
      segment.style.height = `${(count / entry.count) * 100}%`;
      segment.style.background = getStatusGradient(status);
      segment.title = `${status}: ${count} issue${count === 1 ? "" : "s"}`;
      fill.appendChild(segment);
    });

    const label = document.createElement("span");
    label.className = "topics-bar__label";
    label.textContent = entry.shortLabel;

    track.appendChild(fill);
    item.append(value, track, label);
    item.addEventListener("click", () => {
      selectedIssueThemeLabel = entry.label;
      renderTopicInsights(rows, headers);
    });
    topicsBars.appendChild(item);
  });

  renderSelectedThemeTickets(selectedEntry);

  const metrics = [
    {
      label: "AI Grouped",
      value: analysis.automaticallyGroupedCount.toLocaleString("en-US"),
      description:
        "Issues assigned to one of the AI-assisted topic clusters using language signals from the reported issue text.",
    },
    {
      label: "AI Review",
      value: Math.max(
        0,
        analysis.issueTextCount - analysis.automaticallyGroupedCount
      ).toLocaleString("en-US"),
      description:
        "Issues with reported text that did not match the current AI-assisted clusters and should be reviewed.",
    },
    {
      label: "Themes",
      value: analysis.entries.length.toLocaleString("en-US"),
      description:
        "Total AI-assisted topic clusters currently represented in the selected data, including the review bucket when present.",
    },
  ];

  metrics.forEach(({ label, value, description }) => {
    const metric = document.createElement("div");
    metric.className = "topics-grouping__metric";

    const metricHeader = document.createElement("div");
    metricHeader.className = "topics-grouping__metric-header";

    const metricLabel = document.createElement("span");
    metricLabel.textContent = label;

    const info = document.createElement("button");
    info.type = "button";
    info.className = "topics-grouping__info";
    info.setAttribute("aria-label", `${label} info`);
    info.dataset.tooltip = description;
    info.textContent = "i";

    const metricValue = document.createElement("strong");
    metricValue.textContent = value;

    metricHeader.append(metricLabel, info);
    metric.append(metricHeader, metricValue);
    topicsGroupingMetrics.appendChild(metric);
  });

  topEntries.forEach((entry) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "topics-grouping__item";
    item.setAttribute(
      "aria-label",
      `Show issues for ${entry.label}, ${entry.count} issue${entry.count === 1 ? "" : "s"}`
    );
    item.setAttribute(
      "aria-pressed",
      entry.label === selectedEntry.label ? "true" : "false"
    );

    const title = document.createElement("div");
    title.className = "topics-grouping__item-title";

    const label = document.createElement("strong");
    label.textContent = entry.label;

    const count = document.createElement("span");
    count.textContent = `${entry.count} issue${entry.count === 1 ? "" : "s"}`;

    const signals = document.createElement("p");
    signals.className = "topics-grouping__signals";
    signals.textContent =
      entry.signals.length > 0
        ? `AI signals: ${entry.signals.join(", ")}`
        : "AI signals: review needed";
    const playbookMatches = renderPlaybookMatches(entry.label);

    title.append(label, count);
    item.append(title, signals, playbookMatches);
    item.addEventListener("click", () => {
      selectedIssueThemeLabel = entry.label;
      renderTopicInsights(rows, headers);
    });
    topicsGroupingList.appendChild(item);
  });

  syncTopicCardHeights();
}

function renderSelectedThemeTickets(selectedEntry) {
  const header = document.createElement("div");
  header.className = "topics-top-tickets__header";

  const title = document.createElement("h4");
  title.textContent = "Issues linked to selected AI theme";

  const theme = document.createElement("span");
  theme.textContent = `${selectedEntry.label} · ${selectedEntry.count} issue${selectedEntry.count === 1 ? "" : "s"}`;

  header.append(title, theme);
  topicsTopTickets.appendChild(header);

  const ticketEntries = [...selectedEntry.tickets].sort((leftTicket, rightTicket) => {
    const difference =
      parseSortableDate(rightTicket.date) - parseSortableDate(leftTicket.date);

    if (difference !== 0) {
      return difference;
    }

    return (rightTicket.ticketLabel || "").localeCompare(
      leftTicket.ticketLabel || ""
    );
  });

  if (ticketEntries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "topics-top-tickets__empty";
    empty.textContent = "No issues recorded for this theme.";
    topicsTopTickets.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "topics-top-tickets__list";

  ticketEntries.forEach((ticket) => {
    const item = document.createElement("div");
    item.className = "topics-top-tickets__item";

    const link = document.createElement(ticket.ticketUrl ? "a" : "span");
    link.className = "topics-top-tickets__link";
    link.textContent = ticket.ticketLabel || "No Jira ticket";

    if (ticket.ticketUrl) {
      link.href = ticket.ticketUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }

    const meta = document.createElement("span");
    meta.className = "topics-top-tickets__meta";
    meta.textContent = [ticket.date, ticket.status].filter(Boolean).join(" · ");

    const issue = document.createElement("p");
    issue.className = "topics-top-tickets__issue";
    issue.textContent = ticket.issueText;

    const comments = document.createElement("p");
    comments.className = "topics-top-tickets__comments";
    comments.textContent = [
      `Tier 2 Comments: ${ticket.tier2Comments || "No comments recorded"}`,
      `Dev Team Comments: ${ticket.devTeamComments || "No comments recorded"}`,
    ].join(" · ");

    item.addEventListener("mouseenter", (event) => {
      const tooltipText = [
        ticket.issueText,
        `Tier 2 Comments: ${ticket.tier2Comments || "No comments recorded"}`,
        `Dev Team Comments: ${ticket.devTeamComments || "No comments recorded"}`,
      ].join("\n\n");
      showIssueTextTooltip(tooltipText, event.clientX, event.clientY);
    });
    item.addEventListener("mousemove", (event) => {
      setIssueTextTooltipPosition(event.clientX, event.clientY);
    });
    item.addEventListener("mouseleave", hideIssueTextTooltip);

    item.append(link, meta, issue, comments);
    list.appendChild(item);
  });

  topicsTopTickets.appendChild(list);
}

function syncTopicCardHeights() {
  if (!topicsRankingCard || !topicsGroupingCard) {
    return;
  }

  window.requestAnimationFrame(() => {
    if (window.matchMedia("(max-width: 980px)").matches) {
      topicsRankingCard.style.height = "";
      return;
    }

    topicsRankingCard.style.height = "";
    const groupingHeight = topicsGroupingCard.offsetHeight;

    if (groupingHeight > 0) {
      topicsRankingCard.style.height = `${groupingHeight}px`;
    }
  });
}

// DOM element references and shared mutable state.

const recordsCount = document.getElementById("records-count");

const recordsHead = document.getElementById("records-head");

const recordsBody = document.getElementById("records-body");

const recordsSubtitle = document.getElementById("records-subtitle");
const lastUpdateLabel = document.getElementById("last-update");

const startDateFilter = document.getElementById("start-date-filter");

const endDateFilter = document.getElementById("end-date-filter");

const statusFilterToggle = document.getElementById("status-filter-toggle");

const statusFilterToggleLabel = document.getElementById("status-filter-toggle-label");

const statusFilterMenu = document.getElementById("status-filter-menu");

const statusFilterAllCheckbox = document.getElementById("status-filter-all");

const statusFilterOptionsContainer = document.getElementById("status-filter-options");

const moduleFilterToggle = document.getElementById("module-filter-toggle");

const moduleFilterToggleLabel = document.getElementById("module-filter-toggle-label");

const moduleFilterMenu = document.getElementById("module-filter-menu");

const moduleFilterAllCheckbox = document.getElementById("module-filter-all");

const moduleFilterOptionsContainer = document.getElementById("module-filter-options");

const statusCoverageToggle = document.getElementById("status-coverage-toggle");

const tier2CoverageToggle = document.getElementById("tier2-coverage-toggle");

const engelOwnerToggle = document.getElementById("engel-owner-toggle");

const odanaOwnerToggle = document.getElementById("odana-owner-toggle");

const dianaOwnerToggle = document.getElementById("diana-owner-toggle");

const issueSearchFilter = document.getElementById("issue-search-filter");

const statusSummaryList = document.getElementById("status-summary-list");

const statusPieChart = document.getElementById("status-pie-chart");

const statusPieLegend = document.getElementById("status-pie-legend");

const statusPieSubtitle = document.getElementById("status-pie-subtitle");

const platformSubtitle = document.getElementById("platform-subtitle");

const platformBar = document.getElementById("platform-bar");

const platformList = document.getElementById("platform-list");

const carrierSubtitle = document.getElementById("carrier-subtitle");

const carrierList = document.getElementById("carrier-list");

const tier2OwnerSubtitle = document.getElementById("tier2-owner-subtitle");

const tier2OwnerBar = document.getElementById("tier2-owner-bar");

const tier2OwnerList = document.getElementById("tier2-owner-list");

const timelineChart = document.getElementById("timeline-chart");

const timelineDayFilter = document.getElementById("timeline-day-filter");

const timelineSubtitle = document.getElementById("timeline-subtitle");

const timelineLegend = document.getElementById("timeline-legend");

const themeTrendSubtitle = document.getElementById("theme-trend-subtitle");

const themeTrendLegend = document.getElementById("theme-trend-legend");

const themeTrendChart = document.getElementById("theme-trend-chart");

const topicsSubtitle = document.getElementById("topics-subtitle");

const topicsRankingTotal = document.getElementById("topics-ranking-total");

const topicsRankingCard = document.querySelector(".topics-card--ranking");

const topicsGroupingCard = document.querySelector(".topics-card--grouping");

const topicsBars = document.getElementById("topics-bars");

const topicsTopTickets = document.getElementById("topics-top-tickets");

const topicsGroupingCoverage = document.getElementById("topics-grouping-coverage");

const topicsGroupingMetrics = document.getElementById("topics-grouping-metrics");

const topicsGroupingList = document.getElementById("topics-grouping-list");

const reportedSubtitle = document.getElementById("reported-subtitle");

const reportedTotal = document.getElementById("reported-total");

const reportedChart = document.getElementById("reported-chart");

const columnsControl = document.getElementById("columns-control");

const columnsToggle = document.getElementById("columns-toggle");

const columnsMenu = document.getElementById("columns-menu");

const columnsList = document.getElementById("columns-list");

const columnsSelectAll = document.getElementById("columns-select-all");

const columnsReset = document.getElementById("columns-reset");

let tableHeaders = [];

let allRows = [];

let issueThemeHeaders = [];

let issueThemeRows = [];

let issueThemeSourceCount = 0;

let issueThemeThroughDateLabel = "";

let dateSortDirection = "desc";

let visibleColumns = new Set();

let timelineTooltip = null;

let issueTextTooltip = null;

let selectedIssueThemeLabel = "";

let selectedTimelineDays = new Set();

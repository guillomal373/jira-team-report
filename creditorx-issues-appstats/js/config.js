// Configuration: paths, column names, defaults, theme config and SVG icon markup.

const DATA_DIRECTORY = "data/";

const CSV_MANIFEST_PATH = `${DATA_DIRECTORY}files.json`;

const FALLBACK_CSV_FILES = [
  "data/Issues-4-may.csv",
  "data/Issues-5-may.csv",
  "data/issues-6-may.csv",
  "data/Issues-7-may.csv",
  "data/Issues-8-may.csv",
];

const COLUMN_PREFS_STORAGE_KEY = "creditorx-issues-visible-columns-v2";

const DATE_COLUMN_NAME = "Date";

const LAST_UPDATE_COLUMN_NAME = "Last Update";

const REPORTED_BY_COLUMN_NAME = "Reported By";

const JIRA_TICKET_COLUMN_NAME = "Jira ticket";

const STATUS_COLUMN_NAME = "Status";

const TIER_2_STATE_COLUMN_NAME = "Tier 2 State";

const PLATFORM_COLUMN_NAME = "IOS or Android";

const DEV_TEAM_COMMENTS_COLUMN_NAME = "Dev Team comments";

const TIER_2_COMMENTS_COLUMN_NAME = "Tier 2 Comments";

const MODULE_COLUMN_NAME = "Module/Section";

const DEFAULT_DATE_RANGE_DAYS = 60;

const ISSUE_IDENTITY_COLUMN_NAMES = [
  "Customer Name",
  DATE_COLUMN_NAME,
  "Customer ID",
  "IOS or Android",
  "Reported Issue",
];

const REQUIRED_COLUMN_NAMES = [
  DATE_COLUMN_NAME,
  "Reported Issue",
  STATUS_COLUMN_NAME,
];

const DEFAULT_VISIBLE_COLUMN_NAMES = [
  DATE_COLUMN_NAME,
  LAST_UPDATE_COLUMN_NAME,
  "Reported Issue",
  STATUS_COLUMN_NAME,
  TIER_2_STATE_COLUMN_NAME,
  TIER_2_COMMENTS_COLUMN_NAME,
  DEV_TEAM_COMMENTS_COLUMN_NAME,
  JIRA_TICKET_COLUMN_NAME,
];

const ISSUE_SEARCH_COLUMN_NAMES = [
  PLATFORM_COLUMN_NAME,
  "CreditorX Device",
  "Reported Issue",
  TIER_2_STATE_COLUMN_NAME,
  TIER_2_COMMENTS_COLUMN_NAME,
  DEV_TEAM_COMMENTS_COLUMN_NAME,
];

const ISSUE_THEME_CONFIG = window.CREDITORX_ISSUE_THEME_CONFIG ?? {};

const ISSUE_THEME_RULES = ISSUE_THEME_CONFIG.rules ?? [];

const FALLBACK_ISSUE_THEME = ISSUE_THEME_CONFIG.fallbackTheme ?? {
  label: "Other / Needs AI Review",
  shortLabel: "Other",
  keywords: [],
};

const THEME_STOP_WORDS = new Set(ISSUE_THEME_CONFIG.stopWords ?? []);

const TIMELINE_EVENTS = window.CREDITORX_TIMELINE_EVENTS ?? [];

// Bitten-apple Apple logo silhouette (viewBox 0 0 384 512), used instead of
// an emoji so the iOS release marker reads as the real logo, in white.
const APPLE_LOGO_PATH_D =
  "M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z";

const APPLE_LOGO_SVG_MARKUP = `<svg viewBox="0 0 384 512" width="10" height="13" aria-hidden="true"><path fill="#ffffff" d="${APPLE_LOGO_PATH_D}"/></svg>`;

// Android robot (bugdroid) mascot, redrawn from the official AOSP asset
// (Wikimedia Commons "Android_robot.svg", viewBox -147 -70 294 345), used
// instead of an emoji so the Android release marker shows the real logo,
// in white.
const ANDROID_LOGO_SVG_MARKUP = `<svg viewBox="-147 -70 294 345" width="12" height="14" aria-hidden="true"><g fill="#ffffff"><ellipse cx="0" cy="41" rx="91" ry="84"/><rect x="-91" y="20" width="182" height="182" rx="22"/><rect x="14" y="-86" width="13" height="86" rx="6.5" transform="rotate(29)"/><rect x="14" y="-86" width="13" height="86" rx="6.5" transform="scale(-1,1) rotate(29)"/><rect x="-143" y="41" width="48" height="133" rx="24"/><rect x="95" y="41" width="48" height="133" rx="24"/><rect x="-58" y="138" width="48" height="133" rx="24"/><rect x="10" y="138" width="48" height="133" rx="24"/></g></svg>`;

// Bullhorn/megaphone silhouette (viewBox 0 0 512 512), used for the
// marketing campaign marker, in white.
const MEGAPHONE_PATH_D =
  "M480 32c0-12.9-7.8-24.6-19.8-29.6s-25.7-2.2-34.9 6.9L381.7 53c-48 48-113.1 75-181 75l-8.7 0-32 0-96 0c-35.3 0-64 28.7-64 64l0 96c0 35.3 28.7 64 64 64l0 128c0 17.7 14.3 32 32 32l64 0c17.7 0 32-14.3 32-32l0-128 8.7 0c67.9 0 133 27 181 75l43.6 43.6c9.2 9.2 22.9 11.9 34.9 6.9s19.8-16.6 19.8-29.6l0-147.6c18.6-8.8 32-32.5 32-60.4s-13.4-51.6-32-60.4L480 32zm-64 76.7L416 240l0 131.3C357.2 317.8 280.5 288 200.7 288l-8.7 0 0-96 8.7 0c79.8 0 156.5-29.8 215.3-83.3z";

const MEGAPHONE_SVG_MARKUP = `<svg viewBox="0 0 512 512" width="12" height="12" aria-hidden="true"><path fill="#ffffff" d="${MEGAPHONE_PATH_D}"/></svg>`;

// Database cylinder silhouette (viewBox 0 0 448 512), used for the
// database-incident marker, in white.
const DATABASE_PATH_D =
  "M448 80v48c0 44.2-100.3 80-224 80S0 172.2 0 128V80C0 35.8 100.3 0 224 0S448 35.8 448 80zM393.2 214.7c20.8-7.4 39.9-16.9 54.8-28.6V288c0 44.2-100.3 80-224 80S0 332.2 0 288V186.1c14.9 11.8 34 21.2 54.8 28.6C99.7 230.7 159.5 240 224 240s124.3-9.3 169.2-25.3zM0 346.1c14.9 11.8 34 21.2 54.8 28.6C99.7 390.7 159.5 400 224 400s124.3-9.3 169.2-25.3c20.8-7.4 39.9-16.9 54.8-28.6V432c0 44.2-100.3 80-224 80S0 476.2 0 432V346.1z";

const DATABASE_SVG_MARKUP = `<svg viewBox="0 0 448 512" width="12" height="14" aria-hidden="true"><path fill="#ffffff" d="${DATABASE_PATH_D}"/></svg>`;

const HEADER_ALIASES = new Map([
  ["dev team comments", DEV_TEAM_COMMENTS_COLUMN_NAME],
  ["jira ticket", JIRA_TICKET_COLUMN_NAME],
]);

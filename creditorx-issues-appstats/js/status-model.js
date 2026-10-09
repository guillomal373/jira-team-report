// Status class/colour/order maps and status helpers.

const STATUS_CLASS_MAP = {
  new: "status-new",
  triage: "status-triage",
  "call agent (additional information)": "status-call-agent",
  "returned - insufficient information": "status-returned-insufficient",
  "in queue": "status-in-queue",
  "in progress": "status-in-progress",
  completed: "status-completed",
  "resolved with cx": "status-resolved-cx",
  "client not answering (3 days)": "status-client-not-answering",
  "account canceled": "status-account-canceled",
  "app uninstalled": "status-app-uninstalled",
  "unresolved with cx": "status-unresolved-cx",
  "follow up": "status-follow-up",
  solved: "status-solved",
  "unable to contact": "status-unable-to-contact",
  dev: "status-dev",
};

const STATUS_SUMMARY_ORDER = [
  "New",
  "Triage",
  "Call Agent (Additional information)",
  "Returned - Insufficient Information",
  "In Progress",
  "Dev",
  "Unable to contact",
  "Solved",
  "Unresolved with cx",
  "Account Canceled",
  "App uninstalled",
  "Follow up",
];

const STATUS_COLOR_MAP = {
  new: "#525252",
  triage: "#7e2ba1",
  "call agent (additional information)": "#6e6e6e",
  "returned - insufficient information": "#8f8f8f",
  "in queue": "#0e87d7",
  "in progress": "#1aa8ee",
  completed: "#11a86a",
  "resolved with cx": "#7ca313",
  "client not answering (3 days)": "#5fa86f",
  "account canceled": "#2f8f4f",
  "app uninstalled": "#0f6f3a",
  "unresolved with cx": "#b1163d",
  "follow up": "#c38711",
  solved: "#11a86a",
  "unable to contact": "#3fa34d",
  dev: "#ff3b30",
  unknown: "#8b8b8b",
};

// Consolidates the raw "Status"/"Tier 2 State" values into the Tier 2-style
// buckets used for charts/summaries/filters. Blank counts as "New". Values
// not listed here (e.g. "Returned - Insufficient Information") pass through
// unchanged. Includes self-mappings for files where the column already
// stores the consolidated bucket name (e.g. "Solved", "Unable to contact").
const STATUS_TIER2_EQUIVALENTS = {
  "": "New",
  new: "New",
  triage: "Triage",
  "in progress": "In Progress",
  "in queue": "In Progress",
  completed: "Solved",
  "resolved with cx": "Solved",
  solved: "Solved",
  "client not answering (3 days)": "Unable to contact",
  "unable to contact": "Unable to contact",
  "call agent (additional information)": "Call Agent (Additional information)",
  "account canceled": "Account Canceled",
  "unresolved with cx": "Unresolved with cx",
  "app uninstalled": "App uninstalled",
  dev: "Dev",
};

function normalizeStatusForCharts(rawStatus) {
  const trimmed = String(rawStatus ?? "").trim();
  return STATUS_TIER2_EQUIVALENTS[trimmed.toLowerCase()] ?? trimmed;
}

function getTier2StateColumnIndex(headers) {
  return headers.findIndex(
    (header) =>
      normalizeColumnKey(header) === normalizeColumnKey(TIER_2_STATE_COLUMN_NAME)
  );
}

// "Tier 2 State" is the source of truth for status when a row has it;
// "Status" is used as a fallback when Tier 2 State is blank (older exports
// only populate "Status").
function getEffectiveRawStatus(row, statusColumnIndex, tier2StateColumnIndex) {
  const tier2Value =
    tier2StateColumnIndex >= 0
      ? (row[tier2StateColumnIndex] ?? "").trim()
      : "";

  if (tier2Value) {
    return tier2Value;
  }

  return statusColumnIndex >= 0 ? (row[statusColumnIndex] ?? "").trim() : "";
}

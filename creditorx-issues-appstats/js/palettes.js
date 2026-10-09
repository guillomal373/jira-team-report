// Platform and Tier 2 owner palettes.

const PLATFORM_COLOR_MAP = {
  Android: "#11a86a",
  iOS: "#1aa8ee",
  Unknown: "#696969",
};

const TIER_2_OWNER_COLOR_MAP = {
  Engel: "#1aa8ee",
  Odana: "#11a86a",
  Diana: "#b06fe0",
  "E+O": "#cdaa56",
  "E+D": "#3fc7c7",
  "O+D": "#e08f3f",
  "E+O+D": "#e0473f",
  "No match": "#696969",
};

// Notes in "Tier 2 Comments" and/or "Dev Team comments" (Dev Team Comments
// is the older column that served the same purpose before Tier 2 Comments
// existed) are tagged with "O:" (Odana), "E:" (Engel), or "D-"/"D -"
// (Diana). Markers must start a line or follow whitespace so we don't match
// the letters mid-word.
const TIER_2_OWNER_MARKER_O = /(?:^|\n|\s)O:/;

const TIER_2_OWNER_MARKER_E = /(?:^|\n|\s)E:/;

const TIER_2_OWNER_MARKER_D = /(?:^|\n|\s)D\s?-/;

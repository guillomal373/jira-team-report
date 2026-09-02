// Markers plotted on the "Daily Issues Timeline" chart: app releases,
// marketing campaigns, or any other date worth calling out against issue
// volume. Add/edit entries here — no changes to app.js needed.
//
// date:  "YYYY-MM-DD" (must match the timeline's daily buckets)
// icon:  a single emoji shown inside the dot, or one of the keywords
//        "apple" / "android" / "megaphone" to draw a vector icon (in white)
//        instead of an emoji
// label: short text shown above the dot (keep it brief, a tooltip on hover
//        shows the full label + date)
// color: any CSS color, used for the dot, line and label
window.CREDITORX_TIMELINE_EVENTS = [
  {
    date: "2026-07-15",
    icon: "apple",
    label: "iOS release",
    color: "#0a84ff",
  },
  {
    date: "2026-08-16",
    icon: "android",
    label: "Android release",
    color: "#34c759",
  },
  {
    date: "2026-09-01",
    icon: "megaphone",
    label: "Marketing campaign",
    color: "#ff375f",
  },
];

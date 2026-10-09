// Date formatting and parsing helpers.

function formatDisplayDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function formatCompactDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value) {
  const trimmed = (value ?? "").trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const [, yearPart, monthPart, dayPart] = match;
  const parsedDate = new Date(
    Number(yearPart),
    Number(monthPart) - 1,
    Number(dayPart)
  );

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function parseFileDateFromFilename(fileUrl) {
  const fileName = decodeURIComponent(fileUrl.split("/").pop() ?? "");
  const match = fileName.match(/(\d{1,2})-([a-zA-Z]+)(?:-(\d{4}))?/);

  if (!match) {
    return null;
  }

  const [, dayPart, monthPart, yearPart] = match;
  const inferredYear = yearPart ?? String(new Date().getFullYear());
  const parsedDate = new Date(`${monthPart} ${dayPart}, ${inferredYear}`);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function parseDateFromFilename(fileUrl) {
  const parsedDate = parseFileDateFromFilename(fileUrl);
  return parsedDate ? formatDisplayDate(parsedDate) : "";
}

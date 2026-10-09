// CSV parsing and header/identity normalisation.

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let index = 0;
  let insideQuotes = false;

  while (index < text.length) {
    const char = text[index];

    if (insideQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          index += 2;
          continue;
        }

        insideQuotes = false;
        index += 1;
        continue;
      }

      value += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = true;
      index += 1;
      continue;
    }

    if (char === ",") {
      row.push(value);
      value = "";
      index += 1;
      continue;
    }

    if (char === "\n" || char === "\r") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";

      if (char === "\r" && text[index + 1] === "\n") {
        index += 2;
      } else {
        index += 1;
      }

      continue;
    }

    value += char;
    index += 1;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows.filter((currentRow) =>
    currentRow.some((cell) => cell.trim() !== "")
  );
}

function normalizeHeader(header) {
  const trimmedHeader = header.trim();
  return HEADER_ALIASES.get(trimmedHeader.toLowerCase()) || trimmedHeader || "Unnamed Column";
}

function normalizeColumnKey(header) {
  return normalizeHeader(header).toLowerCase();
}

function normalizeIdentityValue(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeCustomerId(value) {
  return normalizeIdentityValue(value).replace(/^cordoba-/, "");
}

// An issue is identified by customer + creation date (the "Date" column). The Jira
// ticket is deliberately NOT part of the identity: one ticket can resolve many issues.
function getIssueBaseKey(rowMap) {
  const customerId = normalizeCustomerId(rowMap.get("Customer ID"));
  const issueDate = normalizeIdentityValue(rowMap.get(DATE_COLUMN_NAME));

  if (customerId && issueDate) {
    return `customer-date:${customerId}||${issueDate}`;
  }

  return `details:${ISSUE_IDENTITY_COLUMN_NAMES.map((header) =>
    normalizeIdentityValue(rowMap.get(header))
  ).join("||")}`;
}

function getDatasetRowMap(dataset, row) {
  return new Map(dataset.headers.map((header, columnIndex) => [header, row[columnIndex] ?? ""]));
}

// Customer + date keys that appear on more than one row of the SAME file: those are
// different issues reported by one customer on one day, so they are told apart by
// their reported text. Every other issue keeps the plain key, so editing its text
// does not break tracking across files.
function findAmbiguousIssueKeys(datasets) {
  const ambiguousKeys = new Set();

  datasets.forEach((dataset) => {
    const seenKeys = new Set();

    dataset.rows.forEach((row) => {
      const baseKey = getIssueBaseKey(getDatasetRowMap(dataset, row));

      if (seenKeys.has(baseKey)) {
        ambiguousKeys.add(baseKey);
      }

      seenKeys.add(baseKey);
    });
  });

  return ambiguousKeys;
}

function getIssueIdentityKey(rowMap, ambiguousKeys = new Set()) {
  const baseKey = getIssueBaseKey(rowMap);

  if (!ambiguousKeys.has(baseKey)) {
    return baseKey;
  }

  return `${baseKey}||${normalizeIdentityValue(rowMap.get("Reported Issue"))}`;
}

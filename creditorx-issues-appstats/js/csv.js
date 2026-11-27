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

// Carrier names typed in "Carrier/Provider/Otro" that mean "nothing useful".
const CARRIER_OTHER_EMPTY_PATTERN = /^(|-+|\.|n\/?a\.?|na|no\.?|none|unknown)$/i;

// Brings one CSV file to the current column layout so the old and new exports merge
// into the same columns:
//  - old column names are renamed (HEADER_ALIASES, applied by the caller);
//  - "Carrier/Provider2" (new form) fills a blank "Carrier/Provider" and is dropped;
//    when it says "Otro", the text from "Carrier/Provider/Otro" is used instead;
//  - a blank "Module/Section" takes "Which part of the app has the issue?" (the
//    latter column is kept as it is).
function normalizeDatasetColumns(headers, rows) {
  const nextHeaders = [...headers];
  const nextRows = rows.map((row) => [...row]);
  const indexOf = (name) =>
    nextHeaders.findIndex((header) => normalizeColumnKey(header) === normalizeColumnKey(name));
  const blank = (value) => !String(value ?? "").trim();

  const carrierFormIndex = indexOf(CARRIER_FORM_COLUMN_NAME);

  if (carrierFormIndex >= 0) {
    let carrierIndex = indexOf(CARRIER_COLUMN_NAME);
    const otherIndex = indexOf(CARRIER_OTHER_COLUMN_NAME);

    if (carrierIndex < 0) {
      nextHeaders[carrierFormIndex] = CARRIER_COLUMN_NAME;
      carrierIndex = carrierFormIndex;
    }

    nextRows.forEach((row) => {
      if (carrierIndex === carrierFormIndex) {
        return;
      }

      if (blank(row[carrierIndex])) {
        row[carrierIndex] = row[carrierFormIndex] ?? "";
      }
    });

    nextRows.forEach((row) => {
      const carrier = String(row[carrierIndex] ?? "").trim().toLowerCase();
      const otherText = otherIndex >= 0 ? String(row[otherIndex] ?? "").trim() : "";

      if ((carrier === "otro" || carrier === "other") && !CARRIER_OTHER_EMPTY_PATTERN.test(otherText)) {
        row[carrierIndex] = otherText;
      }
    });

    if (carrierIndex !== carrierFormIndex) {
      nextHeaders.splice(carrierFormIndex, 1);
      nextRows.forEach((row) => row.splice(carrierFormIndex, 1));
    }
  }

  const appPartIndex = indexOf(APP_PART_COLUMN_NAME);

  if (appPartIndex >= 0) {
    let moduleIndex = indexOf(MODULE_COLUMN_NAME);

    if (moduleIndex < 0) {
      nextHeaders.push(MODULE_COLUMN_NAME);
      nextRows.forEach((row) => row.push(""));
      moduleIndex = nextHeaders.length - 1;
    }

    nextRows.forEach((row) => {
      const appPart = String(row[appPartIndex] ?? "").trim();

      if (blank(row[moduleIndex]) && appPart) {
        row[moduleIndex] = APP_PART_TO_MODULE.get(appPart.toLowerCase()) ?? appPart;
      }
    });
  }

  return { headers: nextHeaders, rows: nextRows };
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

  return `${baseKey}||${normalizeIdentityValue(rowMap.get(ISSUE_TEXT_COLUMN_NAME))}`;
}

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

function getIssueIdentityKey(rowMap) {
  const jiraTicket = normalizeIdentityValue(rowMap.get(JIRA_TICKET_COLUMN_NAME));

  if (jiraTicket) {
    return `jira:${jiraTicket}`;
  }

  const customerId = normalizeCustomerId(rowMap.get("Customer ID"));
  const issueDate = normalizeIdentityValue(rowMap.get(DATE_COLUMN_NAME));

  if (customerId && issueDate) {
    return `customer-date:${customerId}||${issueDate}`;
  }

  return `details:${ISSUE_IDENTITY_COLUMN_NAMES.map((header) =>
    normalizeIdentityValue(rowMap.get(header))
  ).join("||")}`;
}

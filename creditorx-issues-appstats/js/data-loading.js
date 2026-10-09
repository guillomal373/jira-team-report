// CSV discovery, loading and merging.

function getFileUpdateMeta(response, fileUrl) {
  const fileDate = parseFileDateFromFilename(fileUrl);

  if (fileDate) {
    return {
      timestamp: fileDate.getTime(),
      label: formatDisplayDate(fileDate),
    };
  }

  const lastModifiedHeader = response.headers.get("Last-Modified");

  if (lastModifiedHeader) {
    const parsedDate = new Date(lastModifiedHeader);

    if (!Number.isNaN(parsedDate.getTime())) {
      return {
        timestamp: parsedDate.getTime(),
        label: formatDisplayDate(parsedDate),
      };
    }
  }

  return {
    timestamp: Number.NEGATIVE_INFINITY,
    label: parseDateFromFilename(fileUrl),
  };
}

function setSubtitle(fileCount) {
  const label = fileCount === 1 ? "file" : "files";
  recordsSubtitle.innerHTML = `Data loaded from ${fileCount} CSV ${label} in <code>data/</code>.`;
}

async function discoverCsvFiles() {
  const manifestUrl = new URL(CSV_MANIFEST_PATH, window.location.href);

  try {
    const response = await fetch(manifestUrl, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const manifest = await response.json();
    const fileEntries = Array.isArray(manifest)
      ? manifest
      : Array.isArray(manifest.files)
        ? manifest.files
        : [];
    const manifestFiles = fileEntries
      .map((filePath) => String(filePath || "").trim())
      .filter(
        (filePath) =>
          filePath.length > 0 && filePath.toLowerCase().endsWith(".csv")
      )
      .map((filePath) => new URL(filePath, window.location.href).toString());

    if (manifestFiles.length > 0) {
      return manifestFiles;
    }
  } catch (error) {
    console.warn("Unable to load CSV manifest.", error);
  }

  const directoryUrl = new URL(DATA_DIRECTORY, window.location.href);

  try {
    const response = await fetch(directoryUrl, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const documentFragment = new DOMParser().parseFromString(html, "text/html");
    const files = [...documentFragment.querySelectorAll("a[href]")]
      .map((link) => new URL(link.getAttribute("href"), directoryUrl))
      .filter(
        (url) =>
          url.origin === window.location.origin &&
          url.pathname.toLowerCase().includes("/data/") &&
          url.pathname.toLowerCase().endsWith(".csv")
      )
      .map((url) => url.toString());

    const uniqueFiles = [...new Map(
      files.map((fileUrl) => [new URL(fileUrl).pathname, fileUrl])
    ).values()];

    if (uniqueFiles.length > 0) {
      return uniqueFiles;
    }
  } catch (error) {
    console.warn("Unable to auto-discover CSV files in data/.", error);
  }

  return FALLBACK_CSV_FILES.map((filePath) =>
    new URL(filePath, window.location.href).toString()
  );
}

async function loadCsvFile(fileUrl) {
  const response = await fetch(fileUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const csvText = await response.text();
  const parsedRows = parseCsv(csvText);
  const updateMeta = getFileUpdateMeta(response, fileUrl);

  if (parsedRows.length === 0) {
    return {
      headers: [],
      rows: [],
      sourceTimestamp: updateMeta.timestamp,
      sourceLastUpdate: updateMeta.label,
      fileUrl,
    };
  }

  const [headers, ...dataRows] = parsedRows;
  const normalizedHeaders = headers.map(normalizeHeader);

  return {
    headers: normalizedHeaders,
    rows: dataRows.map((row) =>
      normalizedHeaders.map((_, columnIndex) => row[columnIndex] ?? "")
    ),
    sourceTimestamp: updateMeta.timestamp,
    sourceLastUpdate: updateMeta.label,
    fileUrl,
  };
}

function getEndOfToday() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
}

function getDefaultDateRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - DEFAULT_DATE_RANGE_DAYS);

  return {
    start: toIsoDate(startDate),
    end: toIsoDate(today),
  };
}

function getDatasetsThroughToday(datasets) {
  const endOfToday = getEndOfToday().getTime();

  return datasets.filter((dataset) => {
    if (!Number.isFinite(dataset.sourceTimestamp)) {
      return true;
    }

    return dataset.sourceTimestamp <= endOfToday;
  });
}

function mergeDatasets(datasets, options = {}) {
  const { latestOnly = true } = options;
  const mergedHeaders = [];
  const seenHeaders = new Set();

  const datasetsInOrder = [...datasets].sort((leftDataset, rightDataset) => {
    const timestampDifference =
      leftDataset.sourceTimestamp - rightDataset.sourceTimestamp;

    if (timestampDifference !== 0) {
      return timestampDifference;
    }

    return leftDataset.fileUrl.localeCompare(rightDataset.fileUrl);
  });

  datasetsInOrder.forEach(({ headers }) => {
    headers.forEach((header) => {
      if (!seenHeaders.has(header)) {
        seenHeaders.add(header);
        mergedHeaders.push(header);
      }
    });
  });

  if (!mergedHeaders.includes(LAST_UPDATE_COLUMN_NAME)) {
    const dateColumnIndex = mergedHeaders.findIndex(
      (header) => normalizeColumnKey(header) === normalizeColumnKey(DATE_COLUMN_NAME)
    );
    const insertionIndex =
      dateColumnIndex >= 0 ? dateColumnIndex + 1 : mergedHeaders.length;
    mergedHeaders.splice(insertionIndex, 0, LAST_UPDATE_COLUMN_NAME);
  }

  const consolidatedIssues = new Map();
  const latestTimestamp = Math.max(
    ...datasetsInOrder.map((dataset) => dataset.sourceTimestamp)
  );
  const latestIssueKeys = new Set();

  datasetsInOrder.forEach((dataset) => {
    dataset.rows.forEach((row) => {
      const rowMap = new Map(
        dataset.headers.map((header, columnIndex) => [header, row[columnIndex] ?? ""])
      );
      const identityKey = getIssueIdentityKey(rowMap);
      const nextStatus = (rowMap.get(STATUS_COLUMN_NAME) ?? "").trim();
      const existingIssue = consolidatedIssues.get(identityKey);

      if (dataset.sourceTimestamp === latestTimestamp) {
        latestIssueKeys.add(identityKey);
      }

      if (!existingIssue) {
        const nextRow = mergedHeaders.map((header) =>
          header === LAST_UPDATE_COLUMN_NAME
            ? dataset.sourceLastUpdate
            : rowMap.get(header) ?? ""
        );
        consolidatedIssues.set(identityKey, {
          row: nextRow,
          status: nextStatus.toLowerCase(),
        });
        return;
      }

      existingIssue.row = mergedHeaders.map((header) =>
        header === LAST_UPDATE_COLUMN_NAME
          ? dataset.sourceLastUpdate
          : rowMap.get(header) ?? ""
      );
      existingIssue.status = nextStatus.toLowerCase();
    });
  });

  const mergedRows = [...consolidatedIssues.entries()]
    .filter(([identityKey]) => !latestOnly || latestIssueKeys.has(identityKey))
    .map(([, issue]) => issue.row);

  return {
    headers: mergedHeaders,
    rows: mergedRows,
  };
}

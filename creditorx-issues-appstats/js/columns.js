// Visible-column preferences and the columns menu.

function isRequiredColumn(header) {
  return REQUIRED_COLUMN_NAMES.some(
    (requiredHeader) =>
      normalizeColumnKey(requiredHeader) === normalizeColumnKey(header)
  );
}

function readStoredVisibleColumns() {
  try {
    const rawValue = window.localStorage.getItem(COLUMN_PREFS_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

function persistVisibleColumns() {
  try {
    window.localStorage.setItem(
      COLUMN_PREFS_STORAGE_KEY,
      JSON.stringify([...visibleColumns])
    );
  } catch {
    // Ignore storage failures and keep the current in-memory selection.
  }
}

function initializeVisibleColumns(headers) {
  const storedColumns = readStoredVisibleColumns();
  const nextVisibleColumns = new Set();
  const storedKeys = new Set(
    (storedColumns ?? []).map((header) => normalizeColumnKey(header))
  );
  const defaultKeys = new Set(
    DEFAULT_VISIBLE_COLUMN_NAMES.map((header) => normalizeColumnKey(header))
  );

  headers.forEach((header) => {
    if (isRequiredColumn(header)) {
      nextVisibleColumns.add(header);
      return;
    }

    if (
      (!storedColumns && defaultKeys.has(normalizeColumnKey(header))) ||
      (storedColumns && storedKeys.has(normalizeColumnKey(header)))
    ) {
      nextVisibleColumns.add(header);
    }
  });

  visibleColumns = nextVisibleColumns;
  persistVisibleColumns();
}

function resetVisibleColumns() {
  const defaultKeys = new Set(
    DEFAULT_VISIBLE_COLUMN_NAMES.map((header) => normalizeColumnKey(header))
  );
  visibleColumns = new Set(
    tableHeaders.filter(
      (header) =>
        isRequiredColumn(header) || defaultKeys.has(normalizeColumnKey(header))
    )
  );
  persistVisibleColumns();
  renderColumnsMenu(tableHeaders);
  refreshTable();
}

function showAllColumns() {
  visibleColumns = new Set(tableHeaders);
  persistVisibleColumns();
  renderColumnsMenu(tableHeaders);
  refreshTable();
}

function getVisibleColumnIndices(headers) {
  return headers
    .map((header, index) => ({ header, index }))
    .filter(
      ({ header }) => isRequiredColumn(header) || visibleColumns.has(header)
    );
}

function renderColumnsMenu(headers) {
  columnsList.replaceChildren();

  headers.forEach((header) => {
    const item = document.createElement("div");
    item.className = "columns-menu__item";

    const label = document.createElement("label");
    label.className = "columns-menu__label";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "columns-menu__checkbox";
    checkbox.checked = isRequiredColumn(header) || visibleColumns.has(header);
    checkbox.disabled = isRequiredColumn(header);

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        visibleColumns.add(header);
      } else {
        visibleColumns.delete(header);
      }

      persistVisibleColumns();
      refreshTable();
    });

    const text = document.createElement("span");
    text.className = "columns-menu__text";
    text.textContent = header;

    label.append(checkbox, text);
    item.appendChild(label);

    if (isRequiredColumn(header)) {
      const meta = document.createElement("span");
      meta.className = "columns-menu__meta";
      meta.textContent = "Required";
      item.appendChild(meta);
    }

    columnsList.appendChild(item);
  });
}

function openColumnsMenu() {
  columnsMenu.hidden = false;
  columnsToggle.setAttribute("aria-expanded", "true");
}

function closeColumnsMenu() {
  columnsMenu.hidden = true;
  columnsToggle.setAttribute("aria-expanded", "false");
}

function toggleColumnsMenu() {
  if (columnsMenu.hidden) {
    openColumnsMenu();
  } else {
    closeColumnsMenu();
  }
}

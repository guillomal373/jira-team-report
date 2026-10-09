// Colour helpers for status segments and gradients.

function getStatusColor(status) {
  return STATUS_COLOR_MAP[status.toLowerCase()] ?? STATUS_COLOR_MAP.unknown;
}

function parseHexColor(color) {
  const trimmed = String(color ?? "").trim();
  const normalized = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;

  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return null;
  }

  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function getSegmentLabelColor(color) {
  const rgb = parseHexColor(color);

  if (!rgb) {
    return "#f5f5f5";
  }

  const brightness = (rgb.red * 299 + rgb.green * 587 + rgb.blue * 114) / 1000;
  return brightness > 160 ? "#161616" : "#f6f6f6";
}

function clampColorChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function shiftHexColor(color, amount) {
  const rgb = parseHexColor(color);

  if (!rgb) {
    return color;
  }

  const shifted = [rgb.red, rgb.green, rgb.blue]
    .map((channel) => clampColorChannel(channel + amount))
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("");

  return `#${shifted}`;
}

function getStatusGradient(status) {
  const color = getStatusColor(status);
  return `linear-gradient(180deg, ${shiftHexColor(color, 42)}, ${shiftHexColor(color, -34)})`;
}

const { HOME_ASSISTANT_TEMPLATE } = require("./homeassistant-template");

const REQUEST_TIMEOUT_MS = 10_000;

class HomeAssistantError extends Error {
  constructor(message) {
    super(message);
    this.name = "HomeAssistantError";
  }
}

function buildTemplateUrl(homeAssistantUrl) {
  if (typeof homeAssistantUrl !== "string" || homeAssistantUrl.trim() === "") {
    throw new HomeAssistantError("Home Assistant URL is not configured");
  }

  let url;
  try {
    url = new URL(homeAssistantUrl.trim());
  } catch {
    throw new HomeAssistantError("Home Assistant URL is invalid");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new HomeAssistantError("Home Assistant URL must use HTTP or HTTPS");
  }

  url.pathname = `${url.pathname.replace(/\/+$/, "")}/api/template`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function resolveAccessToken(environmentToken, configToken) {
  const preferred = typeof environmentToken === "string" ? environmentToken.trim() : "";
  const fallback = typeof configToken === "string" ? configToken.trim() : "";
  return preferred || fallback;
}

function isMeasurement(value) {
  return (
    value === null ||
    (typeof value === "object" &&
      Number.isFinite(value.value) &&
      typeof value.unit === "string")
  );
}

function isRoom(room) {
  return (
    room !== null &&
    typeof room === "object" &&
    typeof room.id === "string" &&
    typeof room.name === "string" &&
    isMeasurement(room.temperature) &&
    isMeasurement(room.humidity) &&
    isMeasurement(room.pm25)
  );
}

function validateClimateData(data) {
  if (
    data === null ||
    typeof data !== "object" ||
    !Array.isArray(data.floors) ||
    !Array.isArray(data.other_rooms)
  ) {
    throw new HomeAssistantError("Home Assistant returned an invalid data structure");
  }

  const floorsAreValid = data.floors.every(
    (floor) =>
      floor !== null &&
      typeof floor === "object" &&
      typeof floor.id === "string" &&
      typeof floor.name === "string" &&
      Array.isArray(floor.rooms) &&
      floor.rooms.every(isRoom)
  );

  if (!floorsAreValid || !data.other_rooms.every(isRoom)) {
    throw new HomeAssistantError("Home Assistant returned an invalid data structure");
  }

  return data;
}

async function fetchClimateData({
  homeAssistantUrl,
  accessToken,
  fetchImpl = globalThis.fetch,
  timeoutMs = REQUEST_TIMEOUT_MS
}) {
  if (typeof accessToken !== "string" || accessToken.trim() === "") {
    throw new HomeAssistantError("Home Assistant access token is not configured");
  }

  const url = buildTemplateUrl(homeAssistantUrl);
  const signal = AbortSignal.timeout(timeoutMs);
  let response;

  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ template: HOME_ASSISTANT_TEMPLATE }),
      signal
    });
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      throw new HomeAssistantError("Home Assistant request timed out");
    }
    throw new HomeAssistantError("Unable to reach Home Assistant");
  }

  if (!response.ok) {
    throw new HomeAssistantError(`Home Assistant request failed with HTTP ${response.status}`);
  }

  let data;
  try {
    data = JSON.parse(await response.text());
  } catch {
    throw new HomeAssistantError("Home Assistant returned invalid JSON");
  }

  return validateClimateData(data);
}

module.exports = {
  HOME_ASSISTANT_TEMPLATE,
  HomeAssistantError,
  REQUEST_TIMEOUT_MS,
  buildTemplateUrl,
  fetchClimateData,
  resolveAccessToken,
  validateClimateData
};

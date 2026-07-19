const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  HOME_ASSISTANT_TEMPLATE,
  HomeAssistantError,
  buildTemplateUrl,
  fetchClimateData,
  resolveAccessToken,
  validateClimateData
} = require("../lib/homeassistant-client");

const fixture = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures", "climate-data.json"), "utf8")
);

test("buildTemplateUrl normalizes the base URL", () => {
  assert.equal(
    buildTemplateUrl("  https://ha.example.test:8123/  "),
    "https://ha.example.test:8123/api/template"
  );
  assert.equal(
    buildTemplateUrl("https://example.test/home-assistant/"),
    "https://example.test/home-assistant/api/template"
  );
  assert.throws(() => buildTemplateUrl("file:///tmp/ha"), HomeAssistantError);
  assert.throws(() => buildTemplateUrl("not a URL"), HomeAssistantError);
});

test("resolveAccessToken prefers HA_TOKEN and trims both sources", () => {
  assert.equal(resolveAccessToken(" environment-token ", "config-token"), "environment-token");
  assert.equal(resolveAccessToken("", " config-token "), "config-token");
  assert.equal(resolveAccessToken(undefined, undefined), "");
});

test("the fixed template includes all selection and grouping operations", () => {
  const requiredFragments = [
    "label_entities('Climate Source')",
    "label_devices('Climate Source')",
    "device_entities(device_id)",
    "climate.entities | unique",
    "entity_id[:7] == 'sensor.'",
    "has_value(entity_id)",
    "is_number(states(entity_id))",
    "device_class == 'temperature'",
    "device_class == 'humidity'",
    "device_class == 'pm25'",
    "value > readings.temperature_value",
    "value > readings.humidity_value",
    "value > readings.pm25_value",
    "for floor_id in floors()",
    "for area_id in floor_areas(floor_id)",
    "for area_id in areas()",
    "area_id not in result.assigned_areas",
    "readings.temperature is not none or readings.humidity is not none or readings.pm25 is not none",
    "to_json"
  ];

  for (const fragment of requiredFragments) {
    assert.ok(HOME_ASSISTANT_TEMPLATE.includes(fragment), `missing ${fragment}`);
  }
});

test("fetchClimateData posts the fixed template and parses plain-text JSON", async () => {
  let receivedUrl;
  let receivedOptions;
  const fetchImpl = async (url, options) => {
    receivedUrl = url;
    receivedOptions = options;
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(fixture)
    };
  };

  const data = await fetchClimateData({
    homeAssistantUrl: "http://homeassistant.local:8123/",
    accessToken: " secret-token ",
    fetchImpl
  });

  assert.deepEqual(data, fixture);
  assert.equal(receivedUrl, "http://homeassistant.local:8123/api/template");
  assert.equal(receivedOptions.method, "POST");
  assert.equal(receivedOptions.headers.Authorization, "Bearer secret-token");
  assert.equal(receivedOptions.headers["Content-Type"], "application/json");
  assert.equal(JSON.parse(receivedOptions.body).template, HOME_ASSISTANT_TEMPLATE);
  assert.ok(receivedOptions.signal instanceof AbortSignal);
});

test("fetchClimateData reports safe HTTP, timeout, network, and JSON failures", async () => {
  await assert.rejects(
    fetchClimateData({
      homeAssistantUrl: "https://ha.example.test",
      accessToken: "do-not-log-this",
      fetchImpl: async () => ({ ok: false, status: 401 })
    }),
    (error) => error.message === "Home Assistant request failed with HTTP 401"
  );

  await assert.rejects(
    fetchClimateData({
      homeAssistantUrl: "https://ha.example.test",
      accessToken: "do-not-log-this",
      fetchImpl: async () => {
        const error = new Error("request leaked do-not-log-this");
        error.name = "TimeoutError";
        throw error;
      }
    }),
    (error) => error.message === "Home Assistant request timed out"
  );

  await assert.rejects(
    fetchClimateData({
      homeAssistantUrl: "https://ha.example.test",
      accessToken: "do-not-log-this",
      fetchImpl: async () => {
        throw new Error("request leaked do-not-log-this");
      }
    }),
    (error) => error.message === "Unable to reach Home Assistant"
  );

  await assert.rejects(
    fetchClimateData({
      homeAssistantUrl: "https://ha.example.test",
      accessToken: "do-not-log-this",
      fetchImpl: async () => ({ ok: true, status: 200, text: async () => "not json" })
    }),
    (error) => error.message === "Home Assistant returned invalid JSON"
  );
});

test("validateClimateData accepts the fixture and rejects malformed contracts", () => {
  assert.equal(validateClimateData(fixture), fixture);
  assert.throws(() => validateClimateData({ floors: [], other_rooms: "wrong" }), HomeAssistantError);
  assert.throws(
    () =>
      validateClimateData({
        floors: [],
        other_rooms: [
          {
            id: "garage",
            name: "Garage",
            temperature: { value: "14", unit: "°C" },
            humidity: null,
            pm25: null
          }
        ]
      }),
    HomeAssistantError
  );
});

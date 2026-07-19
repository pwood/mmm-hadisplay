const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const nunjucks = require("nunjucks");

const template = readFileSync(path.join(__dirname, "..", "MMM-HADisplay.njk"), "utf8");
const css = readFileSync(path.join(__dirname, "..", "MMM-HADisplay.css"), "utf8");

test("the display template renders floors, all rooms, missing values, and other rooms", () => {
  const output = nunjucks.renderString(template, {
    loading: false,
    initialError: false,
    stale: true,
    floors: [
      {
        name: "First floor",
        rooms: [
          {
            name: "Bedroom",
            temperature: {
              value: "21.3 °C",
              valueClass: "mmm-hadisplay-value-heating"
            },
            humidity: {
              value: "49 %",
              valueClass: "mmm-hadisplay-value-humidity"
            },
            pm25: "–",
            lighting: {
              iconClass: "fas",
              className: "mmm-hadisplay-light-on",
              style: "color: rgb(244, 129, 129)"
            },
            security: {
              iconName: "fa-door-closed",
              className: "mmm-hadisplay-security-clear",
              label: "Room clear"
            }
          },
          {
            name: "Bathroom",
            temperature: { value: "–", valueClass: "" },
            humidity: { value: "–", valueClass: "" },
            pm25: "–",
            lighting: {
              iconClass: "far",
              className: "mmm-hadisplay-light-unavailable",
              style: ""
            },
            security: {
              iconName: "fa-door-closed",
              className: "mmm-hadisplay-security-unavailable",
              label: "No security door"
            }
          }
        ]
      }
    ],
    otherRooms: [
      {
        name: "Garage",
        temperature: { value: "14.0 °C", valueClass: "" },
        humidity: { value: "–", valueClass: "" },
        pm25: "8 µg/m³",
        lighting: { iconClass: "far", className: "mmm-hadisplay-light-off", style: "" },
        security: {
          iconName: "fa-door-open",
          className: "mmm-hadisplay-security-open",
          label: "Door open"
        }
      }
    ]
  });

  for (const text of [
    "First floor",
    "Bedroom",
    "Bathroom",
    "Other areas",
    "Garage",
    "21.3 °C",
    "Data unavailable"
  ]) {
    assert.ok(output.includes(text), `missing ${text}`);
  }
  assert.ok(output.includes('class="dateheader mmm-hadisplay-section"'));
  assert.ok(output.includes('class="align-left"'));
  assert.ok(!output.includes('class="bright align-left"'));
  assert.ok(output.includes('class="mmm-hadisplay-value-heating"'));
  assert.ok(!output.includes("↗"));
  assert.ok(!output.includes("↘"));
  assert.ok(!output.includes("<thead>"));
  assert.ok(output.includes('class="align-right"'));
  assert.ok(output.includes('colspan="6"'));
  assert.ok(output.includes("fas fa-fw fa-lightbulb"));
  assert.ok(output.includes("far fa-fw fa-lightbulb"));
  assert.ok(output.includes("mmm-hadisplay-light-unavailable"));
  assert.ok(output.includes("mmm-hadisplay-light-off"));
  assert.ok(output.includes("color: rgb(244, 129, 129)"));
  assert.ok(output.includes("fas fa-fw fa-door-closed"));
  assert.ok(output.includes("fas fa-fw fa-door-open"));
  assert.ok(output.includes("mmm-hadisplay-security-clear"));
  assert.ok(output.includes("mmm-hadisplay-security-unavailable"));
  assert.ok(output.includes("mmm-hadisplay-security-open"));
  assert.ok(output.includes('aria-label="Room clear"'));
  assert.equal((template.match(/<tr class="normal mmm-hadisplay-room">/g) || []).length, 1);
  assert.equal((template.match(/\{\{ renderRoom\(room\) \}\}/g) || []).length, 2);
});

test("loading and initial error states do not render the table", () => {
  const loading = nunjucks.renderString(template, {
    loading: true,
    initialError: false,
    stale: false,
    floors: [],
    otherRooms: []
  });
  assert.ok(loading.includes("Loading…"));
  assert.ok(!loading.includes("<table"));

  const error = nunjucks.renderString(template, {
    loading: false,
    initialError: true,
    stale: false,
    floors: [],
    otherRooms: []
  });
  assert.ok(error.includes("Home Assistant data unavailable"));
  assert.ok(!error.includes("<table"));
});

test("module CSS reserves strong colors for active measurements", () => {
  assert.match(css, /\.mmm-hadisplay-value-heating\s*{[^}]*color:/s);
  assert.match(css, /\.mmm-hadisplay-value-cooling\s*{[^}]*color:/s);
  assert.match(css, /\.mmm-hadisplay-value-humidity\s*{[^}]*color:/s);
  assert.doesNotMatch(css, /\bbackground(?:-color)?\s*:/i);
  assert.match(css, /\.mmm-hadisplay-light-unavailable\s*{[^}]*opacity:\s*0\.18/s);
  assert.match(css, /\.mmm-hadisplay-light-off\s*{[^}]*opacity:\s*0\.4/s);
  assert.match(
    css,
    /\.mmm-hadisplay-security-unavailable,\s*\.mmm-hadisplay-security-unknown\s*{[^}]*opacity:\s*0\.18/s
  );
  assert.match(css, /\.mmm-hadisplay-security-clear\s*{[^}]*opacity:\s*0\.4/s);
  assert.match(css, /\.mmm-hadisplay-security-open\s*{[^}]*opacity:\s*1/s);
  assert.doesNotMatch(css, /\.mmm-hadisplay-security-open\s*{[^}]*color:/s);
});

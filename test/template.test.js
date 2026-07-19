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
              className: "mmm-hadisplay-light-on",
              style: "color: rgb(244, 129, 129)"
            }
          },
          {
            name: "Bathroom",
            temperature: { value: "–", valueClass: "" },
            humidity: { value: "–", valueClass: "" },
            pm25: "–",
            lighting: { className: "mmm-hadisplay-light-unavailable", style: "" }
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
        lighting: { className: "mmm-hadisplay-light-off", style: "" }
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
  assert.ok(output.includes('colspan="5"'));
  assert.ok(output.includes("fas fa-fw fa-lightbulb"));
  assert.ok(output.includes("mmm-hadisplay-light-unavailable"));
  assert.ok(output.includes("mmm-hadisplay-light-off"));
  assert.ok(output.includes("color: rgb(244, 129, 129)"));
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

test("module CSS limits colors to active measurement values", () => {
  assert.match(css, /\.mmm-hadisplay-value-heating\s*{[^}]*color:/s);
  assert.match(css, /\.mmm-hadisplay-value-cooling\s*{[^}]*color:/s);
  assert.match(css, /\.mmm-hadisplay-value-humidity\s*{[^}]*color:/s);
  assert.equal((css.match(/\bcolor\s*:/g) || []).length, 3);
  assert.doesNotMatch(css, /\bbackground(?:-color)?\s*:/i);
  assert.match(css, /\.mmm-hadisplay-light-unavailable\s*{[^}]*opacity:\s*0\.18/s);
  assert.match(css, /\.mmm-hadisplay-light-off\s*{[^}]*opacity:\s*0\.4/s);
});

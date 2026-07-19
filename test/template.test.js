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
              valueClass: "mmm-hadisplay-value-heating",
              direction: "↗",
              target: "24.0 °C"
            },
            humidity: {
              value: "49 %",
              valueClass: "mmm-hadisplay-value-humidity",
              direction: "↘",
              target: "45 %"
            },
            pm25: "–"
          },
          {
            name: "Bathroom",
            temperature: { value: "–", valueClass: "", direction: "", target: "" },
            humidity: { value: "–", valueClass: "", direction: "", target: "" },
            pm25: "–"
          }
        ]
      }
    ],
    otherRooms: [
      {
        name: "Garage",
        temperature: { value: "14.0 °C", valueClass: "", direction: "", target: "" },
        humidity: { value: "–", valueClass: "", direction: "", target: "" },
        pm25: "8 µg/m³"
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
    "↗ 24.0 °C",
    "↘ 45 %",
    "Data unavailable"
  ]) {
    assert.ok(output.includes(text), `missing ${text}`);
  }
  assert.ok(output.includes('class="dateheader mmm-hadisplay-section"'));
  assert.ok(output.includes('class="align-left"'));
  assert.ok(!output.includes('class="bright align-left"'));
  assert.ok(output.includes('class="mmm-hadisplay-value-heating"'));
  assert.ok(output.includes('class="mmm-hadisplay-target"'));
  assert.ok(!output.includes("<thead>"));
  assert.ok(output.includes('class="align-right"'));
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
});

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
            temperature: "21.3 °C",
            humidity: "49 %",
            pm25: "–"
          },
          {
            name: "Bathroom",
            temperature: "–",
            humidity: "–",
            pm25: "–"
          }
        ]
      }
    ],
    otherRooms: [
      {
        name: "Garage",
        temperature: "14.0 °C",
        humidity: "–",
        pm25: "8 µg/m³"
      }
    ]
  });

  for (const text of [
    "First floor",
    "Bedroom",
    "Bathroom",
    "Other rooms",
    "Garage",
    "21.3 °C",
    "Data unavailable"
  ]) {
    assert.ok(output.includes(text), `missing ${text}`);
  }
  assert.ok(output.includes('class="dateheader mmm-hadisplay-section"'));
  assert.ok(output.includes('class="bright align-left"'));
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

test("module CSS contains no explicit color declarations", () => {
  assert.doesNotMatch(css, /\b(?:color|background(?:-color)?)\s*:/i);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(css, /\brgba?\s*\(/i);
});

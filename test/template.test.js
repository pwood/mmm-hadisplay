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
              value: "21.3",
              unit: "°C",
              valueClass: "mmm-hadisplay-value-heating"
            },
            humidity: {
              value: "49",
              unit: "%",
              valueClass: "mmm-hadisplay-value-humidity"
            },
            pm25: {
              className: "mmm-hadisplay-pm25-unavailable",
              label: "PM2.5 unavailable"
            },
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
            temperature: { value: "–", unit: "", valueClass: "" },
            humidity: { value: "–", unit: "", valueClass: "" },
            pm25: {
              className: "mmm-hadisplay-pm25-unavailable",
              label: "PM2.5 unavailable"
            },
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
        temperature: { value: "14.0", unit: "°C", valueClass: "" },
        humidity: { value: "–", unit: "", valueClass: "" },
        pm25: {
          className: "mmm-hadisplay-pm25-low",
          label: "PM2.5 8.1 µg/m³, low"
        },
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
    "21.3",
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
  assert.ok(output.includes("fas fa-fw fa-smog"));
  assert.ok(output.includes("mmm-hadisplay-pm25-unavailable"));
  assert.ok(output.includes("mmm-hadisplay-pm25-low"));
  assert.ok(output.includes('aria-label="PM2.5 8.1 µg/m³, low"'));
  assert.ok(
    output.includes('<sup class="mmm-hadisplay-measurement-unit">°C</sup>')
  );
  assert.ok(output.includes('<sup class="mmm-hadisplay-measurement-unit">%</sup>'));
  assert.equal((output.match(/mmm-hadisplay-measurement-unit/g) || []).length, 3);
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
  assert.match(
    css,
    /\.mmm-hadisplay-measurement-unit\s*{[^}]*font-size:\s*0\.65em[^}]*position:\s*relative[^}]*top:\s*5px[^}]*vertical-align:\s*super/s
  );
  assert.doesNotMatch(css, /\bbackground(?:-color)?\s*:/i);
  assert.match(css, /\.mmm-hadisplay-pm25-unavailable\s*{[^}]*opacity:\s*0\.1/s);
  assert.match(css, /\.mmm-hadisplay-pm25-low\s*{[^}]*color:\s*inherit[^}]*opacity:\s*0\.4/s);
  assert.match(css, /\.mmm-hadisplay-pm25-medium\s*{[^}]*color:\s*#d8b65a[^}]*opacity:\s*1/s);
  assert.match(css, /\.mmm-hadisplay-pm25-high\s*{[^}]*color:\s*#d93b32[^}]*opacity:\s*1/s);
  assert.match(css, /\.mmm-hadisplay-light-unavailable\s*{[^}]*opacity:\s*0\.1/s);
  assert.match(css, /\.mmm-hadisplay-light-off\s*{[^}]*opacity:\s*0\.4/s);
  assert.match(
    css,
    /\.mmm-hadisplay-security-unavailable\s*{[^}]*opacity:\s*0\.1/s
  );
  assert.match(css, /\.mmm-hadisplay-security-unknown\s*{[^}]*opacity:\s*0\.18/s);
  assert.match(css, /\.mmm-hadisplay-security-clear\s*{[^}]*opacity:\s*0\.4/s);
  assert.match(css, /\.mmm-hadisplay-security-open\s*{[^}]*opacity:\s*1/s);
  assert.doesNotMatch(css, /\.mmm-hadisplay-security-open\s*{[^}]*color:/s);
});

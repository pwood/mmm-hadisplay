const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const lightColor = require("../lib/light-color");

test("light color helper is available to CommonJS and browser consumers", () => {
  assert.equal(globalThis.HADisplayLightColor, lightColor);
  assert.ok(Object.isFrozen(lightColor));

  const browserContext = {};
  const source = readFileSync(path.join(__dirname, "..", "lib", "light-color.js"), "utf8");
  vm.runInNewContext(source, browserContext);
  assert.equal(typeof browserContext.HADisplayLightColor.getRepresentativeLightColor, "function");
});

test("normalizeRgb clamps negatives and proportionally scales oversized channels", () => {
  assert.deepEqual(lightColor.normalizeRgb([0, 0, 0]), [0, 0, 0]);
  assert.deepEqual(lightColor.normalizeRgb([300, 150, -3]), [255, 128, 0]);
  assert.deepEqual(lightColor.normalizeRgb([255, 12.4, Number.NaN]), [255, 12, 0]);
});

test("HS and XY colors convert to normalized RGB", () => {
  assert.deepEqual(lightColor.hsToRgb([0, 100]), [255, 0, 0]);
  assert.deepEqual(lightColor.hsToRgb([120, 100]), [0, 255, 0]);
  assert.deepEqual(lightColor.hsToRgb([240, 100]), [0, 0, 255]);
  assert.deepEqual(lightColor.hsToRgb([-60, 100]), [255, 0, 255]);
  assert.deepEqual(lightColor.xyToRgb([0.3127, 0.329]), [171, 255, 248]);
  assert.equal(lightColor.xyToRgb([0.4, 0]), null);
});

test("Kelvin conversion clamps its supported range", () => {
  assert.deepEqual(lightColor.kelvinToRgb(500), [255, 68, 0]);
  assert.deepEqual(lightColor.kelvinToRgb(4_000), [255, 206, 166]);
  assert.deepEqual(lightColor.kelvinToRgb(50_000), [152, 186, 255]);
});

test("RGB, RGBW, and RGBWW attributes convert using their white channels", () => {
  assert.deepEqual(lightColor.lightColorToRgb({ color_mode: "rgb", rgb: [255, 0, 0] }), [
    255,
    0,
    0
  ]);
  assert.deepEqual(
    lightColor.lightColorToRgb({ color_mode: "rgbw", rgbw: [100, 20, 0, 50] }),
    [150, 70, 50]
  );
  assert.deepEqual(
    lightColor.lightColorToRgb({ color_mode: "rgbww", rgbww: [10, 20, 30, 40, 50] }),
    [91, 86, 86]
  );
});

test("representative color prefers saturation and otherwise averages color temperature", () => {
  assert.deepEqual(
    lightColor.getRepresentativeLightColor([
      { color_mode: "hs", hs: [30, 20] },
      { color_mode: "rgb", rgb: [255, 0, 0] }
    ]),
    [244, 129, 129]
  );
  assert.equal(
    lightColor.getRepresentativeLightColor([{ color_mode: "rgb", rgb: [100, 95, 95] }]),
    null
  );
  assert.deepEqual(
    lightColor.getRepresentativeLightColor([
      { color_mode: "color_temp", kelvin: 2_000 },
      { color_mode: "color_temp", kelvin: 6_000 }
    ]),
    [244, 222, 204]
  );
  assert.equal(
    lightColor.getRepresentativeLightColor([
      { color_mode: "color_temp", kelvin: null },
      { color_mode: null }
    ]),
    null
  );
});

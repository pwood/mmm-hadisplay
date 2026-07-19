const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

require("../lib/light-color");

let definition;
global.Module = {
  register(name, moduleDefinition) {
    assert.equal(name, "MMM-HADisplay");
    definition = moduleDefinition;
  }
};
require("../MMM-HADisplay");

const fixture = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures", "climate-data.json"), "utf8")
);

function createInstance(overrides = {}) {
  return Object.assign(Object.create(definition), {
    identifier: "module_1_MMM-HADisplay",
    config: { ...definition.defaults },
    climateData: null,
    initialError: false,
    stale: false,
    updateTimer: null,
    sendSocketNotification() {},
    updateDom() {},
    ...overrides
  });
}

test("module loads its stylesheet and light color helper", () => {
  const instance = createInstance({ file: (filePath) => `/module/${filePath}` });

  assert.deepEqual(instance.getStyles(), ["/module/MMM-HADisplay.css"]);
  assert.deepEqual(instance.getScripts(), ["/module/lib/light-color.js"]);
});

test("getUpdateInterval accepts positive values and falls back otherwise", () => {
  const instance = createInstance();
  assert.equal(instance.getUpdateInterval(), 60_000);
  instance.config.updateInterval = 15_000;
  assert.equal(instance.getUpdateInterval(), 15_000);
  instance.config.updateInterval = 0;
  assert.equal(instance.getUpdateInterval(), 60_000);
  instance.config.updateInterval = "invalid";
  assert.equal(instance.getUpdateInterval(), 60_000);
});

test("fetchData routes requests with the module identifier", () => {
  let sent;
  const instance = createInstance({
    config: {
      homeAssistantUrl: "https://ha.example.test",
      accessToken: "token",
      updateInterval: 60_000
    },
    sendSocketNotification(notification, payload) {
      sent = { notification, payload };
    }
  });

  instance.fetchData();
  assert.deepEqual(sent, {
    notification: "HADISPLAY_FETCH",
    payload: {
      identifier: "module_1_MMM-HADisplay",
      homeAssistantUrl: "https://ha.example.test",
      accessToken: "token"
    }
  });
});

test("socket responses are instance-scoped and preserve stale data on errors", () => {
  const updateSpeeds = [];
  const instance = createInstance({
    updateDom(speed) {
      updateSpeeds.push(speed);
    }
  });

  instance.socketNotificationReceived("HADISPLAY_DATA", {
    identifier: "another_instance",
    data: fixture
  });
  assert.equal(instance.climateData, null);

  instance.socketNotificationReceived("HADISPLAY_ERROR", {
    identifier: instance.identifier
  });
  assert.equal(instance.initialError, true);
  assert.equal(instance.stale, false);

  instance.socketNotificationReceived("HADISPLAY_DATA", {
    identifier: instance.identifier,
    data: fixture
  });
  assert.equal(instance.climateData, fixture);
  assert.equal(instance.initialError, false);

  instance.socketNotificationReceived("HADISPLAY_ERROR", {
    identifier: instance.identifier
  });
  assert.equal(instance.climateData, fixture);
  assert.equal(instance.stale, true);

  instance.socketNotificationReceived("HADISPLAY_DATA", {
    identifier: instance.identifier,
    data: fixture
  });
  assert.equal(instance.stale, false);
  assert.deepEqual(updateSpeeds, [0, 1_000, 0, 0]);
});

test("getTemplateData preserves group order and formats measurements", () => {
  const instance = createInstance({ climateData: fixture });
  const data = instance.getTemplateData();

  assert.deepEqual(
    data.floors.map((floor) => floor.name),
    ["First floor", "Ground floor"]
  );
  assert.deepEqual(
    data.floors[0].rooms.map((room) => room.name),
    ["Bedroom"]
  );
  assert.deepEqual(data.floors[0].rooms[0].temperature, {
    value: "21.3 °C",
    valueClass: "mmm-hadisplay-value-heating"
  });
  assert.deepEqual(data.floors[0].rooms[0].humidity, {
    value: "49 %",
    valueClass: "mmm-hadisplay-value-humidity"
  });
  assert.deepEqual(data.floors[0].rooms[0].pm25, {
    className: "mmm-hadisplay-pm25-unavailable",
    label: "PM2.5 unavailable"
  });
  assert.deepEqual(data.floors[1].rooms[0].pm25, {
    className: "mmm-hadisplay-pm25-medium",
    label: "PM2.5 12.6 µg/m³, medium"
  });
  assert.equal(
    data.floors[1].rooms[0].temperature.valueClass,
    "mmm-hadisplay-value-cooling"
  );
  assert.equal(
    data.floors[1].rooms[0].humidity.valueClass,
    "mmm-hadisplay-value-humidity"
  );
  assert.equal(data.floors[0].rooms[0].lighting.className, "mmm-hadisplay-light-on");
  assert.match(data.floors[0].rooms[0].lighting.style, /^color: rgb\(/);
  assert.deepEqual(data.floors[1].rooms[0].lighting, {
    iconClass: "fas",
    className: "mmm-hadisplay-light-on",
    style: "color: rgb(129, 138, 244)"
  });
  assert.deepEqual(data.floors[0].rooms[0].security, {
    iconName: "fa-door-closed",
    className: "mmm-hadisplay-security-clear",
    label: "Room clear"
  });
  assert.deepEqual(data.floors[1].rooms[0].security, {
    iconName: "fa-door-open",
    className: "mmm-hadisplay-security-open",
    label: "Door open"
  });
  assert.equal(data.otherRooms[0].name, "Garage");
  assert.deepEqual(data.otherRooms[0].pm25, {
    className: "mmm-hadisplay-pm25-low",
    label: "PM2.5 8.1 µg/m³, low"
  });
  assert.deepEqual(data.otherRooms[0].lighting, {
    iconClass: "far",
    className: "mmm-hadisplay-light-off",
    style: ""
  });
  assert.deepEqual(data.otherRooms[0].security, {
    iconName: "fa-door-closed",
    className: "mmm-hadisplay-security-unknown",
    label: "Door state unavailable"
  });
});

test("preparePm25 applies unavailable, low, medium, and high thresholds", () => {
  const instance = createInstance();

  assert.deepEqual(instance.preparePm25(null), {
    className: "mmm-hadisplay-pm25-unavailable",
    label: "PM2.5 unavailable"
  });
  assert.deepEqual(instance.preparePm25({ value: 9.9, unit: "µg/m³" }), {
    className: "mmm-hadisplay-pm25-low",
    label: "PM2.5 9.9 µg/m³, low"
  });
  assert.deepEqual(instance.preparePm25({ value: 10, unit: "µg/m³" }), {
    className: "mmm-hadisplay-pm25-medium",
    label: "PM2.5 10.0 µg/m³, medium"
  });
  assert.deepEqual(instance.preparePm25({ value: 49.9, unit: "µg/m³" }), {
    className: "mmm-hadisplay-pm25-medium",
    label: "PM2.5 49.9 µg/m³, medium"
  });
  assert.deepEqual(instance.preparePm25({ value: 50, unit: "µg/m³" }), {
    className: "mmm-hadisplay-pm25-high",
    label: "PM2.5 50.0 µg/m³, high"
  });
});

test("prepareLighting distinguishes absent, off, neutral, colour, and CCT lights", () => {
  const instance = createInstance();
  const emptyColor = {
    color_mode: null,
    rgb: null,
    rgbw: null,
    rgbww: null,
    hs: null,
    xy: null,
    kelvin: null
  };

  assert.deepEqual(instance.prepareLighting({ available: false, on: false, colors: [] }), {
    iconClass: "far",
    className: "mmm-hadisplay-light-unavailable",
    style: ""
  });
  assert.deepEqual(instance.prepareLighting({ available: true, on: false, colors: [] }), {
    iconClass: "far",
    className: "mmm-hadisplay-light-off",
    style: ""
  });
  assert.deepEqual(
    instance.prepareLighting({ available: true, on: true, colors: [emptyColor] }),
    { iconClass: "fas", className: "mmm-hadisplay-light-on", style: "" }
  );

  const colors = [
    { ...emptyColor, color_mode: "hs", hs: [30, 20] },
    { ...emptyColor, color_mode: "rgb", rgb: [255, 0, 0] }
  ];
  assert.deepEqual(instance.prepareLighting({ available: true, on: true, colors }), {
    iconClass: "fas",
    className: "mmm-hadisplay-light-on",
    style: "color: rgb(244, 129, 129)"
  });

  const cctColors = [
    { ...emptyColor, color_mode: "color_temp", kelvin: 2_000 },
    { ...emptyColor, color_mode: "color_temp", kelvin: 6_000 }
  ];
  assert.deepEqual(instance.prepareLighting({ available: true, on: true, colors: cctColors }), {
    iconClass: "fas",
    className: "mmm-hadisplay-light-on",
    style: "color: rgb(244, 222, 204)"
  });
});

test("prepareSecurity distinguishes absent, unknown, clear, and open doors", () => {
  const instance = createInstance();

  assert.deepEqual(instance.prepareSecurity({ available: false, clear: null }), {
    iconName: "fa-door-closed",
    className: "mmm-hadisplay-security-unavailable",
    label: "No security door"
  });
  assert.deepEqual(instance.prepareSecurity({ available: true, clear: null }), {
    iconName: "fa-door-closed",
    className: "mmm-hadisplay-security-unknown",
    label: "Door state unavailable"
  });
  assert.deepEqual(instance.prepareSecurity({ available: true, clear: true }), {
    iconName: "fa-door-closed",
    className: "mmm-hadisplay-security-clear",
    label: "Room clear"
  });
  assert.deepEqual(instance.prepareSecurity({ available: true, clear: false }), {
    iconName: "fa-door-open",
    className: "mmm-hadisplay-security-open",
    label: "Door open"
  });
});

test("getTemplateData removes empty rooms and floor headings", () => {
  const emptyRoom = {
    id: "empty",
    name: "Empty room",
    temperature: null,
    humidity: null,
    pm25: null,
    controls: [],
    lighting: { available: false, on: false, colors: [] },
    security: { available: false, clear: null }
  };
  const instance = createInstance({
    climateData: {
      floors: [
        { id: "empty_floor", name: "Empty floor", rooms: [emptyRoom] },
        { id: "used_floor", name: "Used floor", rooms: [emptyRoom, fixture.floors[0].rooms[0]] }
      ],
      other_rooms: [emptyRoom]
    }
  });

  const data = instance.getTemplateData();
  assert.deepEqual(data.floors.map((floor) => floor.name), ["Used floor"]);
  assert.deepEqual(data.floors[0].rooms.map((room) => room.name), ["Bedroom"]);
  assert.deepEqual(data.otherRooms, []);
});

test("getTemplateData retains rooms that only have labelled lights", () => {
  const lightOnlyRoom = {
    id: "hallway",
    name: "Hallway",
    temperature: null,
    humidity: null,
    pm25: null,
    controls: [],
    lighting: { available: true, on: false, colors: [] },
    security: { available: false, clear: null }
  };
  const instance = createInstance({
    climateData: {
      floors: [{ id: "ground_floor", name: "Ground floor", rooms: [lightOnlyRoom] }],
      other_rooms: []
    }
  });

  const data = instance.getTemplateData();
  assert.equal(data.floors[0].rooms[0].name, "Hallway");
  assert.equal(data.floors[0].rooms[0].temperature.value, "–");
  assert.equal(data.floors[0].rooms[0].humidity.value, "–");
  assert.equal(
    data.floors[0].rooms[0].pm25.className,
    "mmm-hadisplay-pm25-unavailable"
  );
  assert.equal(data.floors[0].rooms[0].lighting.className, "mmm-hadisplay-light-off");
});

test("getTemplateData retains rooms that only have labelled security doors", () => {
  const securityOnlyRoom = {
    id: "side_door",
    name: "Side door",
    temperature: null,
    humidity: null,
    pm25: null,
    controls: [],
    lighting: { available: false, on: false, colors: [] },
    security: { available: true, clear: true }
  };
  const instance = createInstance({
    climateData: {
      floors: [{ id: "ground_floor", name: "Ground floor", rooms: [securityOnlyRoom] }],
      other_rooms: []
    }
  });

  const room = instance.getTemplateData().floors[0].rooms[0];
  assert.equal(room.name, "Side door");
  assert.equal(room.temperature.value, "–");
  assert.equal(room.humidity.value, "–");
  assert.equal(room.pm25.className, "mmm-hadisplay-pm25-unavailable");
  assert.equal(room.lighting.className, "mmm-hadisplay-light-unavailable");
  assert.equal(room.security.className, "mmm-hadisplay-security-clear");
});

test("start, suspend, and resume manage polling without overlapping timers", (context) => {
  const scheduled = [];
  const cleared = [];
  context.mock.method(global, "setInterval", (callback, interval) => {
    const timer = { callback, interval };
    scheduled.push(timer);
    return timer;
  });
  context.mock.method(global, "clearInterval", (timer) => cleared.push(timer));

  let fetches = 0;
  const instance = createInstance({
    fetchData() {
      fetches += 1;
    }
  });

  instance.start();
  assert.equal(fetches, 1);
  assert.equal(scheduled[0].interval, 60_000);
  scheduled[0].callback();
  assert.equal(fetches, 2);

  instance.suspend();
  assert.equal(instance.updateTimer, null);
  assert.equal(cleared.length, 1);

  instance.resume();
  assert.equal(fetches, 3);
  assert.equal(scheduled.length, 2);
});

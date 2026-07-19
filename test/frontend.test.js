const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

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
  let updates = 0;
  const instance = createInstance({
    updateDom() {
      updates += 1;
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
  assert.equal(updates, 3);
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
    valueClass: "mmm-hadisplay-value-heating",
    direction: "↗",
    target: "24.0 °C"
  });
  assert.deepEqual(data.floors[0].rooms[0].humidity, {
    value: "49 %",
    valueClass: "mmm-hadisplay-value-humidity",
    direction: "↘",
    target: "45 %"
  });
  assert.equal(data.floors[0].rooms[0].pm25, "–");
  assert.equal(data.floors[1].rooms[0].pm25, "13 µg/m³");
  assert.equal(data.floors[1].rooms[0].temperature.target, "18.0 °C");
  assert.equal(data.floors[1].rooms[0].temperature.direction, "↘");
  assert.equal(data.floors[1].rooms[0].humidity.target, "60 %");
  assert.equal(data.floors[1].rooms[0].humidity.direction, "↗");
  assert.equal(data.otherRooms[0].name, "Garage");
});

test("selectControl falls back to directional extremes without a current reading", () => {
  const instance = createInstance();
  const heating = [
    { metric: "temperature", action: "heating", target: 20, unit: "°C" },
    { metric: "temperature", action: "heating", target: 23, unit: "°C" }
  ];
  const cooling = [
    { metric: "temperature", action: "cooling", target: 21, unit: "°C" },
    { metric: "temperature", action: "cooling", target: 18, unit: "°C" }
  ];

  assert.equal(instance.selectControl(heating, "temperature", null).target, 23);
  assert.equal(instance.selectControl(cooling, "temperature", null).target, 18);
});

test("getTemplateData removes empty rooms and floor headings", () => {
  const emptyRoom = {
    id: "empty",
    name: "Empty room",
    temperature: null,
    humidity: null,
    pm25: null,
    controls: []
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

const assert = require("node:assert/strict");
const NodeModule = require("node:module");
const test = require("node:test");

const client = require("../lib/homeassistant-client");
const originalFetchClimateData = client.fetchClimateData;
const originalResolveAccessToken = client.resolveAccessToken;
const originalLoad = NodeModule._load;
const originalLog = global.Log;
const ignoreLog = () => {};

global.Log = { error: ignoreLog };

function loadNodeHelper() {
  delete require.cache[require.resolve("../node_helper")];
  NodeModule._load = function load(request, parent, isMain) {
    if (request === "node_helper") {
      return { create: (definition) => definition };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require("../node_helper");
  } finally {
    NodeModule._load = originalLoad;
  }
}

function createHelper(definition, overrides = {}) {
  return Object.assign(Object.create(definition), {
    sendSocketNotification() {},
    ...overrides
  });
}

test.afterEach(() => {
  client.fetchClimateData = originalFetchClimateData;
  client.resolveAccessToken = originalResolveAccessToken;
  global.Log.error = ignoreLog;
});

test.after(() => {
  if (originalLog === undefined) {
    delete global.Log;
  } else {
    global.Log = originalLog;
  }
});

test("node helper routes successful data to the requesting instance", async () => {
  const expectedData = { floors: [], other_rooms: [] };
  let request;
  const notifications = [];

  client.fetchClimateData = async (options) => {
    request = options;
    return expectedData;
  };
  client.resolveAccessToken = (environmentToken, configToken) =>
    environmentToken || configToken;

  const definition = loadNodeHelper();
  const helper = createHelper(definition, {
    sendSocketNotification(notification, payload) {
      notifications.push({ notification, payload });
    }
  });
  helper.start();

  const previousToken = process.env.HA_TOKEN;
  process.env.HA_TOKEN = "environment-token";
  try {
    await helper.socketNotificationReceived("HADISPLAY_FETCH", {
      identifier: "module_1_MMM-HADisplay",
      homeAssistantUrl: "https://ha.example.test",
      accessToken: "config-token"
    });
  } finally {
    if (previousToken === undefined) {
      delete process.env.HA_TOKEN;
    } else {
      process.env.HA_TOKEN = previousToken;
    }
  }

  assert.deepEqual(request, {
    homeAssistantUrl: "https://ha.example.test",
    accessToken: "environment-token"
  });
  assert.deepEqual(notifications, [
    {
      notification: "HADISPLAY_DATA",
      payload: { identifier: "module_1_MMM-HADisplay", data: expectedData }
    }
  ]);
});

test("node helper suppresses overlapping requests for the same instance", async () => {
  let resolveRequest;
  let calls = 0;
  client.fetchClimateData = async () => {
    calls += 1;
    return new Promise((resolve) => {
      resolveRequest = resolve;
    });
  };
  client.resolveAccessToken = () => "token";

  const definition = loadNodeHelper();
  const helper = createHelper(definition);
  helper.start();
  const payload = {
    identifier: "module_1_MMM-HADisplay",
    homeAssistantUrl: "https://ha.example.test"
  };

  const firstRequest = helper.socketNotificationReceived("HADISPLAY_FETCH", payload);
  await helper.socketNotificationReceived("HADISPLAY_FETCH", payload);
  assert.equal(calls, 1);

  resolveRequest({ floors: [], other_rooms: [] });
  await firstRequest;
  assert.equal(helper.inFlight.size, 0);
});

test("node helper reports failures, clears in-flight state, and allows a retry", async () => {
  const notifications = [];
  const errors = [];
  let calls = 0;

  client.fetchClimateData = async () => {
    calls += 1;
    if (calls === 1) {
      throw new client.HomeAssistantError("Unable to reach Home Assistant");
    }
    return { floors: [], other_rooms: [] };
  };
  client.resolveAccessToken = () => "token";
  global.Log.error = (message) => errors.push(message);

  const definition = loadNodeHelper();
  const helper = createHelper(definition, {
    sendSocketNotification(notification, payload) {
      notifications.push({ notification, payload });
    }
  });
  helper.start();

  const payload = {
    identifier: "module_1_MMM-HADisplay",
    homeAssistantUrl: "https://ha.example.test"
  };
  await helper.socketNotificationReceived("HADISPLAY_FETCH", payload);
  assert.equal(helper.inFlight.size, 0);
  await helper.socketNotificationReceived("HADISPLAY_FETCH", payload);

  assert.equal(calls, 2);
  assert.deepEqual(errors, ["[MMM-HADisplay] Unable to reach Home Assistant"]);
  assert.deepEqual(notifications, [
    {
      notification: "HADISPLAY_ERROR",
      payload: { identifier: "module_1_MMM-HADisplay" }
    },
    {
      notification: "HADISPLAY_DATA",
      payload: { identifier: "module_1_MMM-HADisplay", data: { floors: [], other_rooms: [] } }
    }
  ]);
});

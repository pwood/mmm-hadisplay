const assert = require("node:assert/strict");
const NodeModule = require("node:module");
const test = require("node:test");

const client = require("../lib/homeassistant-client");
const originalFetchClimateData = client.fetchClimateData;
const originalResolveAccessToken = client.resolveAccessToken;
const originalLoad = NodeModule._load;

let helperDefinition;
NodeModule._load = function load(request, parent, isMain) {
  if (request === "node_helper") {
    return {
      create(definition) {
        helperDefinition = definition;
        return definition;
      }
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

global.Log = { error() {} };
require("../node_helper");
NodeModule._load = originalLoad;

function createHelper(overrides = {}) {
  return Object.assign(Object.create(helperDefinition), {
    sendSocketNotification() {},
    ...overrides
  });
}

test.after(() => {
  client.fetchClimateData = originalFetchClimateData;
  client.resolveAccessToken = originalResolveAccessToken;
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

  delete require.cache[require.resolve("../node_helper")];
  NodeModule._load = function load(requestName, parent, isMain) {
    if (requestName === "node_helper") {
      return { create: (definition) => definition };
    }
    return originalLoad.call(this, requestName, parent, isMain);
  };
  const definition = require("../node_helper");
  NodeModule._load = originalLoad;

  const helper = Object.assign(Object.create(definition), {
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

  delete require.cache[require.resolve("../node_helper")];
  NodeModule._load = function load(requestName, parent, isMain) {
    if (requestName === "node_helper") {
      return { create: (definition) => definition };
    }
    return originalLoad.call(this, requestName, parent, isMain);
  };
  const definition = require("../node_helper");
  NodeModule._load = originalLoad;

  const helper = createHelper();
  Object.setPrototypeOf(helper, definition);
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

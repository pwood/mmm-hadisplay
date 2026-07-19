const NodeHelper = require("node_helper");
const { fetchClimateData, resolveAccessToken } = require("./lib/homeassistant-client");

module.exports = NodeHelper.create({
  requiresVersion: "2.36.0",

  start() {
    this.inFlight = new Set();
  },

  async socketNotificationReceived(notification, payload) {
    if (
      notification !== "HADISPLAY_FETCH" ||
      !payload ||
      typeof payload.identifier !== "string"
    ) {
      return;
    }

    const { identifier } = payload;
    if (this.inFlight.has(identifier)) {
      return;
    }

    this.inFlight.add(identifier);
    try {
      const accessToken = resolveAccessToken(process.env.HA_TOKEN, payload.accessToken);
      const data = await fetchClimateData({
        homeAssistantUrl: payload.homeAssistantUrl,
        accessToken
      });
      this.sendSocketNotification("HADISPLAY_DATA", { identifier, data });
    } catch (error) {
      Log.error(`[MMM-HADisplay] ${error.message}`);
      this.sendSocketNotification("HADISPLAY_ERROR", { identifier });
    } finally {
      this.inFlight.delete(identifier);
    }
  }
});

Module.register("MMM-HADisplay", {
  requiresVersion: "2.36.0",

  defaults: {
    homeAssistantUrl: "",
    accessToken: "",
    updateInterval: 60_000
  },

  getStyles() {
    return [this.file("MMM-HADisplay.css")];
  },

  getTemplate() {
    return "MMM-HADisplay.njk";
  },

  start() {
    this.climateData = null;
    this.initialError = false;
    this.stale = false;
    this.updateTimer = null;
    this.scheduleUpdates();
  },

  stop() {
    this.clearUpdateTimer();
  },

  suspend() {
    this.clearUpdateTimer();
  },

  resume() {
    this.scheduleUpdates();
  },

  clearUpdateTimer() {
    if (this.updateTimer !== null) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  },

  getUpdateInterval() {
    const interval = Number(this.config.updateInterval);
    return Number.isFinite(interval) && interval > 0 ? interval : this.defaults.updateInterval;
  },

  scheduleUpdates() {
    this.clearUpdateTimer();
    this.fetchData();
    this.updateTimer = setInterval(() => this.fetchData(), this.getUpdateInterval());
  },

  fetchData() {
    this.sendSocketNotification("HADISPLAY_FETCH", {
      identifier: this.identifier,
      homeAssistantUrl: this.config.homeAssistantUrl,
      accessToken: this.config.accessToken
    });
  },

  socketNotificationReceived(notification, payload) {
    if (!payload || payload.identifier !== this.identifier) {
      return;
    }

    if (notification === "HADISPLAY_DATA") {
      this.climateData = payload.data;
      this.initialError = false;
      this.stale = false;
      this.updateDom(1_000);
    } else if (notification === "HADISPLAY_ERROR") {
      this.initialError = this.climateData === null;
      this.stale = this.climateData !== null;
      this.updateDom(1_000);
    }
  },

  formatMeasurement(measurement, fractionDigits) {
    if (!measurement || !Number.isFinite(measurement.value)) {
      return "–";
    }

    const formattedValue = measurement.value.toFixed(fractionDigits);
    return measurement.unit ? `${formattedValue} ${measurement.unit}` : formattedValue;
  },

  selectControl(controls, metric) {
    return controls.find((control) => control.metric === metric) || null;
  },

  prepareMeasurement(measurement, fractionDigits, control) {
    const value = this.formatMeasurement(measurement, fractionDigits);
    if (!control) {
      return { value, valueClass: "" };
    }

    const valueClass =
      control.action === "heating"
        ? "mmm-hadisplay-value-heating"
        : control.action === "cooling"
          ? "mmm-hadisplay-value-cooling"
          : "mmm-hadisplay-value-humidity";

    return {
      value,
      valueClass: measurement ? valueClass : ""
    };
  },

  prepareRoom(room) {
    const controls = room.controls || [];
    const temperatureControl = this.selectControl(controls, "temperature");
    const humidityControl = this.selectControl(controls, "humidity");
    return {
      id: room.id,
      name: room.name,
      temperature: this.prepareMeasurement(room.temperature, 1, temperatureControl),
      humidity: this.prepareMeasurement(room.humidity, 0, humidityControl),
      pm25: this.formatMeasurement(room.pm25, 0)
    };
  },

  hasMeasurements(room) {
    return room.temperature !== null || room.humidity !== null || room.pm25 !== null;
  },

  getTemplateData() {
    const floors = this.climateData
      ? this.climateData.floors.map((floor) => ({
          id: floor.id,
          name: floor.name,
          rooms: floor.rooms
            .filter((room) => this.hasMeasurements(room))
            .map((room) => this.prepareRoom(room))
        })).filter((floor) => floor.rooms.length > 0)
      : [];
    const otherRooms = this.climateData
      ? this.climateData.other_rooms
          .filter((room) => this.hasMeasurements(room))
          .map((room) => this.prepareRoom(room))
      : [];

    return {
      loading: this.climateData === null && !this.initialError,
      initialError: this.initialError,
      stale: this.stale,
      floors,
      otherRooms
    };
  }
});

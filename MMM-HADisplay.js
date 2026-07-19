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

  normalizeRgb(rgb) {
    const channels = rgb.map((channel) => Math.max(0, Number(channel) || 0));
    const maximum = Math.max(...channels);
    if (maximum === 0) {
      return [0, 0, 0];
    }
    const scale = maximum > 255 ? 255 / maximum : 1;
    return channels.map((channel) => Math.round(Math.min(255, channel * scale)));
  },

  hsToRgb(hs) {
    const hue = ((hs[0] % 360) + 360) % 360;
    const saturation = Math.max(0, Math.min(1, hs[1] / 100));
    const chroma = saturation;
    const segment = hue / 60;
    const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
    let rgb;

    if (segment < 1) rgb = [chroma, secondary, 0];
    else if (segment < 2) rgb = [secondary, chroma, 0];
    else if (segment < 3) rgb = [0, chroma, secondary];
    else if (segment < 4) rgb = [0, secondary, chroma];
    else if (segment < 5) rgb = [secondary, 0, chroma];
    else rgb = [chroma, 0, secondary];

    const match = 1 - chroma;
    return rgb.map((channel) => Math.round((channel + match) * 255));
  },

  xyToRgb(xy) {
    const [x, y] = xy;
    if (y <= 0) {
      return null;
    }

    const brightness = 1;
    const redLinear = (brightness / y) * (1.656492 * x - 0.354851 * y - 0.255038);
    const greenLinear = (brightness / y) * (-0.707196 * x + 1.655397 * y + 0.036152);
    const blueLinear = (brightness / y) * (0.051713 * x - 0.121364 * y + 1.01153 * (1 - x - y));
    const gammaCorrect = (channel) =>
      channel <= 0.0031308
        ? 12.92 * channel
        : 1.055 * Math.pow(Math.max(0, channel), 1 / 2.4) - 0.055;

    return this.normalizeRgb(
      [redLinear, greenLinear, blueLinear].map((channel) => gammaCorrect(channel) * 255)
    );
  },

  kelvinToRgb(kelvin) {
    const temperature = Math.max(1_000, Math.min(40_000, kelvin)) / 100;
    const red =
      temperature <= 66 ? 255 : 329.698727446 * Math.pow(temperature - 60, -0.1332047592);
    const green =
      temperature <= 66
        ? 99.4708025861 * Math.log(temperature) - 161.1195681661
        : 288.1221695283 * Math.pow(temperature - 60, -0.0755148492);
    const blue =
      temperature >= 66
        ? 255
        : temperature <= 19
          ? 0
          : 138.5177312231 * Math.log(temperature - 10) - 305.0447927307;
    return [red, green, blue].map((channel) =>
      Math.round(Math.max(0, Math.min(255, channel)))
    );
  },

  lightColorToRgb(color) {
    if (color.color_mode === "color_temp") {
      return null;
    }
    if (color.rgb) return this.normalizeRgb(color.rgb);
    if (color.rgbw) {
      return this.normalizeRgb([
        color.rgbw[0] + color.rgbw[3],
        color.rgbw[1] + color.rgbw[3],
        color.rgbw[2] + color.rgbw[3]
      ]);
    }
    if (color.rgbww) {
      const [red, green, blue, coldWhite, warmWhite] = color.rgbww;
      return this.normalizeRgb([
        red + coldWhite * 0.78 + warmWhite,
        green + coldWhite * 0.86 + warmWhite * 0.63,
        blue + coldWhite + warmWhite * 0.31
      ]);
    }
    if (color.hs) return this.hsToRgb(color.hs);
    if (color.xy) return this.xyToRgb(color.xy);
    return null;
  },

  rgbSaturation(rgb) {
    const maximum = Math.max(...rgb);
    const minimum = Math.min(...rgb);
    return maximum === 0 ? 0 : (maximum - minimum) / maximum;
  },

  softenRgb(rgb) {
    const colorWeight = 0.45;
    const neutral = 235;
    return rgb.map((channel) => Math.round(channel * colorWeight + neutral * (1 - colorWeight)));
  },

  getRepresentativeLightColor(colors) {
    const chromatic = colors
      .map((color) => {
        const rgb = this.lightColorToRgb(color);
        return rgb ? { rgb, saturation: this.rgbSaturation(rgb) } : null;
      })
      .filter((color) => color && color.saturation >= 0.08)
      .sort((left, right) => right.saturation - left.saturation);

    if (chromatic.length > 0) {
      return this.softenRgb(chromatic[0].rgb);
    }

    const kelvins = colors
      .filter((color) => color.color_mode === "color_temp")
      .map((color) => color.kelvin)
      .filter((kelvin) => Number.isFinite(kelvin) && kelvin > 0);
    if (kelvins.length === 0) {
      return null;
    }

    const averageKelvin = kelvins.reduce((sum, kelvin) => sum + kelvin, 0) / kelvins.length;
    return this.softenRgb(this.kelvinToRgb(averageKelvin));
  },

  prepareLighting(lighting) {
    if (!lighting.available) {
      return { className: "mmm-hadisplay-light-unavailable", style: "" };
    }
    if (!lighting.on) {
      return { className: "mmm-hadisplay-light-off", style: "" };
    }

    const rgb = this.getRepresentativeLightColor(lighting.colors);
    return {
      className: "mmm-hadisplay-light-on",
      style: rgb ? `color: rgb(${rgb.join(", ")})` : ""
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
      pm25: this.formatMeasurement(room.pm25, 0),
      lighting: this.prepareLighting(room.lighting)
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

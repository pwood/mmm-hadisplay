# MMM-HADisplay

`MMM-HADisplay` is a restrained [MagicMirror²](https://magicmirror.builders/) module that displays room climate readings, lighting state, and door security from Home Assistant. Rooms are grouped by Home Assistant floor, with areas that have no floor shown under **Other areas**. Colour is reserved for active climate adjustments and lights that are currently on.

The module posts a fixed Jinja template to Home Assistant's `/api/template` endpoint. For every area with at least one available climate reading, it shows the maximum current temperature and humidity from selected sensors, plus a PM2.5 air-quality indicator. Missing temperature and humidity values within an otherwise populated room are displayed as a dash.

## Requirements

- MagicMirror² 2.36 or newer
- Node.js 22.14 or newer
- Home Assistant 2024.4 or newer
- A Home Assistant long-lived access token

## Home Assistant setup

Create a Home Assistant label named exactly `Climate Source`. Apply it to either:

- Individual sensor entities that should contribute readings; or
- Devices whose sensor entities should contribute readings.

Selected entities must:

- Be in the `sensor` domain;
- Have the `temperature`, `humidity`, or `pm25` device class; and
- Belong to a Home Assistant area.

When several selected sensors of the same device class are in one area, the module displays the largest numeric state. Unknown, unavailable, and non-numeric states are ignored. Sensors without an area are omitted.

### Air quality

PM2.5 is displayed as a `fa-smog` icon whose colour reflects the largest selected reading in the area:

- Below 10 is low and uses the dimmed normal row text colour.
- From 10 to below 50 is medium and uses a muted yellow.
- At least 50 is high and uses a muted red.
- A very dim icon means no PM2.5 reading is available.

The exact reading, rounded to one decimal place, remains available as the icon's accessible label and tooltip.

### Active climate controls

Create a second label named exactly `Climate Control` and apply it to standard Home Assistant `climate` or `humidifier` entities, or to their parent devices. Climate controls are optional and never create a room by themselves.

When a selected controller is actively heating, cooling, humidifying, or drying, the corresponding current room measurement is highlighted. Idle and off controllers are not shown:

- Heating uses warm orange/red.
- Cooling uses ice blue.
- Humidifying and drying use light blue.

No target values or direction indicators are requested or displayed, keeping the table dimensions unchanged. If several controllers for the same measurement are active, the room still receives a single activity colour.

### Lighting

Create a third label named exactly `Lighting` and apply it to individual `light` or `switch` entities, or to their parent devices. The `switch` domain is supported for simple on/off lights whose integration does not expose a Home Assistant `light` entity. Lighting is optional. An area with selected lights receives a row even when it has no selected environmental sensors.

For a labelled device, the module selects all `light` entities and its primary `switch` entity. Auxiliary switches such as network indicators, turbo modes, and relay configuration controls are ignored. When an integration does not identify a primary switch, a device with exactly one switch uses that switch as a fallback. A directly labelled switch is always selected.

The lightbulb at the right of every displayed room indicates its lighting state:

- A very dim outlined bulb means the area has no selected light.
- A dim outlined bulb means the area has selected lights, but none is on.
- A solid bulb at normal brightness means at least one selected light is on.

When an active `light` entity reports a colour, the bulb receives a softened version of the most saturated active colour. If the active lights report only colour temperature, their current Kelvin values are averaged and shown as a subtle warm or cool tint. On/off lights exposed as either `light` or `switch`, and brightness-only lights, use the normal text colour. Brightness levels are intentionally ignored.

### Door security

Create a fourth label named exactly `Security` and apply it to `binary_sensor` entities—or their parent devices—that have **Shown as** set to **Door**. Door security is optional. An area with a selected security door receives a row even when it has no selected environmental sensors or lights.

The door icon to the right of the lightbulb summarizes every selected door in the area:

- A very dim closed door means the area has no selected security door, or its state is unavailable.
- A dim closed door means every selected door is off/closed and the room is clear.
- A solid open door at normal text brightness means at least one selected door is on/open and the room is not clear.

If one door is open while another is unavailable, the open state wins because the room is definitively not clear. If no door is open but any selected door is unavailable, the room is not reported as clear.

## Installation

Clone this repository into the MagicMirror `modules` directory:

```sh
cd ~/MagicMirror/modules
git clone https://github.com/pwood/mmm-hadisplay.git MMM-HADisplay
```

The module has no runtime npm dependencies, so no install command is needed on the mirror.

## Configuration

Add the module to `config/config.js`:

```js
{
  module: "MMM-HADisplay",
  position: "top_left",
  header: "Home Environment",
  config: {
    homeAssistantUrl: "http://homeassistant.local:8123",
    accessToken: "YOUR_LONG_LIVED_ACCESS_TOKEN",
    updateInterval: 60 * 1000
  }
}
```

| Option | Required | Default | Description |
| --- | --- | --- | --- |
| `homeAssistantUrl` | Yes | — | Home Assistant base URL using HTTP or HTTPS. |
| `accessToken` | Unless `HA_TOKEN` is set | `""` | Home Assistant long-lived access token. |
| `updateInterval` | No | `60000` | Polling interval in milliseconds. Invalid or non-positive values use the default. |

The standard MagicMirror `header` option is optional.

### Keeping the token out of browser-visible config

MagicMirror configuration is available to its browser client. Anyone who can inspect that page can read an `accessToken` stored in `config.js`.

For safer deployments, set `HA_TOKEN` in the environment of the process that starts MagicMirror and omit `accessToken` from the module config. `HA_TOKEN` takes precedence when both values exist. How the variable is supplied depends on how MagicMirror is launched; for a systemd service, add it through an environment file or an `Environment=` entry and protect that file appropriately.

The module sends Home Assistant requests only from its node helper and never logs the token.

## Display and refresh behaviour

- Data is requested immediately at startup and then once per `updateInterval`.
- The first successful table display fades in; subsequent refreshes update without a transition.
- Polling stops while the module is suspended and refreshes immediately when resumed.
- Rooms with neither a current environmental reading, a selected light, nor a selected security door are omitted. Light-only and security-only rooms show dashes for temperature and humidity plus an unavailable PM2.5 icon.
- The lightbulb column follows the `Lighting` label and is always present for every displayed room.
- The door column follows `Security`-labelled door binary sensors and is always present for every displayed room.
- Floor and room order is preserved as returned by Home Assistant.
- Temperature uses one decimal place and humidity uses whole numbers; their units are rendered smaller and superscript.
- Active climate-control colours are shown only while their Home Assistant action is heating, cooling, humidifying, or drying.
- After a transient error, the last successful table remains visible with a dimmed **Data unavailable** note.

## Troubleshooting

### Home Assistant data unavailable

Check that:

1. `homeAssistantUrl` is reachable from the machine running MagicMirror.
2. The token is present, valid, and not expired or revoked.
3. Home Assistant is version 2024.4 or newer.
4. The `Climate Source` label exists with the exact spelling and capitalization.

The MagicMirror server log contains a sanitized error with the HTTP status or failure category.

### A room shows dashes

Confirm that its sensors have supported device classes, valid numeric states, and either the entity or its device has the `Climate Source` label. A dash is expected when a metric is not available in that room.

### A sensor does not appear

Assign the entity or its parent device to a Home Assistant area. Sensors without an area are intentionally ignored.

### An active colour does not appear

Confirm that the `climate` or `humidifier` entity—or its parent device—has the exact `Climate Control` label, belongs to the same Home Assistant area, and reports an active action rather than `idle` or `off`.

### A lightbulb has the wrong state or tint

Confirm that the `light` or `switch` entity—or its parent device—has the exact `Lighting` label and belongs to the same Home Assistant area. The tint reflects current colour attributes from `light` entities that are on. Switch entities do not provide colour data, and some light integrations omit it as well.

For switch-based lights, prefer labelling the parent device or the exact relay entity. The module ignores named auxiliary switches exposed by the same device.

### A door has the wrong state

Confirm that the `binary_sensor` entity—or its parent device—has the exact `Security` label, belongs to the expected Home Assistant area, and has **Shown as** set to **Door**. Home Assistant exposes this setting as the entity's `device_class: door`; the underlying state remains `on` for open and `off` for closed.

## Development

Use Node.js 24 LTS:

```sh
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
npm install
npm run check
```

`npm run check` runs ESLint, Stylelint, and the mocked Node test suite. Tests do not contact a live Home Assistant instance.

## License

[MIT](LICENSE)

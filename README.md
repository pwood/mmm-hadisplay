# MMM-HADisplay

`MMM-HADisplay` is a monochrome [MagicMirror²](https://magicmirror.builders/) module that displays room climate readings from Home Assistant. Rooms are grouped by Home Assistant floor, with areas that have no floor shown under **Other rooms**.

The module posts a fixed Jinja template to Home Assistant's `/api/template` endpoint. For every area with at least one available climate reading, it shows the maximum current temperature, humidity, and PM2.5 value from selected sensors. Missing values within an otherwise populated room are displayed as a dash.

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
  header: "Home Climate",
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
- Polling stops while the module is suspended and refreshes immediately when resumed.
- Rooms with no current temperature, humidity, or PM2.5 value are omitted.
- Floor and room order is preserved as returned by Home Assistant.
- Temperature uses one decimal place; humidity and PM2.5 use whole numbers.
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

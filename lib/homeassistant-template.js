const HOME_ASSISTANT_TEMPLATE = String.raw`
{%- set climate = namespace(entities=label_entities('Climate Source') | list) -%}
{%- for device_id in label_devices('Climate Source') -%}
  {%- set climate.entities = climate.entities + device_entities(device_id) -%}
{%- endfor -%}
{%- set climate.entities = climate.entities | unique | list -%}
{%- set control = namespace(entities=label_entities('Climate Control') | list) -%}
{%- for device_id in label_devices('Climate Control') -%}
  {%- set control.entities = control.entities + device_entities(device_id) -%}
{%- endfor -%}
{%- set control.entities = control.entities | unique | list -%}
{%- set lights = namespace(entities=label_entities('Lighting') | list) -%}
{%- for device_id in label_devices('Lighting') -%}
  {%- set device_switches = namespace(all=[], primary=[]) -%}
  {%- for entity_id in device_entities(device_id) -%}
    {%- if entity_id[:6] == 'light.' -%}
      {%- set lights.entities = lights.entities + [entity_id] -%}
    {%- elif entity_id[:7] == 'switch.' -%}
      {%- set device_switches.all = device_switches.all + [entity_id] -%}
      {%- set entity_label = entity_name(entity_id) | default('', true) -%}
      {%- if entity_label == '' or state_attr(entity_id, 'friendly_name') == device_name(device_id) -%}
        {%- set device_switches.primary = device_switches.primary + [entity_id] -%}
      {%- endif -%}
    {%- endif -%}
  {%- endfor -%}
  {%- if device_switches.primary | length > 0 -%}
    {%- set lights.entities = lights.entities + device_switches.primary -%}
  {%- elif device_switches.all | length == 1 -%}
    {%- set lights.entities = lights.entities + device_switches.all -%}
  {%- endif -%}
{%- endfor -%}
{%- set lights.entities = lights.entities | unique | list -%}
{%- set security = namespace(entities=label_entities('Security') | list) -%}
{%- for device_id in label_devices('Security') -%}
  {%- set security.entities = security.entities + device_entities(device_id) -%}
{%- endfor -%}
{%- set security.entities = security.entities | unique | list -%}
{%- macro build_room(area_id) -%}
  {%- set entities = area_entities(area_id) -%}
  {%- set readings = namespace(temperature=none, humidity=none, pm25=none, temperature_value=none, humidity_value=none, pm25_value=none) -%}
  {%- for entity_id in entities -%}
    {%- if entity_id in climate.entities and entity_id[:7] == 'sensor.' and has_value(entity_id) and is_number(states(entity_id)) -%}
      {%- set device_class = state_attr(entity_id, 'device_class') -%}
      {%- set value = states(entity_id) | float -%}
      {%- set unit = state_attr(entity_id, 'unit_of_measurement') | default('', true) -%}
      {%- set measurement = dict(value=value, unit=unit) -%}
      {%- if device_class == 'temperature' and (readings.temperature_value is none or value > readings.temperature_value) -%}
        {%- set readings.temperature = measurement -%}
        {%- set readings.temperature_value = value -%}
      {%- elif device_class == 'humidity' and (readings.humidity_value is none or value > readings.humidity_value) -%}
        {%- set readings.humidity = measurement -%}
        {%- set readings.humidity_value = value -%}
      {%- elif device_class == 'pm25' and (readings.pm25_value is none or value > readings.pm25_value) -%}
        {%- set readings.pm25 = measurement -%}
        {%- set readings.pm25_value = value -%}
      {%- endif -%}
    {%- endif -%}
  {%- endfor -%}
  {%- set active_controls = namespace(items=[]) -%}
  {%- for entity_id in entities -%}
    {%- if entity_id in control.entities and has_value(entity_id) -%}
      {%- if entity_id[:8] == 'climate.' -%}
        {%- set action = state_attr(entity_id, 'hvac_action') -%}
        {%- if action in ['heating', 'preheating', 'cooling'] -%}
          {%- set normalized_action = 'heating' if action == 'preheating' else action -%}
          {%- set active_controls.items = active_controls.items + [dict(metric='temperature', action=normalized_action)] -%}
        {%- elif action == 'drying' -%}
          {%- set active_controls.items = active_controls.items + [dict(metric='humidity', action='drying')] -%}
        {%- endif -%}
      {%- elif entity_id[:11] == 'humidifier.' -%}
        {%- set action = state_attr(entity_id, 'action') -%}
        {%- if action in ['humidifying', 'drying'] -%}
          {%- set active_controls.items = active_controls.items + [dict(metric='humidity', action=action)] -%}
        {%- endif -%}
      {%- endif -%}
    {%- endif -%}
  {%- endfor -%}
  {%- set lighting = namespace(available=false, on=false, colors=[]) -%}
  {%- for entity_id in entities -%}
    {%- if entity_id in lights.entities and (entity_id[:6] == 'light.' or entity_id[:7] == 'switch.') -%}
      {%- set lighting.available = true -%}
      {%- if is_state(entity_id, 'on') -%}
        {%- set lighting.on = true -%}
        {%- if entity_id[:6] == 'light.' -%}
          {%- set lighting.colors = lighting.colors + [dict(color_mode=state_attr(entity_id, 'color_mode'), rgb=state_attr(entity_id, 'rgb_color'), rgbw=state_attr(entity_id, 'rgbw_color'), rgbww=state_attr(entity_id, 'rgbww_color'), hs=state_attr(entity_id, 'hs_color'), xy=state_attr(entity_id, 'xy_color'), kelvin=state_attr(entity_id, 'color_temp_kelvin'))] -%}
        {%- endif -%}
      {%- endif -%}
    {%- endif -%}
  {%- endfor -%}
  {%- set door_security = namespace(available=false, invalid=false, open=false) -%}
  {%- for entity_id in entities -%}
    {%- if entity_id in security.entities and entity_id[:14] == 'binary_sensor.' and state_attr(entity_id, 'device_class') == 'door' -%}
      {%- set door_security.available = true -%}
      {%- if is_state(entity_id, 'on') -%}
        {%- set door_security.open = true -%}
      {%- elif not is_state(entity_id, 'off') -%}
        {%- set door_security.invalid = true -%}
      {%- endif -%}
    {%- endif -%}
  {%- endfor -%}
  {%- set room_clear = false if door_security.open else (none if door_security.invalid or not door_security.available else true) -%}
  {%- if readings.temperature is not none or readings.humidity is not none or readings.pm25 is not none or lighting.available or door_security.available -%}
    {{- dict(id=area_id, name=area_name(area_id), temperature=readings.temperature, humidity=readings.humidity, pm25=readings.pm25, controls=active_controls.items, lighting=dict(available=lighting.available, on=lighting.on, colors=lighting.colors), security=dict(available=door_security.available, clear=room_clear)) | to_json -}}
  {%- else -%}
    {{- none | to_json -}}
  {%- endif -%}
{%- endmacro -%}
{%- set result = namespace(floors=[], assigned_areas=[], other_rooms=[]) -%}
{%- for floor_id in floors() -%}
  {%- set floor = namespace(rooms=[]) -%}
  {%- for area_id in floor_areas(floor_id) -%}
    {%- set result.assigned_areas = result.assigned_areas + [area_id] -%}
    {%- set room = build_room(area_id) | from_json -%}
    {%- if room is not none -%}
      {%- set floor.rooms = floor.rooms + [room] -%}
    {%- endif -%}
  {%- endfor -%}
  {%- if floor.rooms | length > 0 -%}
    {%- set result.floors = result.floors + [dict(id=floor_id, name=floor_name(floor_id), rooms=floor.rooms)] -%}
  {%- endif -%}
{%- endfor -%}
{%- for area_id in areas() -%}
  {%- if area_id not in result.assigned_areas -%}
    {%- set room = build_room(area_id) | from_json -%}
    {%- if room is not none -%}
      {%- set result.other_rooms = result.other_rooms + [room] -%}
    {%- endif -%}
  {%- endif -%}
{%- endfor -%}
{{- dict(floors=result.floors, other_rooms=result.other_rooms) | to_json -}}
`;

module.exports = { HOME_ASSISTANT_TEMPLATE };

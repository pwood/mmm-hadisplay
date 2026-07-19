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
{%- set result = namespace(floors=[], assigned_areas=[], other_rooms=[]) -%}
{%- for floor_id in floors() -%}
  {%- set floor = namespace(rooms=[]) -%}
  {%- for area_id in floor_areas(floor_id) -%}
    {%- set result.assigned_areas = result.assigned_areas + [area_id] -%}
    {%- set readings = namespace(temperature=none, humidity=none, pm25=none, temperature_value=none, humidity_value=none, pm25_value=none) -%}
    {%- for entity_id in area_entities(area_id) -%}
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
    {%- for entity_id in area_entities(area_id) -%}
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
    {%- if readings.temperature is not none or readings.humidity is not none or readings.pm25 is not none -%}
      {%- set floor.rooms = floor.rooms + [dict(id=area_id, name=area_name(area_id), temperature=readings.temperature, humidity=readings.humidity, pm25=readings.pm25, controls=active_controls.items)] -%}
    {%- endif -%}
  {%- endfor -%}
  {%- if floor.rooms | length > 0 -%}
    {%- set result.floors = result.floors + [dict(id=floor_id, name=floor_name(floor_id), rooms=floor.rooms)] -%}
  {%- endif -%}
{%- endfor -%}
{%- for area_id in areas() -%}
  {%- if area_id not in result.assigned_areas -%}
    {%- set readings = namespace(temperature=none, humidity=none, pm25=none, temperature_value=none, humidity_value=none, pm25_value=none) -%}
    {%- for entity_id in area_entities(area_id) -%}
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
    {%- for entity_id in area_entities(area_id) -%}
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
    {%- if readings.temperature is not none or readings.humidity is not none or readings.pm25 is not none -%}
      {%- set result.other_rooms = result.other_rooms + [dict(id=area_id, name=area_name(area_id), temperature=readings.temperature, humidity=readings.humidity, pm25=readings.pm25, controls=active_controls.items)] -%}
    {%- endif -%}
  {%- endif -%}
{%- endfor -%}
{{- dict(floors=result.floors, other_rooms=result.other_rooms) | to_json -}}
`;

module.exports = { HOME_ASSISTANT_TEMPLATE };

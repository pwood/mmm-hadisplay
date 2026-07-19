const HOME_ASSISTANT_TEMPLATE = String.raw`
{%- set climate = namespace(entities=label_entities('Climate Source') | list) -%}
{%- for device_id in label_devices('Climate Source') -%}
  {%- set climate.entities = climate.entities + device_entities(device_id) -%}
{%- endfor -%}
{%- set climate.entities = climate.entities | unique | list -%}
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
    {%- set floor.rooms = floor.rooms + [dict(id=area_id, name=area_name(area_id), temperature=readings.temperature, humidity=readings.humidity, pm25=readings.pm25)] -%}
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
    {%- set result.other_rooms = result.other_rooms + [dict(id=area_id, name=area_name(area_id), temperature=readings.temperature, humidity=readings.humidity, pm25=readings.pm25)] -%}
  {%- endif -%}
{%- endfor -%}
{{- dict(floors=result.floors, other_rooms=result.other_rooms) | to_json -}}
`;

module.exports = { HOME_ASSISTANT_TEMPLATE };

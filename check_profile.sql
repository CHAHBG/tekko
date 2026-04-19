SELECT json_extract(profile_json, '$.bio'), json_extract(profile_json, '$.location') FROM orders WHERE slug = 'fallou-06ccf6b03bda';

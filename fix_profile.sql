UPDATE orders SET profile_json = REPLACE(profile_json, '"location":"14.763115, -17.262683"', '"location":"14.762961, -17.263063"') WHERE slug = 'fallou-06ccf6b03bda';
UPDATE orders SET profile_json = REPLACE(profile_json, '"bio":"Eleveur de Ladoum depuis plus de 30 ans"', '"bio":"Eleveur de mouton de race Ladoum"') WHERE slug = 'fallou-06ccf6b03bda';

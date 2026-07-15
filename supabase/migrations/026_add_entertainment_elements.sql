-- 026: Add entertainment elements to the shared elements list
INSERT INTO elements (name, name_hi, sort_order) VALUES
  ('Generator', 'जनरेटर', 28),
  ('Stage', 'स्टेज', 29),
  ('Led Dance Floor', 'एलईडी डांस फ्लोर', 30),
  ('Jockey', 'जॉकी', 31),
  ('Techrider', 'टेक राइडर', 32),
  ('Confetti Paper', 'कंफेटी पेपर', 33),
  ('Spot Light', 'स्पॉट लाइट', 34),
  ('Dry Fog', 'ड्राई फॉग', 35),
  ('Sufi Band', 'सूफी बैंड', 36),
  ('DJ Based Band', 'डीजे आधारित बैंड', 37)
ON CONFLICT (name) DO NOTHING;

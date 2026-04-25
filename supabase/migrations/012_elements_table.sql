-- Dynamic elements table — admin-managed replacement for hardcoded ELEMENT_OPTIONS

CREATE TABLE IF NOT EXISTS elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  name_hi text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS policies (open access for anon, same pattern as other tables)
ALTER TABLE elements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "elements_select" ON elements FOR SELECT USING (true);
CREATE POLICY "elements_insert" ON elements FOR INSERT WITH CHECK (true);
CREATE POLICY "elements_update" ON elements FOR UPDATE USING (true);
CREATE POLICY "elements_delete" ON elements FOR DELETE USING (true);

-- Seed with the existing 27 elements (in the order they currently appear)
INSERT INTO elements (name, name_hi, sort_order) VALUES
  ('Coldpyros', 'कोल्डपायरो', 1),
  ('Coldpyro Guns', 'कोल्डपायरो गन्स', 2),
  ('Flower Shower', 'फ्लावर शॉवर', 3),
  ('Sparkle Machine', 'स्पार्कल मशीन', 4),
  ('CO2 Jets/Guns', 'CO2 जेट्स/गन्स', 5),
  ('Dhol', 'ढोल', 6),
  ('Live Band', 'लाइव बैंड', 7),
  ('Ghori Baggi', 'घोड़ी बग्गी', 8),
  ('Vintage Car', 'विंटेज कार', 9),
  ('Mascot', 'मस्कट', 10),
  ('Celebrity Artist', 'सेलिब्रिटी आर्टिस्ट', 11),
  ('Sky Shots', 'स्काई शॉट्स', 12),
  ('Color Sky Shot', 'कलर स्काई शॉट', 13),
  ('Color Bomb', 'कलर बम', 14),
  ('LED Screen', 'LED स्क्रीन', 15),
  ('Singer', 'सिंगर', 16),
  ('DJ', 'डीजे', 17),
  ('Percussionist', 'पर्क्यूशनिस्ट', 18),
  ('Lazer', 'लेज़र', 19),
  ('Bubble Machine', 'बबल मशीन', 20),
  ('Sound', 'साउंड', 21),
  ('Anchor', 'एंकर', 22),
  ('Paparazzi Artist', 'पापराज़ी आर्टिस्ट', 23),
  ('International Artist', 'इंटरनेशनल आर्टिस्ट', 24),
  ('Classical Dance Artist', 'क्लासिकल डांस आर्टिस्ट', 25),
  ('Molecular Bar', 'मॉलिक्यूलर बार', 26),
  ('Tattoo Artist', 'टैटू आर्टिस्ट', 27)
ON CONFLICT (name) DO NOTHING;

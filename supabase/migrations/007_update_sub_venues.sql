-- 007_update_sub_venues.sql — Update sub-venues for all venue categories from CRM data.
-- Run this in the Supabase SQL editor.

UPDATE categories SET sub_venues = '["Amber Lawn","Glass House","Amber Lawn + Glass House","Amber Lawn + Carnelian Deck","Glass House + Half Lawn","Carnelian Deck","Full Venue"]'::jsonb WHERE venue_id = 'ap';

UPDATE categories SET sub_venues = '["Emerald Lawn","Emerald + Glass House","Emerald + Banana Tree","Emerald + Glass House + Banana","Alstonia Lawn","Alstonia + Banana Tree","Alstonia + Banana Tree + Emerald","Glass House","Banana Tree Lawn","Full Venue"]'::jsonb WHERE venue_id = 'am';

UPDATE categories SET sub_venues = '["Aura Lawn","Aura Glass House + Lawn","Aura Glasshouse","Valencia Glass House","Valencia Glass House + Lawn","Valencia Glass House + Lawn + Poolside","Valencia Lawn + Poolside","Full Venue"]'::jsonb WHERE venue_id = 'ae';

UPDATE categories SET sub_venues = '["Restro-Lawn","Restro Glass House","Rooftop","Restro Lawn + Glass House","Restro Lawn + Rooftop","Full Venue"]'::jsonb WHERE venue_id = 'ar';

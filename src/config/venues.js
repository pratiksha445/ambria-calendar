// Venue / category configuration — mirrors ambria-knowledge-base.md §1.
// Hardcoded defaults used as fallback when the Supabase categories table
// is unreachable.  At runtime, App.jsx calls applyDynamic() to replace
// these with live data.  Because VENUES and VENUE_BY_ID are mutated
// in-place, every module that imports them sees the update automatically.

export const VENUES = [
  { id: 'ap',     name: 'Ambria Pushpanjali',    short: 'AP',    color: '#E0C84E', textColor: '#fff', subVenues: ['Amber Lawn', 'Glass House', 'Amber Lawn + Glass House', 'Amber Lawn + Carnelian Deck', 'Glass House + Half Lawn', 'Carnelian Deck', 'Full Venue'] },
  { id: 'am',     name: 'Ambria Manaktala',      short: 'AM',    color: '#E08E45', textColor: '#fff', subVenues: ['Emerald Lawn', 'Emerald + Glass House', 'Emerald + Banana Tree', 'Emerald + Glass House + Banana', 'Alstonia Lawn', 'Alstonia + Banana Tree', 'Alstonia + Banana Tree + Emerald', 'Glass House', 'Banana Tree Lawn', 'Full Venue'] },
  { id: 'ae',     name: 'Ambria Exotica',        short: 'AE',    color: '#B08560', textColor: '#fff', subVenues: ['Aura Lawn', 'Aura Glass House + Lawn', 'Aura Glasshouse', 'Valencia Glass House', 'Valencia Glass House + Lawn', 'Valencia Glass House + Lawn + Poolside', 'Valencia Lawn + Poolside', 'Full Venue'] },
  { id: 'ar',     name: 'Ambria Restro',         short: 'AR',    color: '#6088B5', textColor: '#fff', subVenues: ['Restro-Lawn', 'Restro Glass House', 'Rooftop', 'Restro Lawn + Glass House', 'Restro Lawn + Rooftop', 'Full Venue'] },
  { id: 'villa',  name: 'Villa',                 short: 'Villa', color: '#9A6BBE', textColor: '#fff', subVenues: ['AP Kothi', 'AM Kothi', 'AE Kothi', 'Sukoon'] },
  { id: 'add',    name: 'Ambria Design & Decor', short: 'ADD',   color: '#5FA8C4', textColor: '#fff', subVenues: [] },
  { id: 'ac',     name: 'Ambria Cuisine',        short: 'AC',    color: '#D8728A', textColor: '#fff', subVenues: [] },
  { id: 'aee',    name: 'Ambria Events',         short: 'AEE',   color: '#AD7EA5', textColor: '#fff', subVenues: [] },
  { id: 'tender', name: 'Tender',                short: 'TND',   color: '#68B078', textColor: '#fff', subVenues: [] },
]

export const VENUE_BY_ID = Object.fromEntries(VENUES.map((v) => [v.id, v]))

/** Replace VENUES & VENUE_BY_ID in-place with rows fetched from the DB */
export function applyDynamic(dbRows) {
  const mapped = dbRows.map((r) => ({
    id: r.venue_id,
    name: r.name,
    short: r.short_code,
    color: r.color,
    textColor: '#fff',
    subVenues: r.sub_venues ?? [],
  }))
  VENUES.length = 0
  VENUES.push(...mapped)
  Object.keys(VENUE_BY_ID).forEach((k) => delete VENUE_BY_ID[k])
  Object.assign(VENUE_BY_ID, Object.fromEntries(VENUES.map((v) => [v.id, v])))
}

// Shift badge colors — M=morning yellow, L=lunch orange, S=sundowner purple, D=dinner blue
export const SHIFT_BADGE = {
  Morning: { short: 'M', color: '#E8B94A' },
  Lunch: { short: 'L', color: '#E8844A' },
  Sundowner: { short: 'S', color: '#9B6DD7' },
  Dinner: { short: 'D', color: '#4A6FD9' },
}

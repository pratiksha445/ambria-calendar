// Venue / category configuration — mirrors ambria-knowledge-base.md §1.
// Hardcoded defaults used as fallback when the Supabase categories table
// is unreachable.  At runtime, App.jsx calls applyDynamic() to replace
// these with live data.  Because VENUES and VENUE_BY_ID are mutated
// in-place, every module that imports them sees the update automatically.

export const VENUES = [
  { id: 'ap',     name: 'Ambria Pushpanjali',    short: 'AP',    color: '#FFE263', textColor: '#1A1A1A', subVenues: ['Amber Lawn', 'Glass House', 'Amber Lawn + Glass House', 'Amber Lawn + Carnelian Deck', 'Glass House + Half Lawn', 'Carnelian Deck', 'Full Venue'] },
  { id: 'am',     name: 'Ambria Manaktala',      short: 'AM',    color: '#FF9430', textColor: '#1A1A1A', subVenues: ['Emerald Lawn', 'Emerald + Glass House', 'Emerald + Banana Tree', 'Emerald + Glass House + Banana', 'Alstonia Lawn', 'Alstonia + Banana Tree', 'Alstonia + Banana Tree + Emerald', 'Glass House', 'Banana Tree Lawn', 'Full Venue'] },
  { id: 'ae',     name: 'Ambria Exotica',        short: 'AE',    color: '#A3785E', textColor: '#fff', subVenues: ['Aura Lawn', 'Aura Glass House + Lawn', 'Aura Glasshouse', 'Aura Porch', 'Valencia Glass House', 'Valencia Glass House + Lawn', 'Valencia Glass House + Lawn + Poolside', 'Valencia Lawn + Poolside', 'Valencia Porch', 'Full Venue'] },
  { id: 'ar',     name: 'Ambria Restro',         short: 'AR',    color: '#9CAF88', textColor: '#1A1A1A', subVenues: ['Restro-Lawn', 'Restro Glass House', 'Rooftop', 'Cafe', 'Restro Lawn + Glass House', 'Restro Lawn + Rooftop', 'Full Venue'] },
  { id: 'villa',  name: 'Villa',                 short: 'Villa', color: '#944547', textColor: '#fff', subVenues: ['AP Kothi', 'AM Kothi', 'AE Kothi', 'Sukoon'] },
  { id: 'add',    name: 'Ambria Design & Decor', short: 'ADD',   color: '#ADD8E6', textColor: '#1A1A1A', subVenues: [] },
  { id: 'ac',     name: 'Ambria Cuisine',        short: 'AC',    color: '#D8728A', textColor: '#fff', subVenues: [] },
  { id: 'aee',    name: 'Ambria Events',         short: 'AEE',   color: '#AD7EA5', textColor: '#fff', subVenues: [] },
  { id: 'ws',     name: 'Wedding Services',      short: 'WS',    color: '#FFB8B0', textColor: '#1A1A1A', subVenues: [] },
  { id: 'tender', name: 'Tender',                short: 'TND',   color: '#2F4C39', textColor: '#fff', subVenues: [] },
]

export const VENUE_BY_ID = Object.fromEntries(VENUES.map((v) => [v.id, v]))

/** Compute contrasting text color for a hex background */
export function contrastText(hex) {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16) / 255
  const g = parseInt(c.substring(2, 4), 16) / 255
  const b = parseInt(c.substring(4, 6), 16) / 255
  const toLinear = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  return L > 0.4 ? '#1A1A1A' : '#fff'
}

/** Replace VENUES & VENUE_BY_ID in-place with rows fetched from the DB */
export function applyDynamic(dbRows) {
  const mapped = dbRows.map((r) => ({
    id: r.venue_id,
    name: r.name,
    short: r.short_code,
    color: r.color,
    textColor: contrastText(r.color),
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

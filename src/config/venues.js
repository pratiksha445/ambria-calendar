// Venue / category configuration — mirrors ambria-knowledge-base.md §1.
// Edit here to change colors, names, or sub-venue lists across the app.

export const VENUES = [
  {
    id: 'ap',
    name: 'Ambria Pushpanjali',
    short: 'AP',
    color: '#E0C84E',
    textColor: '#fff',
    subVenues: ['Whole Venue', 'Amber Lawn', 'Banquet'],
  },
  {
    id: 'am',
    name: 'Ambria Manaktala',
    short: 'AM',
    color: '#E08E45',
    textColor: '#fff',
    subVenues: ['Full Venue', 'Emerald Lawn', 'Banquet', 'Alstonia Lawn', 'Banana Lawn'],
  },
  {
    id: 'ae',
    name: 'Ambria Exotica',
    short: 'AE',
    color: '#B08560',
    textColor: '#fff',
    subVenues: ['Aura', 'Aura Banquet', 'Valencia', 'Valencia Banquet', 'Poolside'],
  },
  {
    id: 'ar',
    name: 'Ambria Restro',
    short: 'AR',
    color: '#6088B5',
    textColor: '#fff',
    subVenues: ['Whole Venue', 'Glasshouse', 'Lawn', 'Rooftop'],
  },
  {
    id: 'villa',
    name: 'Villa',
    short: 'Villa',
    color: '#9A6BBE',
    textColor: '#fff',
    subVenues: ['AP Kothi', 'AM Kothi', 'AE Kothi'],
  },
  {
    id: 'add',
    name: 'Ambria Design & Decor',
    short: 'ADD',
    color: '#5FA8C4',
    textColor: '#fff',
    subVenues: [],
  },
  {
    id: 'ac',
    name: 'Ambria Cuisine',
    short: 'AC',
    color: '#D8728A',
    textColor: '#fff',
    subVenues: [],
  },
  {
    id: 'aee',
    name: 'Ambria Events',
    short: 'AEE',
    color: '#AD7EA5',
    textColor: '#fff',
    subVenues: [],
  },
  {
    id: 'tender',
    name: 'Tender',
    short: 'TND',
    color: '#68B078',
    textColor: '#fff',
    subVenues: [],
  },
]

export const VENUE_BY_ID = Object.fromEntries(VENUES.map((v) => [v.id, v]))

// Shift badge colors — M=morning yellow, L=lunch orange, S=sundowner purple, D=dinner blue
export const SHIFT_BADGE = {
  Morning: { short: 'M', color: '#E8B94A' },
  Lunch: { short: 'L', color: '#E8844A' },
  Sundowner: { short: 'S', color: '#9B6DD7' },
  Dinner: { short: 'D', color: '#4A6FD9' },
}

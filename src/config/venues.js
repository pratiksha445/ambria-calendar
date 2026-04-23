// Venue / category configuration — mirrors ambria-knowledge-base.md §1.
// Edit here to change colors, names, or sub-venue lists across the app.

export const VENUES = [
  {
    id: 'ap',
    name: 'Ambria Pushpanjali',
    short: 'AP',
    color: '#F5E6A3',
    textColor: '#8B7B2A',
    subVenues: ['Whole Venue', 'Amber Lawn', 'Banquet'],
  },
  {
    id: 'am',
    name: 'Ambria Manaktala',
    short: 'AM',
    color: '#F5C9A3',
    textColor: '#8B5E2A',
    subVenues: ['Full Venue', 'Emerald Lawn', 'Banquet', 'Alstonia Lawn', 'Banana Lawn'],
  },
  {
    id: 'ae',
    name: 'Ambria Exotica',
    short: 'AE',
    color: '#D4B3D8',
    textColor: '#6B3D6F',
    subVenues: ['Aura', 'Aura Banquet', 'Valencia', 'Valencia Banquet', 'Poolside'],
  },
  {
    id: 'ar',
    name: 'Ambria Restro',
    short: 'AR',
    color: '#A3B5D4',
    textColor: '#3D5175',
    subVenues: ['Whole Venue', 'Glasshouse', 'Lawn', 'Rooftop'],
  },
  {
    id: 'villa',
    name: 'Villa',
    short: 'Villa',
    color: '#C4A3E0',
    textColor: '#5C3A7A',
    subVenues: ['AP Kothi', 'AM Kothi', 'AE Kothi'],
  },
  {
    id: 'add',
    name: 'Ambria Design & Decor',
    short: 'ADD',
    color: '#A3D4E8',
    textColor: '#2A6B8B',
    subVenues: [],
  },
  {
    id: 'ac',
    name: 'Ambria Cuisine',
    short: 'AC',
    color: '#F0B3C0',
    textColor: '#8B2A4A',
    subVenues: [],
  },
  {
    id: 'aee',
    name: 'Ambria Events',
    short: 'AEE',
    color: '#D4C0A8',
    textColor: '#6B5438',
    subVenues: [],
  },
  {
    id: 'tender',
    name: 'Tender',
    short: 'TND',
    color: '#A8D8B0',
    textColor: '#3A6B42',
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

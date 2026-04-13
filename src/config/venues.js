// Venue / category configuration — mirrors ambria-knowledge-base.md §1.
// Edit here to change colors, names, or sub-venue lists across the app.

export const VENUES = [
  {
    id: 'ap',
    name: 'Ambria Pushpanjali',
    short: 'AP',
    color: '#E85D75',
    subVenues: ['Whole Venue', 'Amber Lawn', 'Banquet'],
  },
  {
    id: 'am',
    name: 'Ambria Manaktala',
    short: 'AM',
    color: '#4A90D9',
    subVenues: ['Full Venue', 'Emerald Lawn', 'Banquet', 'Alstonia Lawn', 'Banana Lawn'],
  },
  {
    id: 'ae',
    name: 'Ambria Exotica',
    short: 'AE',
    color: '#9B6DD7',
    subVenues: ['Aura', 'Aura Banquet', 'Valencia', 'Valencia Banquet', 'Poolside'],
  },
  {
    id: 'ar',
    name: 'Ambria Restro',
    short: 'AR',
    color: '#2ECC71',
    subVenues: ['Whole Venue', 'Glasshouse', 'Lawn', 'Rooftop'],
  },
  {
    id: 'villa',
    name: 'Villa',
    short: 'Villa',
    color: '#E67E22',
    subVenues: ['AP Kothi', 'AM Kothi', 'AE Kothi'],
  },
  {
    id: 'add',
    name: 'Ambria Design & Decor',
    short: 'ADD',
    color: '#D4B83D',
    subVenues: [],
  },
  {
    id: 'ac',
    name: 'Ambria Cuisine',
    short: 'AC',
    color: '#E74C3C',
    subVenues: [],
  },
  {
    id: 'aee',
    name: 'Ambria Events',
    short: 'AEE',
    color: '#3498DB',
    subVenues: [],
  },
  {
    id: 'tender',
    name: 'Tender',
    short: 'TND',
    color: '#95A5A6',
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

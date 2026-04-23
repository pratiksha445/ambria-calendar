// Venue / category configuration — mirrors ambria-knowledge-base.md §1.
// Edit here to change colors, names, or sub-venue lists across the app.

export const VENUES = [
  {
    id: 'ap',
    name: 'Ambria Pushpanjali',
    short: 'AP',
    color: '#EED971',
    textColor: '#7A6B1E',
    subVenues: ['Whole Venue', 'Amber Lawn', 'Banquet'],
  },
  {
    id: 'am',
    name: 'Ambria Manaktala',
    short: 'AM',
    color: '#F0A86E',
    textColor: '#7A4A1E',
    subVenues: ['Full Venue', 'Emerald Lawn', 'Banquet', 'Alstonia Lawn', 'Banana Lawn'],
  },
  {
    id: 'ae',
    name: 'Ambria Exotica',
    short: 'AE',
    color: '#C9A07A',
    textColor: '#5C3D1E',
    subVenues: ['Aura', 'Aura Banquet', 'Valencia', 'Valencia Banquet', 'Poolside'],
  },
  {
    id: 'ar',
    name: 'Ambria Restro',
    short: 'AR',
    color: '#7A9EC7',
    textColor: '#2A4A6B',
    subVenues: ['Whole Venue', 'Glasshouse', 'Lawn', 'Rooftop'],
  },
  {
    id: 'villa',
    name: 'Villa',
    short: 'Villa',
    color: '#B085D0',
    textColor: '#4E2A6B',
    subVenues: ['AP Kothi', 'AM Kothi', 'AE Kothi'],
  },
  {
    id: 'add',
    name: 'Ambria Design & Decor',
    short: 'ADD',
    color: '#7ABCD4',
    textColor: '#1E5A72',
    subVenues: [],
  },
  {
    id: 'ac',
    name: 'Ambria Cuisine',
    short: 'AC',
    color: '#E88FA0',
    textColor: '#7A1E35',
    subVenues: [],
  },
  {
    id: 'aee',
    name: 'Ambria Events',
    short: 'AEE',
    color: '#C29AB8',
    textColor: '#5C2E4E',
    subVenues: [],
  },
  {
    id: 'tender',
    name: 'Tender',
    short: 'TND',
    color: '#82C48E',
    textColor: '#2A5C32',
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

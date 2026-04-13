import { supabase } from './supabase.js'
import { toIsoDate, addDays } from './dates.js'

// One-shot sample data: inserted on first load only (when events table is empty)
// so the calendar has something visual to show during Phase 3 review.

function offsetIso(days) {
  return toIsoDate(addDays(new Date(), days))
}

const SAMPLES = [
  {
    offset: 1,
    venue_id: 'add', venue_name: 'Hotel Taj', venue_type: 'Lawn', location: 'Delhi',
    event_type: 'Mehendi', status: 'Confirmed', shift: 'Morning', time: '10:00',
    decor_type: 'Gold', guest_name: 'Sharma', phone: '9876543215', sales_person: 'Rahul',
    title: 'Sharma | Mehendi | Hotel Taj | M',
    source: 'crm', crm_id: 'seed-add-1',
  },
  {
    offset: 2,
    venue_id: 'ap', sub_venue: 'Amber Lawn', event_type: 'Wedding', status: 'Confirmed',
    shift: 'Dinner', time: '19:00', guest_name: 'Sharma', phone: '9876543210', pax: '500',
    sales_person: 'Rahul', booking_status: 'VMD', menu_type: 'Non-Veg', menu_cat: 'DMNV',
    fp_status: 'Released',
    title: 'Sharma | Wedding | 500pax | D | DMNV',
    source: 'crm', crm_id: 'seed-ap-1',
  },
  {
    offset: 3,
    venue_id: 'ac', venue_name: 'ITC Grand', venue_type: 'Banquet', event_type: 'Corporate',
    status: 'Confirmed', shift: 'Lunch', time: '13:00', menu_type: 'Veg', menu_cat: 'LV',
    guest_name: 'Agrawal', phone: '9876543216', pax: '200', sales_person: 'Priya',
    title: 'Agrawal | Corporate | ITC Grand | L',
    source: 'manual',
  },
  {
    offset: 4,
    venue_id: 'am', sub_venue: 'Emerald Lawn', event_type: 'Reception', status: 'Confirmed',
    shift: 'Sundowner', time: '17:00', guest_name: 'Gupta', phone: '9876543211', pax: '300',
    sales_person: 'Priya', booking_status: 'Rental + Decor',
    title: 'Gupta | Reception | 300pax | S',
    source: 'manual',
  },
  {
    offset: 5,
    venue_id: 'ae', sub_venue: 'Aura', event_type: 'Cocktail', status: 'Tentative',
    shift: 'Sundowner', time: '18:30', guest_name: 'Mehta', phone: '9876543212', pax: '150',
    sales_person: 'Arjun', booking_status: 'VMD', menu_type: 'Veg', menu_cat: 'MV',
    fp_status: 'Delayed by guest',
    title: 'Mehta | Cocktail | 150pax | S | MV',
    source: 'crm', crm_id: 'seed-ae-1',
  },
  {
    offset: 6,
    venue_id: 'aee', venue_name: 'Convention Center', venue_type: 'Banquet',
    event_type: 'Conference', status: 'Confirmed', shift: 'Morning', time: '09:00',
    guest_name: 'Desai', phone: '9876543217', sales_person: 'Arjun',
    title: 'Desai | Conference | Convention Center | M',
    source: 'crm', crm_id: 'seed-aee-1',
  },
  {
    offset: 7,
    venue_id: 'ar', sub_venue: 'Rooftop', event_type: 'Birthday', status: 'Confirmed',
    shift: 'Dinner', time: '20:00', guest_name: 'Verma', phone: '9876543213', pax: '50',
    sales_person: 'Nisha', booking_status: 'Only Rental',
    title: 'Verma | Birthday | 50pax | D',
    source: 'manual',
  },
  {
    offset: 8,
    venue_id: 'tender', venue_name: 'Govt Auditorium', event_type_text: 'Wedding Catering',
    status: 'Tentative', tender_name: 'Singh',
    title: 'Singh | Wedding Catering | Govt Auditorium',
    source: 'manual',
  },
  {
    offset: 9,
    venue_id: 'ap', sub_venue: 'Banquet', event_type: 'Anniversary', status: 'Confirmed',
    shift: 'Lunch', time: '12:30', guest_name: 'Bhatia', phone: '9876543218', pax: '80',
    sales_person: 'Nisha', booking_status: 'VMD', menu_type: 'Veg', menu_cat: 'MV',
    fp_status: 'Not Released',
    title: 'Bhatia | Anniversary | 80pax | L | MV',
    source: 'manual',
  },
  {
    offset: 10,
    villa: true, // triggers check-in/out fields below
    venue_id: 'villa', sub_venue: 'AP Kothi', status: 'Confirmed',
    guest_name: 'Kapoor', phone: '9876543214', pax: '8', sales_person: 'Rahul',
    pool_included: 'Yes', meal_included: 'All Meals',
    title: 'Kapoor — AP Kothi',
    source: 'crm', crm_id: 'seed-villa-1',
  },
]

export async function seedIfEmpty() {
  const { count, error } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })

  if (error) throw error
  if ((count ?? 0) > 0) return { seeded: false, count }

  const rows = SAMPLES.map(({ offset, villa, ...rest }) => {
    const date = offsetIso(offset)
    const row = { ...rest, date }
    if (villa) {
      row.check_in_date = date
      row.check_out_date = offsetIso(offset + 2)
      row.check_in_time = '14:00'
      row.check_out_time = '11:00'
    }
    return row
  })

  const { error: insertErr } = await supabase.from('events').insert(rows)
  if (insertErr) throw insertErr
  return { seeded: true, count: rows.length }
}

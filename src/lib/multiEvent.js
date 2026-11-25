// Multi-Event grouping for our own venues (AP / AM / AE / AR).
//
// A guest's functions at one venue on one day (Haldi lunch + Wedding dinner)
// are separate bookings in the database: each keeps its own shift, lawn,
// menu, F&B / decor status and LMS link. On screen they are shown as one
// "Multi-Event" card instead, like the ADD / AC / AEE multi-event bookings.
//
// Only on the same venue, day and sub-venue (lawn): a guest's functions on
// two different lawns stay as separate cards.
// Same guest = same LMS contract, or the same full name (two different LMS
// contracts never merge). Phone is not used: office / planner numbers sit on
// many different guests' bookings.
// Display only: nothing here changes what is stored.

const OWN_VENUES = new Set(['ap', 'am', 'ae', 'ar'])

function fullName(v) {
  return String(v || '').toLowerCase().replace(/\b(mr|mrs|ms|dr|shri|smt|miss)\b\.?/g, '').replace(/[^a-z]/g, '')
}

/** "lms:venue:00522:3-2026-11-23-Dinner" → "00522" */
function contractNo(crmId) {
  const m = /^lms:venue:([^:]+):/.exec(crmId || '')
  return m ? m[1] : ''
}

/** venue + day + sub-venue: only bookings sharing all three can group */
function place(e) {
  return e.venue_id + '|' + e.date + '|' + String(e.sub_venue || '').trim().toLowerCase().replace(/\s+/g, ' ') + '|'
}

function byTime(a, b) {
  const order = { Morning: 0, Lunch: 1, Sundowner: 2, Dinner: 3 }
  const ta = a.time || '', tb = b.time || ''
  if (ta && tb && ta !== tb) return ta.localeCompare(tb)
  return (order[a.shift] ?? 9) - (order[b.shift] ?? 9)
}

/**
 * Turn a day's events into display items, in the original order:
 *   { event }                         a booking shown on its own
 *   { group: true, events: [...] }    two or more functions of one guest
 * Setup / clearance entries and cancelled bookings are never grouped.
 */
export function groupMultiEvents(events) {
  const groupable = (e) => OWN_VENUES.has(e.venue_id) && !e._scType && e.status !== 'Cancelled'
  const groupOf = new Map() // event → its group (array)
  const byContract = new Map(), byName = new Map()

  // 1. Bookings of one LMS contract (same venue + date)
  for (const e of events) {
    if (!groupable(e) || !contractNo(e.crm_id)) continue
    const k = place(e) + contractNo(e.crm_id)
    if (!byContract.has(k)) byContract.set(k, [])
    byContract.get(k).push(e)
    groupOf.set(e, byContract.get(k))
  }
  // 2. Hand-entered bookings join the one group with the same guest name
  //    (contract groups first; two contract groups of that name → left alone)
  for (const e of events) {
    if (!groupable(e) || groupOf.has(e) || !fullName(e.guest_name)) continue
    const k = place(e) + fullName(e.guest_name)
    const contractHits = [...byContract.entries()]
      .filter(([ck, list]) => ck.startsWith(place(e)) && list.some((x) => fullName(x.guest_name) === fullName(e.guest_name)))
    let g = null
    if (contractHits.length === 1) g = contractHits[0][1]
    else if (contractHits.length === 0) {
      if (!byName.has(k)) byName.set(k, [])
      g = byName.get(k)
    }
    if (!g) continue
    g.push(e)
    groupOf.set(e, g)
  }

  // Same order as given; a group appears where its first booking was
  const items = []
  const placed = new Set()
  for (const e of events) {
    const g = groupOf.get(e)
    if (!g || g.length < 2) { items.push({ event: e }); continue }
    if (placed.has(g)) continue
    placed.add(g)
    items.push({ group: true, events: [...g].sort(byTime) })
  }
  return items
}

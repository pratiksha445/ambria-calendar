// LMS → Calendar auto-sync. Runs on a pg_cron schedule (migration 029) and
// pulls every LMS contract (Venue, Decor, Catering, Entertainment) for today
// onward into the events table.
//
// One person = one booking: a Venue contract function becomes one booking at
// AP/AM/AE/AR, and that same guest's Decor / Entertainment / Catering contract
// at our own venue (matched on phone + date) is folded into it (decor_status /
// entertainment_status = 'Closure', blank menu filled) instead of becoming a
// separate entry.
// Decor / Catering / Entertainment at outside venues become ADD / AC / AEE
// bookings, exactly as the manual "Fetch from LMS" button builds them.
//
// Rules:
// - Linked by crm_id ("lms:..."); bookings stay source='manual' so staff can
//   still edit them. LMS-owned fields are refreshed from LMS on every run;
//   blank LMS values never wipe what staff typed.
// - A booking someone already entered by hand (same venue + date + phone or
//   name) is adopted instead of duplicated. Ambiguous matches are skipped and
//   reported, never guessed.
// - Deleted (soft, deleted_at) ONLY when LMS marks the contract cancelled
//   (cancel_remarks). A contract merely missing from LMS's list is never
//   deleted: LMS's list endpoint is known to drop live contracts.
// - A booking staff deleted in the calendar is never resurrected.
//
// Call: POST. The cron job (every 5 min) and the calendar's "Sync Now"
// button both land here; lms_sync_claim() lets only one run at a time.
// ?dry=1 with header x-cron-secret: <lms_sync_state.cron_secret> returns the full plan
// without writing anything.
// No imports on purpose, so it can be pasted straight into the dashboard.

const LMS_BASE = "https://gyv.inqcrm.in/api/v1/processerp_api/"
const PAGE_SIZE = 10
const MAX_PAGES = 300
const FETCH_TIMEOUT_MS = 12000
const PAGES_AT_ONCE = 4

type Row = Record<string, any>
type Ev = Record<string, any>

const DEPTS: Record<string, { endpoint: string; body: Record<string, string>; p: string; d: string; entry: string; date: string; func: string; time: string; contact: string }> = {
  venue: {
    endpoint: "get_venue_contract_information_list",
    body: { search_venue_contract: "", priority_search: "", venue_datetype: "", source_search: "", venue_search: "", balance_pending: "", contract_venue_search: "", contract_assginee_search: "", leadtype_search: "", report_fac: "", fromdate: "", uptodated: "" },
    p: "fisc_", d: "fiscd_", entry: "fisc_entryno", date: "fiscd_function_date", func: "fiscd_function_type", time: "fiscd_function_timings", contact: "fisc_client_mobile",
  },
  decor: {
    endpoint: "get_decor_contract_information_list",
    body: { decor_search: "", source_search: "", lead_type_search: "", decor_venue_search: "", priority_search: "", fromdate: "", uptodated: "", decor_assginee_search: "", decor_status_search: "", search_date_type: "", visited_search: "", follow_dated: "" },
    p: "dhc_", d: "dhcd_", entry: "dhc_entry_no", date: "dhcd_date", func: "dhcd_function", time: "dhcd_time", contact: "dhc_contact_no",
  },
  catering: {
    endpoint: "get_catering_contract_information_list",
    body: { search_catering_contract: "", priority_search: "", cater_datetype: "", source_search: "", balance_pending: "", contract_catering_search: "", contract_assginee_search: "", leadtype_search: "", report_fac: "", fromdate: "", uptodated: "" },
    p: "chc_", d: "chcd_", entry: "chc_entry_no", date: "chcd_date", func: "chcd_function", time: "chcd_time", contact: "chc_contact_no",
  },
  entertainment: {
    endpoint: "get_entertain_contract_information_list",
    body: { fromdate: "", uptodated: "", search_entertain_contract: "", source_search: "", contract_venue_searche: "", balance_pending: "", contract_assginee_search: "", entertain_datetype: "", leadtype_search: "", report_fac: "" },
    p: "ehc_", d: "ehcd_", entry: "ehc_entry_no", date: "ehcd_date", func: "ehcd_function", time: "ehcd_time", contact: "ehc_contact_no",
  },
}

// LMS venue id / name → calendar category
const LMS_VENUE_TO_CAT: Record<string, string> = { "3": "ap", "6": "am", "19": "ae", "16": "ar" }
const OWN_VENUE_NAMES: Record<string, string> = {
  "ambria pushpanjali": "ap", "manaktala farm": "am", "ambria manaktala": "am",
  "ambria exotica": "ae", "ambria restro": "ar",
}
const OUTDOOR_CAT: Record<string, string> = { decor: "add", catering: "ac", entertainment: "aee" }

// LMS fiscd_location_id → calendar sub-venue (config/venues.js). Ids with no
// clean calendar equivalent (Villa, Aura Pandal, ...) are left out on purpose
// so the sub-venue staff picked is kept.
const LOCATION_TO_SUB_VENUE: Record<string, string> = {
  "21": "Amber Lawn + Glass House", "22": "Amber Lawn", "23": "Glass House", "24": "Carnelian Deck",
  "26": "Emerald Lawn", "27": "Emerald + Glass House", "29": "Alstonia Lawn", "30": "Glass House",
  "31": "Banana Tree Lawn", "41": "Emerald + Glass House + Banana", "47": "Alstonia + Banana Tree",
  "53": "Emerald + Banana Tree",
  "37": "Aura Lawn", "39": "Valencia Glass House", "46": "Valencia Glass House + Lawn",
  "51": "Valencia Lawn + Poolside", "52": "Full Venue",
  "42": "Cafe", "43": "Restro-Lawn", "44": "Restro Glass House", "45": "Rooftop",
  "48": "Restro Lawn + Glass House", "49": "Restro Glass House", "50": "Restro Glass House",
}

// ── Field mapping (mirrors src/lib/lms.js so sync and the manual button agree) ──

const FUNC_TYPE_MAP: Record<string, { type: string; other?: string }> = {
  "1": { type: "Other", other: "Ring Ceremony" }, "2": { type: "Birthday" }, "3": { type: "Wedding" },
  "4": { type: "Reception" }, "5": { type: "Other", other: "Kua Poojan" }, "6": { type: "Anniversary" },
  "7": { type: "Other", other: "Lagan" }, "8": { type: "Sagan" }, "9": { type: "Cocktail" },
  "10": { type: "Religious Event" }, "11": { type: "Corporate" }, "12": { type: "Other", other: "Proposal" },
  "14": { type: "Haldi" }, "15": { type: "Mehendi" }, "16": { type: "Other", other: "Roka Ceremony" },
  "17": { type: "Other", other: "Residential Wedding" }, "18": { type: "Other", other: "Destination Wedding" },
  "19": { type: "Other", other: "Kothi Booking" }, "20": { type: "Other", other: "Sangeet" },
  "21": { type: "Baby Shower" }, "22": { type: "Engagement" }, "23": { type: "Other" },
  "24": { type: "Other", other: "Barat Assembly" }, "25": { type: "Other", other: "House Party" },
  "26": { type: "Other", other: "Lunch Function" }, "27": { type: "Other", other: "Breakfast Function" },
  "28": { type: "Other", other: "Dinner Function" }, "29": { type: "Other", other: "Breakfast" },
  "30": { type: "Other", other: "Lunch" }, "31": { type: "Other", other: "Kitty Party" },
  "32": { type: "Other", other: "Restaurant Sale" }, "33": { type: "Other", other: "Lohri" },
  "34": { type: "Other", other: "Diwali Party" }, "35": { type: "Social Gathering" }, "36": { type: "Religious Event" },
}

const KNOWN_EVENT_TYPES = [
  "Anand Karaj", "Anniversary", "Baby Shower", "Birthday", "Cocktail", "Conference", "Corporate",
  "Engagement", "Exhibition", "Haldi", "Intimate Gathering", "Kirtan", "Mehendi", "Nikah", "Proposal",
  "Reception", "Religious Event", "Sagan", "Social Gathering", "Wedding", "Other",
]

function titleCase(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ""
}

function mapEventType(funcId: any, funcName: any) {
  const name = String(funcName || "").trim()
  const mapped = FUNC_TYPE_MAP[String(funcId || "")]
  if (mapped) {
    return { event_type: mapped.type, event_type_other: mapped.other || (mapped.type === "Other" && name ? titleCase(name) : "") }
  }
  if (name) {
    const known = KNOWN_EVENT_TYPES.find((t) => t.toLowerCase() === name.toLowerCase())
    return known ? { event_type: known, event_type_other: "" } : { event_type: "Other", event_type_other: titleCase(name) }
  }
  return { event_type: "", event_type_other: "" }
}

function mapSession(session: any, time: any) {
  if (["Lunch", "Dinner", "Morning", "Sundowner"].includes(session)) return session
  const m = String(time || "").match(/^(\d{1,2})/)
  if (!m) return ""
  const h = parseInt(m[1], 10)
  return h < 12 ? "Morning" : h < 15 ? "Lunch" : h < 17 ? "Sundowner" : "Dinner"
}

function menuCatFromName(menuName: any, isVeg: boolean) {
  const n = String(menuName || "").toLowerCase()
  if (!n) return ""
  if (n.includes("custom")) return "Customised"
  if (n.includes("double magnum") || n.includes("sapphire")) return isVeg ? "DMV" : "DMNV"
  if (n.includes("magnum") || n.includes("pearl")) return isVeg ? "MV" : "MNV"
  if (n.includes("multi cuisine") || n.includes("multi-cuisine")) return isVeg ? "MCV" : "MCNV"
  if (n.includes("luxury") || n.includes("bliss")) return isVeg ? "LV" : "LNV"
  return ""
}

const VEG_MENU_IDS = new Set([2, 4, 6, 8, 32, 34, 36])
const NV_MENU_IDS = new Set([3, 5, 7, 9, 22, 33, 35, 37])

function mapDecorType(priority: any) {
  const p = String(priority || "").toLowerCase()
  if (p === "silver") return "Silver"
  if (p === "gold") return "Gold"
  if (p === "premium" || p === "platinum") return "Premium"
  return ""
}

function funcName(row: Row, dept: string) {
  const name = String(row.functionname || "").trim()
  if (name) return name
  const t = FUNC_TYPE_MAP[String(row[DEPTS[dept].func] || "")]
  return t ? (t.other || t.type) : ""
}

/** Per-function fields — same as extractSlotFields in src/lib/lms.js */
function slotFields(row: Row, dept: string): Ev {
  const cfg = DEPTS[dept]
  const s: Ev = { ...mapEventType(row[cfg.func], row.functionname) }
  s.shift = mapSession(row[cfg.d + "session"], row[cfg.time])
  s.time = row[cfg.time] || ""
  if (dept === "venue") {
    s.pax = row.fiscd_pax_no ? String(row.fiscd_pax_no) : ""
    const id = Number(row.fiscd_menu)
    if (id) {
      const isVeg = VEG_MENU_IDS.has(id)
      s.menu_type = isVeg ? "Veg" : NV_MENU_IDS.has(id) ? "Non-Veg" : ""
      s.menu_cat = menuCatFromName(row.menuname, isVeg)
    }
  } else if (dept === "decor") {
    s.decor_type = mapDecorType(row.dhc_priority)
  } else if (dept === "catering") {
    s.pax = row.chcd_pax ? String(row.chcd_pax) : ""
    const isVeg = row.chcd_catering === "Veg"
    s.menu_type = isVeg ? "Veg" : row.chcd_catering === "Non Veg" ? "Non-Veg" : ""
    s.menu_cat = menuCatFromName(row.menuname, isVeg)
  }
  return s
}

// ── Helpers ──

function phone10(v: any) {
  return String(v || "").replace(/\D/g, "").slice(-10)
}

function formatPhone(v: any) {
  const p = phone10(v)
  return p.length === 10 ? "+91 " + p : (String(v || "").trim() || "")
}

const SALUTATIONS = new Set(["mr", "mrs", "ms", "dr", "shri", "smt", "miss"])

function nameTokens(name: any) {
  return String(name || "").toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 3 && !SALUTATIONS.has(w))
}

function editDistance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return dp[a.length][b.length]
}

/** Spelling-tolerant name match: Jah/Jahdev, Anushka/Anushkha, Diya/Divya */
function namesMatch(a: string[], b: string[]) {
  return a.some((x) => b.some((y) =>
    x === y || x.startsWith(y) || y.startsWith(x) ||
    (Math.min(x.length, y.length) >= 4 && editDistance(x, y) <= 1)))
}

/** Guest-name tokens of a calendar booking, falling back to its title's first part */
function eventNameTokens(e: Ev) {
  return [...nameTokens(e.guest_name), ...nameTokens(String(e.title || "").split("|")[0])]
}

function firstName(name: any) {
  const parts = String(name || "").trim().split(/\s+/)
  while (parts.length > 1 && SALUTATIONS.has(parts[0].toLowerCase().replace(".", ""))) parts.shift()
  return parts[0] || ""
}

/** Same output as autoTitle() in src/lib/autoTitle.js (without translation) */
function buildTitle(ev: Ev) {
  const et = ev.event_type === "Other" ? (ev.event_type_other || "") : (ev.event_type || "")
  const pax = ev.pax ? ev.pax + "pax" : ""
  const join = (a: any[]) => a.map((x) => String(x ?? "").trim()).filter(Boolean).join(" | ")
  if (["ap", "am", "ae", "ar"].includes(ev.venue_id)) {
    return join([firstName(ev.guest_name), et, pax, ev.shift ? ev.shift.charAt(0) : "", ev.menu_cat]) || "Untitled"
  }
  if (Array.isArray(ev.event_slots) && ev.event_slots.length > 1) {
    return join([firstName(ev.guest_name), "Multi-Event", ev.venue_name]) || "Untitled"
  }
  return join([firstName(ev.guest_name), et, pax, ev.venue_name]) || "Untitled"
}

/** Drop blank values so an empty LMS field never wipes what staff entered */
function compact(o: Ev): Ev {
  const out: Ev = {}
  for (const [k, v] of Object.entries(o)) {
    if (v === null || v === undefined || v === "") continue
    if (Array.isArray(v) && v.length === 0) continue
    out[k] = v
  }
  return out
}

function todayIST() {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)
}

function ownVenueCat(row: Row) {
  return OWN_VENUE_NAMES[String(row.venue1 || "").trim().toLowerCase()] || null
}

// ── Build the desired bookings from LMS rows ──

type Desired = { key: string; fields: Ev; label: string }

export function buildDesired(lms: Record<string, Row[]>, today: string) {
  const desired = new Map<string, Desired>()
  // key → where the cancelled booking would sit, for matching hand-entered ones
  const cancelled = new Map<string, { venue_id: string; date: string; phone: string }>()
  const isCancelled = (row: Row, dept: string) => String(row[DEPTS[dept].p + "cancel_remarks"] || "").trim() !== ""

  // 1. Venue contracts: one booking per function
  const venueByPhoneDate = new Map<string, string[]>()
  for (const row of lms.venue || []) {
    const date = String(row.fiscd_function_date || "").slice(0, 10)
    const cat = LMS_VENUE_TO_CAT[String(row.fiscd_venue_id || "")]
    if (!cat || !date || date < today) continue
    const key = "lms:venue:" + String(row.fisc_entryno || row.headid || "").trim() + ":" +
      String(row.fiscd_function_type || "").trim() + "-" + date + "-" + String(row.fiscd_session || "").trim()
    if (isCancelled(row, "venue")) {
      cancelled.set(key, { venue_id: cat, date, phone: phone10(row.fisc_client_mobile) })
      continue
    }
    const fields = compact({
      venue_id: cat, date,
      guest_name: String(row.fisc_guest_name || "").trim(),
      phone: formatPhone(row.fisc_client_mobile),
      sub_venue: LOCATION_TO_SUB_VENUE[String(row.fiscd_location_id || "").trim()] || "",
      booking_status: row.fiscd_menu ? "VMD" : "",
      ...slotFields(row, "venue"),
    })
    desired.set(key, { key, fields, label: fields.guest_name + " " + date + " " + cat })
    const pd = phone10(row.fisc_client_mobile) + "|" + date
    if (phone10(row.fisc_client_mobile)) venueByPhoneDate.set(pd, [...(venueByPhoneDate.get(pd) || []), key])
  }

  // 2. Decor / Catering / Entertainment
  const outdoor = new Map<string, { dept: string; rows: Row[]; cancelledRows: Row[] }>()
  // Keys of contracts now merged into a venue booking; a separate entry an
  // earlier run made for one of them is removed
  const folded = new Set<string>()
  for (const dept of ["decor", "catering", "entertainment"]) {
    const cfg = DEPTS[dept]
    for (const row of lms[dept] || []) {
      const date = String(row[cfg.date] || "").slice(0, 10)
      if (!date || date < today) continue
      const cancelledRow = isCancelled(row, dept)

      const key = "lms:" + dept + ":" + String(row[cfg.entry] || row.headid || "").trim() + ":" + date

      // Own venue + same guest has a venue contract that day → fold into
      // that booking instead of a separate ADD / AC / AEE entry. Decor and
      // Entertainment mark their section 'Closure'; Catering fills the menu
      // only where the venue contract left it blank.
      const venueKeys = ownVenueCat(row) ? venueByPhoneDate.get(phone10(row[cfg.contact]) + "|" + date) : null
      if (venueKeys && venueKeys.length) {
        folded.add(key)
        if (cancelledRow) continue
        for (const k of venueKeys) {
          const f = desired.get(k)!.fields
          if (dept === "decor") f.decor_status = "Closure"
          else if (dept === "entertainment") f.entertainment_status = "Closure"
          else {
            const s = compact(slotFields(row, dept))
            if (!f.menu_type && s.menu_type) f.menu_type = s.menu_type
            if (!f.menu_cat && s.menu_cat) f.menu_cat = s.menu_cat
          }
        }
        continue
      }

      const g = outdoor.get(key) || { dept, rows: [], cancelledRows: [] }
      if (cancelledRow) g.cancelledRows.push(row)
      else g.rows.push(row)
      outdoor.set(key, g)
    }
  }

  for (const [key, g] of outdoor) {
    if (g.rows.length === 0) {
      const r = g.cancelledRows[0], cfg = DEPTS[g.dept]
      cancelled.set(key, { venue_id: OUTDOOR_CAT[g.dept], date: String(r[cfg.date]).slice(0, 10), phone: phone10(r[cfg.contact]) })
      continue
    }
    const cfg = DEPTS[g.dept]
    g.rows.sort((a, b) => String(a[cfg.time] || "").localeCompare(String(b[cfg.time] || "")))
    const first = g.rows[0]
    const slots = g.rows.map((r) => compact(slotFields(r, g.dept)))
    const s0 = slots[0] || {}
    const venueName = String(first[cfg.d + "venue2"] || "").trim() || String(first.venue1 || "").trim()
    const fields = compact({
      venue_id: OUTDOOR_CAT[g.dept],
      date: String(first[cfg.date]).slice(0, 10),
      guest_name: String(first[cfg.p + "guest_name"] || "").trim(),
      phone: formatPhone(first[cfg.contact]),
      venue_name: venueName,
      location: String(first[cfg.d + "address2"] || "").trim(),
      event_slots: slots,
      event_type: s0.event_type, event_type_other: s0.event_type_other,
      shift: s0.shift, time: s0.time, pax: s0.pax,
      decor_type: g.dept === "decor" ? s0.decor_type : "",
      menu_type: g.dept === "catering" ? s0.menu_type : "",
      menu_cat: g.dept === "catering" ? s0.menu_cat : "",
    })
    desired.set(key, { key, fields, label: fields.guest_name + " " + fields.date + " " + fields.venue_id + " (" + g.rows.map((r) => funcName(r, g.dept)).filter(Boolean).join(", ") + ")" })
  }

  for (const k of desired.keys()) { cancelled.delete(k); folded.delete(k) }
  return { desired, cancelled, folded }
}

// ── Compare with what's already in the calendar ──

/** JSON with sorted keys — Postgres jsonb reorders keys, so plain stringify never matches */
function stableJson(v: any): string {
  if (Array.isArray(v)) return "[" + v.map(stableJson).join(",") + "]"
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stableJson(v[k])).join(",") + "}"
  return JSON.stringify(v ?? null)
}

function sameValue(a: any, b: any) {
  if (Array.isArray(a) || Array.isArray(b) || (a && typeof a === "object")) return stableJson(a) === stableJson(b)
  if (a === null || a === undefined || a === "") return b === null || b === undefined || b === ""
  // time columns come back as "19:00:00"
  if (typeof a === "string" && /^\d{2}:\d{2}$/.test(a) && typeof b === "string") return b.slice(0, 5) === a
  return String(a) === String(b)
}

// Fields whose change re-generates the auto title
const TITLE_FIELDS = ["guest_name", "event_type", "event_type_other", "pax", "shift", "menu_cat", "venue_name", "event_slots"]

function withTitle(e: Ev, patch: Ev) {
  if (TITLE_FIELDS.some((k) => k in patch)) {
    const title = buildTitle({ ...e, ...patch })
    if (title !== e.title) patch.title = title
  }
  return patch
}

/**
 * Find the hand-entered booking this LMS function already is. Tiers, strongest
 * first: same phone → spelling-tolerant name → same shift + pax. Within a tier
 * a shift match breaks ties; anything still ambiguous is never guessed.
 */
function findCandidate(d: Desired, pool: Ev[]): { match?: Ev; ambiguous?: Ev[] } {
  const p = phone10(d.fields.phone)
  const tokens = nameTokens(d.fields.guest_name)
  const tiers = [
    pool.filter((e) => p && phone10(e.phone) === p),
    pool.filter((e) => namesMatch(tokens, eventNameTokens(e))),
    pool.filter((e) => d.fields.shift && d.fields.pax && e.shift === d.fields.shift && String(e.pax || "") === d.fields.pax),
  ]
  for (let cands of tiers) {
    if (cands.length > 1 && d.fields.shift) {
      const sameShift = cands.filter((e) => e.shift === d.fields.shift)
      if (sameShift.length) cands = sameShift
    }
    if (cands.length === 1) return { match: cands[0] }
    if (cands.length > 1) return { ambiguous: cands }
  }
  return {}
}

export function plan(desiredMap: Map<string, Desired>, cancelled: Map<string, { venue_id: string; date: string; phone: string }>, existing: Ev[], folded: Set<string> = new Set()) {
  const byKey = new Map<string, Ev>()
  for (const e of existing) if (e.crm_id) byKey.set(e.crm_id, e)
  const claimed = new Set<string>()
  const now = new Date().toISOString()
  const inserts: Ev[] = [], updates: { id: string; patch: Ev; label: string; adopted: boolean }[] = []
  const ambiguous: string[] = [], skippedDeleted: string[] = []
  const unclaimed = () => existing.filter((e) => !e.crm_id && !e.deleted_at && !claimed.has(e.id))

  for (const d of desiredMap.values()) {
    const linked = byKey.get(d.key)
    if (linked) {
      if (linked.deleted_at) { skippedDeleted.push(d.label); continue }
      claimed.add(linked.id)
      // Only fields LMS itself changed since the last sync are written, so a
      // value staff corrected (VMDE, Jain menu, exact time...) is never
      // reverted just because LMS still holds its rougher version.
      const snap: Ev = linked.lms_snapshot || {}
      const patch: Ev = {}
      for (const [k, v] of Object.entries(d.fields)) {
        if (!sameValue(v, snap[k]) && !sameValue(v, linked[k])) patch[k] = v
      }
      const snapChanged = stableJson(snap) !== stableJson(d.fields)
      if (Object.keys(patch).length || snapChanged) {
        updates.push({ id: linked.id, patch: { ...withTitle(linked, patch), lms_snapshot: d.fields, synced_at: now }, label: d.label, adopted: false })
      }
      continue
    }

    const pool = unclaimed().filter((e) => e.venue_id === d.fields.venue_id && e.date === d.fields.date)
    const { match, ambiguous: amb } = findCandidate(d, pool)
    if (amb) { ambiguous.push(d.label + " → " + amb.map((e) => e.title).join(" / ")); continue }
    if (match) {
      // Adopting a hand-entered booking: fill only what staff left blank,
      // except a signed decor / entertainment contract, which is news.
      claimed.add(match.id)
      const patch: Ev = {}
      for (const [k, v] of Object.entries(d.fields)) {
        const blank = match[k] === null || match[k] === undefined || match[k] === "" ||
          (Array.isArray(match[k]) && match[k].length === 0)
        if (blank || ((k === "decor_status" || k === "entertainment_status") && match[k] !== v)) patch[k] = v
      }
      updates.push({ id: match.id, patch: { ...withTitle(match, patch), crm_id: d.key, lms_snapshot: d.fields, synced_at: now }, label: d.label, adopted: true })
      continue
    }
    inserts.push({
      ...d.fields, title: buildTitle(d.fields), status: "Confirmed", source: "manual",
      crm_id: d.key, lms_snapshot: d.fields, synced_at: now,
    })
  }

  // Cancelled in LMS: linked bookings, plus a hand-entered one only on the
  // strictest match (same venue + date + phone), never on a fuzzy name.
  const deletes = existing.filter((e) => e.crm_id && !e.deleted_at && (cancelled.has(e.crm_id) || folded.has(e.crm_id)))
  for (const [key, info] of cancelled) {
    if (byKey.has(key)) continue
    const hits = unclaimed().filter((e) => e.venue_id === info.venue_id && e.date === info.date &&
      info.phone && phone10(e.phone) === info.phone)
    if (hits.length === 1) { deletes.push(hits[0]); claimed.add(hits[0].id) }
  }
  return { inserts, updates, deletes, ambiguous, skippedDeleted }
}

// ── LMS + database I/O ──

async function fetchJson(url: string, init: RequestInit) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function fetchPage(dept: string, page: number): Promise<Row[]> {
  const cfg = DEPTS[dept]
  // LMS sometimes hangs ~20s on a single page and then answers fine on retry
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetchJson(LMS_BASE + cfg.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...cfg.body, loggeduserid: "1", page_limit: String(page) }),
    }).catch(() => null)
    if (res && res.ok) return (await res.json()).Contractinfo || []
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
  }
  // A failed page aborts the whole run: acting on a partial list could
  // miss cancellations, and nothing is ever deleted for being absent.
  throw new Error(dept + ": LMS page " + page + " failed")
}

/** All pages of one department, PAGES_AT_ONCE at a time (Venue is ~90 pages) */
export async function fetchDept(dept: string) {
  const rows: Row[] = []
  for (let start = 1; start <= MAX_PAGES; start += PAGES_AT_ONCE) {
    const pages = await Promise.all(Array.from({ length: PAGES_AT_ONCE }, (_, i) => fetchPage(dept, start + i)))
    for (const list of pages) rows.push(...list)
    if (pages.some((list) => list.length < PAGE_SIZE)) break
  }
  return rows
}

function db(path: string, init: RequestInit = {}) {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  return fetch(Deno.env.get("SUPABASE_URL") + "/rest/v1/" + path, {
    ...init,
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "return=minimal", ...(init.headers || {}) },
  })
}

async function dbOk(res: Response, what: string) {
  if (!res.ok) throw new Error(what + ": " + res.status + " " + (await res.text()))
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { ...CORS, "Content-Type": "application/json" } })
}

/** Secret the cron job sends, generated by migration 029 (env var optional) */
async function cronSecret(): Promise<string | null> {
  const fromEnv = Deno.env.get("LMS_SYNC_SECRET")
  if (fromEnv) return fromEnv
  const res = await db("lms_sync_state?id=eq.1&select=cron_secret", { headers: { Prefer: "" } }).catch(() => null)
  if (!res || !res.ok) return null
  const rows = await res.json()
  return rows[0]?.cron_secret || null
}

async function finishRun(result: Ev) {
  await db("lms_sync_state?id=eq.1", {
    method: "PATCH",
    body: JSON.stringify({ last_finished_at: new Date().toISOString(), last_result: result }),
  }).catch(() => {})
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  // The cron job sends the secret; the calendar's "Sync Now" button can't
  // (the bundle is public), so a plain run is open to anyone and kept safe
  // by the lock below. The dry-run report lists guest names, so it alone
  // needs the secret.
  const secret = await cronSecret()
  const isCron = !!secret && req.headers.get("x-cron-secret") === secret
  const dry = new URL(req.url).searchParams.get("dry") === "1"
  if (dry && !isCron) return json({ error: "Unauthorized" }, 401)

  // One run at a time (cron and button can't double-insert). A button press
  // always gets a fresh run; the cron skips if one finished under a minute ago.
  if (!dry) {
    const claimRes = await db("rpc/lms_sync_claim", {
      method: "POST", headers: { Prefer: "" },
      body: JSON.stringify({ min_gap_seconds: isCron ? 60 : 0 }),
    })
    if (!claimRes.ok) return json({ error: "lock: " + (await claimRes.text()) }, 500)
    const claim = await claimRes.json()
    if (!claim.ok) return json({ skipped: true, reason: claim.reason, last_result: claim.last_result ?? null })
  }

  try {
    const today = todayIST()
    const [venue, decor, catering, entertainment] = await Promise.all(
      ["venue", "decor", "catering", "entertainment"].map(fetchDept))
    const { desired, cancelled, folded } = buildDesired({ venue, decor, catering, entertainment }, today)

    const evRes = await db("events?select=*&date=gte." + today, { headers: { Prefer: "" } })
    await dbOk(evRes, "load events")
    const existing = await evRes.json()

    const p = plan(desired, cancelled, existing, folded)
    const summary = {
      dry, today,
      lms_rows: { venue: venue.length, decor: decor.length, catering: catering.length, entertainment: entertainment.length },
      insert: p.inserts.length,
      adopt: p.updates.filter((u) => u.adopted).length,
      update: p.updates.filter((u) => !u.adopted).length,
      delete: p.deletes.length,
      ambiguous: p.ambiguous.length,
      skipped_deleted_in_calendar: p.skippedDeleted.length,
    }
    if (dry) {
      return json({
        ...summary,
        ambiguous: p.ambiguous,
        inserts: p.inserts.map((e) => e.title + " — " + e.date + " " + e.venue_id),
        adopts: p.updates.filter((u) => u.adopted).map((u) => u.label + " ← " + Object.keys(u.patch).join(",")),
        updates: p.updates.filter((u) => !u.adopted).map((u) => u.label + " ← " + Object.keys(u.patch).join(",")),
        deletes: p.deletes.map((e) => e.title + " — " + e.date),
      })
    }

    // Rows carry different column sets (venue vs ADD/AC/AEE): list every
    // column and let missing ones take their DB default instead of null.
    if (p.inserts.length) {
      const cols = [...new Set(p.inserts.flatMap((e) => Object.keys(e)))].join(",")
      for (let i = 0; i < p.inserts.length; i += 100) {
        await dbOk(await db("events?columns=" + cols, {
          method: "POST",
          headers: { Prefer: "return=minimal,missing=default" },
          body: JSON.stringify(p.inserts.slice(i, i + 100)),
        }), "insert")
      }
    }
    for (const u of p.updates) {
      await dbOk(await db("events?id=eq." + u.id, { method: "PATCH", body: JSON.stringify(u.patch) }), "update " + u.label)
    }
    if (p.deletes.length) {
      const ids = p.deletes.map((e) => e.id).join(",")
      await dbOk(await db("events?id=in.(" + ids + ")", { method: "PATCH", body: JSON.stringify({ deleted_at: new Date().toISOString() }) }), "delete")
    }
    console.log("lms-sync", isCron ? "cron" : "button", JSON.stringify(summary))
    await finishRun(summary)
    return json(summary)
  } catch (err) {
    const message = (err as Error).message
    console.log("lms-sync failed:", message)
    if (!dry) await finishRun({ error: message })
    return json({ error: message }, 500)
  }
})

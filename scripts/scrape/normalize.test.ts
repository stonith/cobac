import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type {
  ActivityDetailBody,
  ApiEnvelope,
  CalendarsBody,
  EventsBody,
  FiltersBody,
  RawCalendar,
  RawPrice,
} from './api'
import {
  applyEnrichment,
  BURNABY_CALENDAR_GROUPS,
  buildSnapshot,
  calendarGroup,
  cleanName,
  cleanTitle,
  instructorNames,
  isPublicCalendar,
  parseOpenings,
  priceLines,
  summarizePrice,
  sanitizeDescription,
  toLocalIso,
} from './normalize'

const fixture = <T>(name: string): T =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, '__fixtures__', name), 'utf8')) as T

const calendars = fixture<ApiEnvelope<CalendarsBody>>('calendars.json').body.calendars
const filters = fixture<ApiEnvelope<FiltersBody>>('filters-4.json').body
const events = fixture<ApiEnvelope<EventsBody>>('events-4.json').body.center_events
const detail = fixture<ApiEnvelope<ActivityDetailBody>>('activity-details-110282.json').body
  .activity_detail
const groupFitness = calendars.find((c) => c.calendar_id === 4)!

describe('cleanName', () => {
  it('strips ActiveNet sort prefixes', () => {
    expect(cleanName('**Public Swimming')).toBe('Public Swimming')
    expect(cleanName('*Britannia Pool')).toBe('Britannia Pool')
    expect(cleanName('Sports: Soccer')).toBe('Sports: Soccer')
  })

  it('keeps Burnaby centre names with abbreviation suffixes verbatim', () => {
    expect(cleanName('Bonsor Recreation Complex (BON)')).toBe('Bonsor Recreation Complex (BON)')
  })
})

describe('cleanTitle', () => {
  it('strips surrounding pipes', () => {
    expect(cleanTitle('|Free Swim|')).toBe('Free Swim')
    expect(cleanTitle('Aquafit - Shallow Moderate')).toBe('Aquafit - Shallow Moderate')
  })

  it('keeps the Burnaby "Reserve In Advance:" registration-mode prefix', () => {
    expect(cleanTitle('Reserve In Advance:  Active Aging Yoga & Core')).toBe(
      'Reserve In Advance:  Active Aging Yoga & Core',
    )
  })
})

describe('calendarGroup', () => {
  it('groups by prefix and treats starred calendars as drop-in', () => {
    expect(calendarGroup('**Public Swimming')).toBe('Drop-in')
    expect(calendarGroup('Fitness: Yoga & Pilates')).toBe('Fitness')
    expect(calendarGroup('Art & Culture: Pottery & Woodworking')).toBe('Art & Culture')
    expect(calendarGroup('Various/Other Drop-in Activities')).toBe('Drop-in')
    expect(calendarGroup('Queer Inclusion')).toBe('Other')
  })
})

describe('BURNABY_CALENDAR_GROUPS', () => {
  it('curates a group for every calendar on the tenant', () => {
    for (const calendar of calendars) {
      expect(BURNABY_CALENDAR_GROUPS[cleanName(calendar.name)], calendar.name).toBeTruthy()
    }
  })

  it('maps fitness, sports and multi-sport calendars', () => {
    expect(BURNABY_CALENDAR_GROUPS['Group Fitness']).toBe('Fitness')
    expect(BURNABY_CALENDAR_GROUPS['Indoor Cycling']).toBe('Fitness')
    expect(BURNABY_CALENDAR_GROUPS['Yoga']).toBe('Fitness')
    expect(BURNABY_CALENDAR_GROUPS['Multi-sport']).toBe('Drop-in')
    expect(BURNABY_CALENDAR_GROUPS['Pickleball']).toBe('Sports')
    expect(BURNABY_CALENDAR_GROUPS['Racquet Court']).toBe('Sports')
  })
})

describe('toLocalIso', () => {
  it('converts the raw timestamp and drops seconds', () => {
    expect(toLocalIso('2026-09-08 14:00:00')).toBe('2026-09-08T14:00')
  })
  it('rejects unexpected formats', () => {
    expect(() => toLocalIso('2026/09/08')).toThrow()
  })
})

describe('instructorNames', () => {
  it('drops the "No Instructor" placeholder and hidden instructors', () => {
    const names = instructorNames([
      {
        id: 21,
        first_name: 'No',
        middle_name: '',
        last_name: 'Instructor',
        is_primary_instructor: true,
        show_instructor_online: true,
      },
      {
        id: 2,
        first_name: 'Ada',
        middle_name: '',
        last_name: 'Lovelace',
        is_primary_instructor: false,
        show_instructor_online: true,
      },
      {
        id: 3,
        first_name: 'Hidden',
        middle_name: '',
        last_name: 'Person',
        is_primary_instructor: false,
        show_instructor_online: false,
      },
    ])
    expect(names).toEqual(['Ada Lovelace'])
  })
})

describe('sanitizeDescription', () => {
  it('drops the date table, font tags and empty paragraphs but keeps text', () => {
    const html =
      '<p><span><table><tr><td>Date and Time</td><td>Tue 2pm</td></tr></table></span></p>' +
      '<p style="margin:0"><br></p><p><font face="Arial">Free Swim<br></font></p>' +
      '<p>Recreational swim for <b>Children</b>.</p><p>&nbsp;</p>'
    expect(sanitizeDescription(html)).toBe(
      '<p>Free Swim<br /></p><p>Recreational swim for <b>Children</b>.</p>',
    )
  })
  it('keeps safe links only', () => {
    expect(
      sanitizeDescription('<a href="javascript:alert(1)">x</a><a href="https://a.b">y</a>'),
    ).toBe('<a>x</a><a href="https://a.b">y</a>')
  })
})

describe('isPublicCalendar', () => {
  it('keeps every calendar on the City of Burnaby tenant', () => {
    expect(calendars.filter(isPublicCalendar)).toHaveLength(17)
  })

  it('excludes retired, hidden and placeholder calendars', () => {
    const base: RawCalendar = {
      calendar_id: 1,
      name: 'Badminton',
      min_time: 6,
      max_time: 23,
      first_day: 1,
      include_weekends: true,
      hide_on_internet: false,
      retired: false,
      notes: '',
    }
    expect(isPublicCalendar(base)).toBe(true)
    expect(isPublicCalendar({ ...base, retired: true })).toBe(false)
    expect(isPublicCalendar({ ...base, hide_on_internet: true })).toBe(false)
    expect(isPublicCalendar({ ...base, name: 'Choose a Calendar' })).toBe(false)
  })
})

describe('buildSnapshot', () => {
  const snapshot = buildSnapshot(
    [{ calendar: groupFitness, filters, centerEvents: events }],
    '2026-10-13T00:00:00.000Z',
  )

  it('records the period and the curated calendar group', () => {
    expect(snapshot.period).toEqual({ start: '2026-10-12', end: '2027-01-25' })
    expect(snapshot.calendars).toEqual([{ id: 4, name: 'Group Fitness', group: 'Fitness' }])
  })

  it('collects every centre and facility from filters with verbatim names', () => {
    expect(snapshot.centers).toEqual([
      { id: 63, name: 'Bonsor Recreation Complex (BON)' },
      { id: 54, name: 'Eileen Dailly Leisure Pool & Fitness Centre (EDP)' },
    ])
    expect(snapshot.facilities.find((f) => f.id === 229)).toEqual({
      id: 229,
      name: 'BON Yoga/Pilates Studio',
      centerId: 63,
    })
    expect(snapshot.facilities.find((f) => f.id === 307)).toEqual({
      id: 307,
      name: 'EDP Multi-purpose Room',
      centerId: 54,
    })
  })

  it('keeps one activity per occurrence id with the inline fee table summarized', () => {
    // On the City of Burnaby tenant each occurrence is its own registrable activity, so the
    // per-occurrence event_item_id doubles as the activity id and titles repeat across weeks.
    const rawEvents = events.flatMap((c) => c.events)
    expect(snapshot.activities).toHaveLength(new Set(rawEvents.map((e) => e.event_item_id)).size)
    expect(snapshot.occurrences).toHaveLength(rawEvents.length)
    const yoga = snapshot.activities.find((a) => a.id === 110282)!
    expect(yoga.title).toBe('Reserve In Advance:  Active Aging Yoga & Core')
    expect(yoga.calendarId).toBe(4)
    expect(yoga.centerId).toBe(63)
    expect(yoga.facilityIds).toEqual([229])
    expect(yoga.url).toBe(
      'https://ca.apm.activecommunities.com/burnaby/Activity_Search/reserve-in-advance-active-aging-yoga-core/110282',
    )
    expect(yoga.priceText).toBe('from $5.55')
    expect(yoga.free).toBe(false)
    expect(yoga.description).toContain('yoga')
    expect(yoga.description).not.toContain('<table')
  })

  it('sorts occurrences by start time', () => {
    const starts = snapshot.occurrences.map((o) => o.s)
    expect(starts).toEqual([...starts].sort())
    expect(starts[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  it('is deterministic for the same input', () => {
    const again = buildSnapshot(
      [{ calendar: groupFitness, filters, centerEvents: events }],
      '2026-10-13T00:00:00.000Z',
    )
    expect(again).toEqual(snapshot)
  })
})

describe('applyEnrichment', () => {
  it('adds age, openings, dates, prices and centre coordinates', () => {
    const snapshot = buildSnapshot(
      [{ calendar: groupFitness, filters, centerEvents: events }],
      '2026-10-13T00:00:00.000Z',
    )
    const enriched = applyEnrichment(snapshot, new Map([[110282, detail]]))
    expect(enriched).toBe(1)
    const yoga = snapshot.activities.find((a) => a.id === 110282)!
    expect(yoga.ageMin).toBe(40)
    expect(yoga.ageMax).toBe(0)
    expect(yoga.ageText).toBe('40 yrs +')
    expect(yoga.openings).toBe('23 openings remaining')
    expect(yoga.availability).toBe('open')
    expect(yoga.spaces).toBe(23)
    expect(yoga.firstDate).toBe('2026-10-14')
    expect(yoga.lastDate).toBe('2026-10-14')
    expect(yoga.priceText).toBe('from $5.55')
    expect(yoga.prices).toEqual([
      { price: '$7.40', description: 'Adult (40-64 yrs) fee for up to 64 years old' },
      { price: '$5.55', description: 'Senior (65+ yrs) fee for 65 or more years old' },
    ])
    const bonsor = snapshot.centers.find((c) => c.id === 63)!
    expect(bonsor.lat).toBeCloseTo(49.2242)
    expect(bonsor.lng).toBeCloseTo(-122.9969)
    expect(bonsor.address).toBe('6550 Bonsor Ave, Burnaby')
    expect(bonsor.phone).toBe('(604) 297-4597')
  })

  it('leaves activities without details untouched', () => {
    const snapshot = buildSnapshot(
      [{ calendar: groupFitness, filters, centerEvents: events }],
      '2026-10-13T00:00:00.000Z',
    )
    expect(applyEnrichment(snapshot, new Map())).toBe(0)
    expect(snapshot.activities.every((a) => a.ageText === undefined)).toBe(true)
  })

  it('applies the center fallback for centres the detail endpoint omits', () => {
    const snapshot = buildSnapshot(
      [{ calendar: groupFitness, filters, centerEvents: events }],
      '2026-10-13T00:00:00.000Z',
    )
    snapshot.centers.push({ id: 180, name: 'Rosemary Brown Recreation Centre (RBR)' })
    applyEnrichment(snapshot, new Map())
    const rbr = snapshot.centers.find((c) => c.id === 180)!
    expect(rbr.lat).toBeCloseTo(49.208477)
    expect(rbr.lng).toBeCloseTo(-122.950023)
    expect(rbr.address).toBe('7789 18th Street, Burnaby')
    expect(rbr.phone).toBe('604-421-3200')
  })
})

describe('parseOpenings', () => {
  it.each([
    ['24 openings remaining', { availability: 'open', spaces: 24 }],
    ['1 opening remaining', { availability: 'open', spaces: 1 }],
    ['0 openings remaining', { availability: 'full', spaces: 0 }],
    ['Unlimited openings', { availability: 'open' }],
    ['Full', { availability: 'full', spaces: 0 }],
    ['Closed', { availability: 'closed' }],
    ['Cancelled', { availability: 'cancelled' }],
    ['  full ', { availability: 'full', spaces: 0 }],
  ])('parses %j', (status, expected) => {
    expect(parseOpenings(status)).toEqual(expected)
  })

  it('falls back on space_type for unknown wording', () => {
    expect(parseOpenings('Waiting list', 2)).toEqual({ availability: 'open' })
    expect(parseOpenings('Waiting list', 3)).toEqual({ availability: 'full', spaces: 0 })
    expect(parseOpenings('Waiting list', 0)).toEqual({ availability: 'closed' })
    expect(parseOpenings('Waiting list', 7)).toEqual({})
    expect(parseOpenings('Waiting list')).toEqual({})
  })

  it('prefers the label over space_type when both are known', () => {
    expect(parseOpenings('Cancelled', 0)).toEqual({ availability: 'cancelled' })
    expect(parseOpenings('3 openings remaining', 3)).toEqual({ availability: 'open', spaces: 3 })
  })
})

const price = (overrides: Partial<RawPrice>): RawPrice => ({
  search_from_price_desc: '',
  estimate_price: '',
  free: false,
  ...overrides,
})

describe('price helpers', () => {
  const table: RawPrice['prices'] = [
    {
      list_name: '',
      activity_name: 'Badminton',
      details: [
        { price: '$112.00', description: 'Standard charge' },
        { price: '50.00%', description: 'Leisure Access' },
        { price: '$182.00', description: 'Non-resident' },
        { price: '', description: 'blank' },
      ],
    },
  ]

  it('flattens fee tables and drops blank rows', () => {
    expect(priceLines(price({ prices: table }))).toEqual([
      { price: '$112.00', description: 'Standard charge' },
      { price: '50.00%', description: 'Leisure Access' },
      { price: '$182.00', description: 'Non-resident' },
    ])
    expect(priceLines(price({}))).toEqual([])
  })

  it('summarizes with the lowest dollar amount and a from prefix', () => {
    const lines = priceLines(price({ prices: table }))
    expect(summarizePrice(price({ prices: table }), lines)).toBe('from $112.00')
    expect(summarizePrice(price({}), [{ price: '$7.93', description: 'Drop-in' }])).toBe('$7.93')
    expect(summarizePrice(price({}), [{ price: '$0.00', description: 'x' }])).toBe('Free')
  })

  it('prefers the direct price text and normalizes free wording', () => {
    expect(summarizePrice(price({ search_from_price_desc: '$14.29' }), [])).toBe('$14.29')
    expect(summarizePrice(price({ estimate_price: 'no charge' }), [])).toBe('Free')
    expect(summarizePrice(price({ free: true }), [])).toBe('Free')
    expect(summarizePrice(price({}), [])).toBe('')
  })

  it('summarizes the inline fee table that the City of Burnaby events endpoint carries', () => {
    const inline = events[0]!.events.find((e) => e.event_item_id === 110282)!.price
    expect(priceLines(inline)).toEqual([
      { price: '$7.40', description: 'Adult (40-64 yrs) fee for up to 64 years old' },
      { price: '$5.55', description: 'Senior (65+ yrs) fee for 65 or more years old' },
    ])
    expect(summarizePrice(inline, priceLines(inline))).toBe('from $5.55')
  })
})

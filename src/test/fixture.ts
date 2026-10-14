import { buildIndex } from '@/data/index'
import type { Snapshot } from '@/types/snapshot'

/**
 * Small in-memory snapshot for component tests: two centres, three calendars, week of 2026-09-07.
 * The rows mirror the City of Burnaby tenant: venue-suffixed centre names, "Reserve In Advance:"
 * titles kept verbatim, and fee tables scraped from the detail endpoint.
 */
export const snapshot: Snapshot = {
  generatedAt: '2026-09-09T02:00:00.000Z',
  period: { start: '2026-09-06', end: '2026-11-01' },
  calendars: [
    { id: 1, name: 'Badminton', group: 'Sports' },
    { id: 2, name: 'Basketball', group: 'Sports' },
    { id: 4, name: 'Group Fitness', group: 'Fitness' },
    { id: 6, name: 'Multi-sport', group: 'Drop-in' },
  ],
  centers: [
    {
      id: 63,
      name: 'Bonsor Recreation Complex (BON)',
      address: '6550 Bonsor Avenue, Burnaby',
      phone: '(604) 421-5962',
      lat: 49.2242,
      lng: -122.9969,
    },
    { id: 180, name: 'Rosemary Brown Recreation Centre (RBR)', lat: 49.208477, lng: -122.950023 },
  ],
  facilities: [{ id: 1183, name: 'BON Gym 1/2/3', centerId: 63 }],
  activities: [
    {
      id: 1,
      title: 'Multi-sport',
      calendarId: 6,
      centerId: 63,
      facilityIds: [1183],
      url: 'https://ca.apm.activecommunities.com/burnaby/Activity_Search/multi-sport/1',
      description: '<p>Open gym for <b>everyone</b>.</p>',
      instructors: ['Ada Lovelace'],
      priceText: 'Free',
      free: true,
      ageText: 'All ages',
      openings: '100 openings remaining',
      availability: 'open',
      spaces: 100,
      firstDate: '2026-09-01',
      lastDate: '2026-11-10',
    },
    {
      id: 2,
      title: 'Reserve In Advance: Adult Badminton',
      calendarId: 1,
      centerId: 180,
      facilityIds: [],
      url: 'https://ca.apm.activecommunities.com/burnaby/Activity_Search/reserve-in-advance-adult-badminton/2',
      description: '',
      instructors: [],
      priceText: 'from $5.55',
      free: false,
      prices: [
        { price: '$5.55', description: 'Youth (19-25 yrs) fee for up to 25 years old' },
        { price: '$7.40', description: 'Adult (26-64 yrs) fee for 26 up to 64 years old' },
        { price: '$5.55', description: 'Senior (65+ yrs) fee for 65 or more years old' },
      ],
      openings: 'Full',
      availability: 'full',
      spaces: 0,
    },
  ],
  occurrences: [
    { a: 1, s: '2026-09-07T07:00', e: '2026-09-07T08:00' },
    { a: 1, s: '2026-09-08T14:00', e: '2026-09-08T16:00' },
    { a: 2, s: '2026-09-12T18:00', e: '2026-09-12T20:00' },
  ],
}

export const index = buildIndex(snapshot)

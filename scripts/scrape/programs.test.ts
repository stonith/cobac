import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { ProgramRecord } from './activity-search-api'
import { mergePrograms, meetingOccurrences, fetchPrograms } from './programs'
import { snapshot as fixture } from '../../src/test/fixture'
import { buildIndex } from '../../src/data/index'
import { applyFilters, emptyFilters } from '../../src/data/filters'

const record = JSON.parse(
  readFileSync(path.join(import.meta.dirname, '__fixtures__', 'program-138791.json'), 'utf8'),
) as ProgramRecord
const categories = [{ id: '26', desc: 'Dance' }]
const fresh = () => ({
  ...structuredClone(fixture),
  period: { start: '2026-10-12', end: '2027-01-25' },
})

describe('supplemental programs', () => {
  it('makes the missing dance class searchable without changing the snapshot shape', () => {
    const snapshot = fresh()
    expect(mergePrograms(snapshot, [record], categories)).toBe(1)
    expect(snapshot.activities.find((a) => a.id === 138791)).toMatchObject({
      title: 'Drop-In Modern Dance: Open level',
      centerId: 158,
      calendarId: -26,
      priceText: 'from $21.12',
      openings: '9 openings remaining',
      spaces: 9,
    })
    expect(snapshot.centers.find((c) => c.id === 158)).toMatchObject({
      lat: 49.2407,
      lng: -122.9695,
      address: '6450 Deer Lake Ave, Burnaby',
    })
    expect(snapshot.facilities.find((f) => f.id === 912)).toMatchObject({ centerId: 158 })
    expect(snapshot.calendars.find((c) => c.id === -26)).toMatchObject({
      name: 'Programs: Dance',
      group: 'Art & Culture',
    })
    expect(
      applyFilters(buildIndex(snapshot), { ...emptyFilters('2026-10-12'), q: 'drop' }),
    ).toEqual([{ a: 138791, s: '2026-10-14T12:00', e: '2026-10-14T13:30' }])
  })

  it('preserves existing calendar activities and makes merging idempotent', () => {
    const snapshot = fresh()
    mergePrograms(snapshot, [record], categories)
    const before = structuredClone(snapshot)
    expect(
      mergePrograms(
        snapshot,
        [{ ...record, detail: { ...record.detail, activity_name: 'changed' } }],
        categories,
      ),
    ).toBe(0)
    expect(snapshot).toEqual(before)
  })

  it('expands weekly patterns, clips to the window and omits exceptions', () => {
    const meetings = structuredClone(record.meetings)
    meetings.activity_patterns![0]!.ending_date = '2026-11-25'
    meetings.activity_patterns![0]!.exception_dates = ['2026-10-21']
    expect(
      meetingOccurrences(138791, meetings, { start: '2026-10-15', end: '2026-11-05' }),
    ).toEqual([
      { a: 138791, s: '2026-10-28T12:00', e: '2026-10-28T13:30' },
      { a: 138791, s: '2026-11-04T12:00', e: '2026-11-04T13:30' },
    ])
  })

  it('omits human-formatted holiday exceptions and includes explicit replacement dates', () => {
    const meetings = structuredClone(record.meetings)
    meetings.activity_patterns![0]!.ending_date = '2026-11-25'
    meetings.activity_patterns![0]!.exception_dates = ['11 Nov 2026']
    meetings.additional_dates = [
      { meeting_date: '2026-11-12', starting_time: '15:00:00', ending_time: '16:00:00' },
    ]
    expect(
      meetingOccurrences(138791, meetings, { start: '2026-11-09', end: '2026-11-15' }),
    ).toEqual([{ a: 138791, s: '2026-11-12T15:00', e: '2026-11-12T16:00' }])
  })

  it('expands compressed exception dates such as 14,21,21 Oct 2026', () => {
    const meetings = structuredClone(record.meetings)
    meetings.activity_patterns![0]!.ending_date = '2026-10-28'
    meetings.activity_patterns![0]!.exception_dates = ['14,21,21 Oct 2026']
    expect(meetingOccurrences(138791, meetings, fresh().period)).toEqual([
      { a: 138791, s: '2026-10-28T12:00', e: '2026-10-28T13:30' },
    ])
  })

  it('supports weekend schedules and overnight end times without duplicate sessions', () => {
    const meetings = structuredClone(record.meetings)
    const pattern = meetings.activity_patterns![0]!
    pattern.beginning_date = '2026-10-17'
    pattern.ending_date = '2026-10-18'
    pattern.pattern_dates = [
      { weekdays: 'Weekend', starting_time: '23:00:00', ending_time: '01:00:00' },
    ]
    meetings.activity_patterns!.push(structuredClone(pattern))
    expect(meetingOccurrences(138791, meetings, fresh().period)).toEqual([
      { a: 138791, s: '2026-10-17T23:00', e: '2026-10-18T01:00' },
      { a: 138791, s: '2026-10-18T23:00', e: '2026-10-19T01:00' },
    ])
  })

  it('resolves missing detail centres from the exact site name and search filter ids', () => {
    const snapshot = fresh()
    const missing = {
      ...record,
      item: { ...record.item, site: 'Shadbolt Centre for the Arts (SCA)' },
      detail: { ...record.detail, centers: [] },
    }
    expect(
      mergePrograms(snapshot, [missing], categories, () => {}, [
        { id: '158', desc: 'Shadbolt Centre for the Arts (SCA)' },
      ]),
    ).toBe(1)
    expect(snapshot.activities.find((a) => a.id === 138791)?.centerId).toBe(158)
  })

  it('logs ambiguous venues and identity mismatches without adding partial records', () => {
    const snapshot = fresh()
    const log = vi.fn()
    expect(
      mergePrograms(
        snapshot,
        [{ ...record, detail: { ...record.detail, centers: [] } }],
        categories,
        log,
      ),
    ).toBe(0)
    expect(snapshot.calendars.some((c) => c.id < 0)).toBe(false)
    expect(log).toHaveBeenCalledWith(expect.stringContaining('no unambiguous centre'))
    expect(
      mergePrograms(
        snapshot,
        [{ ...record, detail: { ...record.detail, activity_name: 'Wrong title' } }],
        categories,
        log,
      ),
    ).toBe(0)
    expect(log).toHaveBeenCalledWith(expect.stringContaining('identity mismatch'))
  })

  it('does not invent sessions from textual or unsupported schedules', () => {
    expect(
      meetingOccurrences(1, { ...record.meetings, no_meeting_dates: true }, fresh().period),
    ).toEqual([])
    expect(() =>
      meetingOccurrences(1, { ...record.meetings, user_entered: true }, fresh().period),
    ).toThrow(/schedule/)
    const meetings = structuredClone(record.meetings)
    meetings.activity_patterns![0]!.weeks_of_month = '1,3'
    expect(() => meetingOccurrences(1, meetings, fresh().period)).toThrow(/schedule/)
  })

  it('paginates, deduplicates and avoids refetching calendar ids', async () => {
    const client = {
      searchFilters: vi.fn().mockResolvedValue({ categories }),
      searchPage: vi
        .fn()
        .mockResolvedValueOnce({ items: [record.item, { ...record.item, id: 1 }], totalPages: 2 })
        .mockResolvedValueOnce({ items: [record.item], totalPages: 2 }),
      programDetail: vi.fn().mockResolvedValue({ detail: record.detail }),
      programMeetings: vi
        .fn()
        .mockResolvedValue({ meeting_and_registration_dates: record.meetings }),
      programPrice: vi.fn().mockResolvedValue({ estimateprice: record.price }),
    }
    const out = await fetchPrograms({ client, snapshot: fresh() })
    expect(client.searchPage).toHaveBeenCalledTimes(2)
    expect(client.programDetail).toHaveBeenCalledOnce()
    expect(out.records).toHaveLength(1)
    expect(out.categories).toEqual(categories)
  })
})

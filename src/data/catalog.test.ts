import { describe, expect, it } from 'vitest'
import { index, snapshot } from '@/test/fixture'
import {
  buildActivityDetail,
  buildCatalog,
  buildCentres,
  buildSiteMeta,
  buildWeekShards,
  nextSession,
  occurrencesByActivity,
  weeksCovering,
} from './catalog'

describe('buildCatalog', () => {
  it('keeps the searchable fields and drops the heavy ones', () => {
    const catalog = buildCatalog(snapshot)
    expect(catalog.period).toEqual(snapshot.period)
    const swim = catalog.activities.find((a) => a.id === 1)!
    expect(swim).toMatchObject({
      title: 'Multi-sport',
      free: true,
      price: 0,
      instructors: ['Ada Lovelace'],
      blurb: 'Open gym for everyone.',
      openings: '100 openings remaining',
      availability: 'open',
      spaces: 100,
      first: '2026-09-07T07:00',
      last: '2026-09-08T14:00',
      n: 2,
    })
    expect(swim).not.toHaveProperty('description')
    expect(swim).not.toHaveProperty('url')
    const ball = catalog.activities.find((a) => a.id === 2)!
    expect(ball.price).toBe(5.55)
    expect(ball).toMatchObject({ availability: 'full', spaces: 0 })
    expect(ball).not.toHaveProperty('instructors')
    expect(ball).not.toHaveProperty('blurb')
  })
})

describe('buildCentres', () => {
  it('counts activities per centre and carries facilities', () => {
    const shard = buildCentres(snapshot)
    expect(shard.centres.map((c) => [c.id, c.activities])).toEqual([
      [63, 1],
      [180, 1],
    ])
    expect(shard.facilities).toEqual(snapshot.facilities)
  })
})

describe('buildWeekShards', () => {
  it('buckets sessions by Monday', () => {
    const weeks = buildWeekShards({
      ...snapshot,
      occurrences: [
        ...snapshot.occurrences,
        { a: 1, s: '2026-09-20T09:00', e: '2026-09-20T10:00' },
      ],
    })
    expect(weeks.map((w) => [w.week, w.occurrences.length])).toEqual([
      ['2026-09-07', 3],
      ['2026-09-14', 1],
    ])
  })
})

describe('weeksCovering', () => {
  it('lists every Monday touching the range', () => {
    expect(weeksCovering('2026-09-10', '2026-09-22')).toEqual([
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
    ])
    expect(weeksCovering('2026-09-14', '2026-09-14')).toEqual(['2026-09-14'])
  })
})

describe('nextSession', () => {
  const sessions = occurrencesByActivity(snapshot.occurrences).get(1)!
  it('prefers the first session on or after today, else the last', () => {
    expect(nextSession(sessions, '2026-09-08')?.s).toBe('2026-09-08T14:00')
    expect(nextSession(sessions, '2026-10-01')?.s).toBe('2026-09-08T14:00')
    expect(nextSession(sessions, '2026-01-01')?.s).toBe('2026-09-07T07:00')
    expect(nextSession([], '2026-09-08')).toBeUndefined()
  })
})

describe('buildActivityDetail', () => {
  it('joins centre, calendar, facilities, sessions and links', () => {
    const detail = buildActivityDetail(
      index,
      snapshot.activities[0]!,
      occurrencesByActivity(snapshot.occurrences).get(1)!,
      '2026-09-08',
    )
    expect(detail.center.name).toBe('Bonsor Recreation Complex (BON)')
    expect(detail.calendar.group).toBe('Drop-in')
    expect(detail.facilities).toEqual(['BON Gym 1/2/3'])
    expect(detail.descriptionText).toBe('Open gym for everyone.')
    expect(detail.sessions).toHaveLength(2)
    expect(detail.pageUrl).toBe('https://cobac.fyi/activities/1/')
    expect(detail.link).toBe(
      'https://cobac.fyi/?week=2026-09-07&centers=63&q=Multi-sport&activity=1',
    )
  })
})

describe('buildSiteMeta', () => {
  it('summarises counts, weeks and the generator version', () => {
    expect(buildSiteMeta(snapshot, '1.2.3')).toEqual({
      generatedAt: snapshot.generatedAt,
      period: snapshot.period,
      counts: { calendars: 4, centers: 2, activities: 2, occurrences: 3, enriched: 1 },
      weeks: ['2026-09-07'],
      version: '1.2.3',
    })
  })
})

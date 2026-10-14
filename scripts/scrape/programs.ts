import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import pLimit from 'p-limit'
import type { MeetingDates, ProgramRecord, SearchFilters, SearchItem } from './activity-search-api'
import type { Client } from './client'
import {
  applyEnrichment,
  cleanName,
  cleanTitle,
  instructorNames,
  priceLines,
  sanitizeDescription,
  summarizePrice,
} from './normalize'
import { addDays, dayOfWeek } from '../../src/data/dates'
import type { Occurrence, Snapshot } from '../../src/types/snapshot'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Exceptions use `11 Nov 2026`, unlike the ISO dates elsewhere in this API. */
function exceptionDates(value: string): string[] {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return [value]
  const match = /^(\d{1,2}(?:,\d{1,2})*) ([A-Z][a-z]{2}) (\d{4})$/.exec(value)
  const month = match ? MONTHS.indexOf(match[2]!) + 1 : 0
  if (!match || !month) throw new Error(`Unsupported schedule exception ${value}`)
  return match[1]!
    .split(',')
    .map((day) => `${match[3]}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`)
}

/** Expand only explicit weekly meetings; never infer dates from a human-readable label. */
export function meetingOccurrences(
  id: number,
  dates: MeetingDates,
  period: Snapshot['period'],
): Occurrence[] {
  if (dates.no_meeting_dates) return []
  if (dates.user_entered) throw new Error('Unsupported custom meeting schedule')
  const seen = new Map<string, Occurrence>()
  const addMeeting = (day: string, start: string, end: string) => {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      ![start, end].every((t) => /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(t))
    )
      throw new Error('Invalid meeting schedule date or time')
    if (day < period.start || day > period.end) return
    const s = `${day}T${start.slice(0, 5)}`
    const endDay = end < start ? addDays(day, 1) : day
    seen.set(s, { a: id, s, e: `${endDay}T${end.slice(0, 5)}` })
  }
  for (const pattern of dates.activity_patterns ?? []) {
    if (pattern.weeks_of_month) throw new Error('Unsupported weeks-of-month schedule')
    const start = pattern.beginning_date > period.start ? pattern.beginning_date : period.start
    const end = pattern.ending_date < period.end ? pattern.ending_date : period.end
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end))
      throw new Error('Invalid meeting schedule date')
    const exceptions = new Set(pattern.exception_dates.flatMap(exceptionDates))
    for (const meeting of pattern.pattern_dates) {
      const weekdays =
        meeting.weekdays === 'Weekend'
          ? ['Sat', 'Sun']
          : meeting.weekdays.split(/[,;\s]+/).filter(Boolean)
      if (!weekdays.length || weekdays.some((d) => !DAYS.includes(d)))
        throw new Error('Unsupported weekday schedule')
      if (![meeting.starting_time, meeting.ending_time].every((t) => /^\d{2}:\d{2}:\d{2}$/.test(t)))
        throw new Error('Invalid meeting schedule time')
      for (let day = start; day <= end; day = addDays(day, 1)) {
        if (exceptions.has(day) || !weekdays.includes(DAYS[dayOfWeek(day)]!)) continue
        addMeeting(day, meeting.starting_time, meeting.ending_time)
      }
    }
  }
  for (const extra of dates.additional_dates ?? [])
    addMeeting(extra.meeting_date, extra.starting_time, extra.ending_time)
  return [...seen.values()].sort((a, b) => a.s.localeCompare(b.s))
}

function programGroup(category: string): string {
  if (
    [
      'Ceramics',
      'Crafts',
      'Creative Writing',
      'Dance',
      'Media',
      'Music',
      'Theatre & Film',
      'Visual Arts',
    ].includes(category)
  )
    return 'Art & Culture'
  if (['Group Fitness', 'Weight Training', 'Wellness', 'Yoga'].includes(category)) return 'Fitness'
  if (
    [
      'Golf',
      'Gymnastics',
      'Indoor / Gym Sports',
      'Martial Arts',
      'Outdoor Recreation',
      'Racquet Sports',
      'Skating',
      'Swimming',
    ].includes(category)
  )
    return 'Sports'
  return 'Programs'
}

/** Keep original calendar records; use negative category ids for synthetic program calendars. */
export function mergePrograms(
  snapshot: Snapshot,
  records: ProgramRecord[],
  categories: SearchFilters['categories'],
  log: (message: string) => void = () => {},
  searchCenters: NonNullable<SearchFilters['centers']> = [],
): number {
  const ids = new Set(snapshot.activities.map((a) => a.id))
  let added = 0
  for (const { item, detail, meetings, price } of records) {
    if (ids.has(item.id)) continue
    try {
      if (detail.activity_id !== item.id || detail.activity_name !== item.name)
        throw new Error('Activity search/detail identity mismatch')
      const occurrences = meetingOccurrences(item.id, meetings, snapshot.period)
      if (!occurrences.length) continue
      // The snapshot has one centre per activity. Do not invent a venue for multi-centre records.
      const listedCenters = searchCenters.filter((c) => c.desc === item.site)
      const existingCenters = snapshot.centers.filter((c) => c.name === item.site)
      const fallback =
        detail.centers.length === 0 && listedCenters.length === 1 ? listedCenters[0] : undefined
      const center =
        detail.centers[0] ??
        (fallback ? { id: Number(fallback.id), name: fallback.desc } : undefined) ??
        (detail.centers.length === 0 && existingCenters.length === 1
          ? existingCenters[0]
          : undefined)
      if (!center || detail.centers.length > 1)
        throw new Error('Activity has no unambiguous centre')
      const category = categories.find((c) => c.desc.replaceAll('&amp;', '&') === item.category)
      if (!category || !Number.isInteger(Number(category.id)) || Number(category.id) <= 0)
        throw new Error(`Unknown category ${item.category}`)
      const calendarId = -Number(category.id)
      if (!snapshot.calendars.some((c) => c.id === calendarId))
        snapshot.calendars.push({
          id: calendarId,
          name: `Programs: ${item.category}`,
          group: programGroup(item.category),
        })
      if (!snapshot.centers.some((c) => c.id === center.id))
        snapshot.centers.push({ id: center.id, name: cleanName(center.name) })
      for (const f of detail.facilities)
        if (!snapshot.facilities.some((existing) => existing.id === f.id))
          snapshot.facilities.push({
            id: f.id,
            name: cleanName(f.name),
            centerId: f.center_id || center.id,
          })
      const prices = priceLines(price)
      const priceText = summarizePrice(price, prices)
      snapshot.activities.push({
        id: item.id,
        title: cleanTitle(item.name),
        calendarId,
        centerId: center.id,
        facilityIds: detail.facilities.map((f) => f.id),
        url: item.detail_url,
        description: sanitizeDescription(detail.catalog_description),
        instructors: instructorNames(detail.instructors),
        priceText,
        free: price.free || priceText === 'Free',
      })
      snapshot.occurrences.push(...occurrences)
      applyEnrichment(snapshot, new Map([[item.id, { ...detail, price }]]))
      ids.add(item.id)
      added++
    } catch (error) {
      log(`program ${item.id} skipped: ${error instanceof Error ? error.message : error}`)
    }
  }
  snapshot.activities.sort((a, b) => a.id - b.id)
  snapshot.occurrences.sort((a, b) => a.s.localeCompare(b.s) || a.a - b.a)
  snapshot.calendars.sort((a, b) => a.name.localeCompare(b.name))
  snapshot.centers.sort((a, b) => a.name.localeCompare(b.name))
  snapshot.facilities.sort((a, b) => a.name.localeCompare(b.name))
  return added
}

type ProgramClient = Pick<
  Client,
  'searchFilters' | 'searchPage' | 'programDetail' | 'programMeetings' | 'programPrice'
>

/** Search all in-progress/future listings through the calendar window, then fetch missing ids. */
export async function fetchPrograms({
  client,
  snapshot,
  cacheDir,
  log = () => {},
}: {
  client: ProgramClient
  snapshot: Snapshot
  cacheDir?: string
  log?: (message: string) => void
}): Promise<{
  records: ProgramRecord[]
  categories: SearchFilters['categories']
  centers: NonNullable<SearchFilters['centers']>
}> {
  const { categories, centers = [] } = await client.searchFilters()
  const existing = new Set(snapshot.activities.map((a) => a.id))
  const items = new Map<number, SearchItem>()
  let totalPages = 1
  for (let page = 1; page <= totalPages; page++) {
    const result = await client.searchPage(page, snapshot.period.end)
    if (!Number.isInteger(result.totalPages) || result.totalPages < 0 || result.totalPages > 1000)
      throw new Error('Invalid activity-search page count')
    totalPages = result.totalPages
    for (const item of result.items) {
      if (existing.has(item.id)) continue
      if (
        item.date_range_start > snapshot.period.end ||
        (item.date_range_end && item.date_range_end < snapshot.period.start)
      )
        continue
      items.set(item.id, item)
    }
    if (page % 50 === 0 || page === totalPages)
      log(`activity search page ${page}/${totalPages}: ${items.size} missing ids`)
  }
  if (cacheDir) await mkdir(cacheDir, { recursive: true })
  const records: ProgramRecord[] = []
  const run = pLimit(4)
  let done = 0,
    failed = 0
  await Promise.all(
    [...items.values()].map((item) =>
      run(async () => {
        try {
          const file = cacheDir ? path.join(cacheDir, `${item.id}.json`) : undefined
          let record: ProgramRecord | undefined
          if (file)
            try {
              record = JSON.parse(await readFile(file, 'utf8')) as ProgramRecord
            } catch {
              /* cache miss */
            }
          if (!record) {
            const { detail } = await client.programDetail(item.id)
            const { meeting_and_registration_dates: meetings } = await client.programMeetings(
              item.id,
            )
            const { estimateprice: price } = await client.programPrice(item.id)
            record = { item, detail, meetings, price }
            if (file) await writeFile(file, JSON.stringify(record))
          }
          // Keep the fresh search identity even if the local detail cache is older.
          records.push({ ...record, item })
        } catch (error) {
          failed++
          log(`program ${item.id} failed: ${error instanceof Error ? error.message : error}`)
        } finally {
          done++
          if (done % 250 === 0 || done === items.size)
            log(`program details ${done}/${items.size} (${failed} failed)`)
        }
      }),
    ),
  )
  return { records: records.sort((a, b) => a.item.id - b.item.id), categories, centers }
}

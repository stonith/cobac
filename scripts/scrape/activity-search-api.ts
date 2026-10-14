import type { RawDetailCenter, RawInstructor, RawPrice } from './api'

/** Fields consumed from Burnaby's separate activity-search API. */
export interface SearchItem {
  id: number
  name: string
  category: string
  site?: string
  detail_url: string
  date_range_start: string
  date_range_end: string
}

export interface SearchFilters {
  categories: { id: string; desc: string }[]
  centers?: { id: string; desc: string }[]
}

export interface SearchPage {
  items: SearchItem[]
  totalPages: number
}

export interface ProgramDetail {
  activity_id: number
  activity_name: string
  category: string
  catalog_description: string
  centers: RawDetailCenter[]
  facilities: { id: number; name: string; center_id: number }[]
  instructors: RawInstructor[]
  age_min_year: number | null
  age_max_year: number | null
  age_description: string
  space_status: string
  space_type: number
  first_date: string
  last_date: string
}

export interface MeetingDates {
  no_meeting_dates: boolean
  user_entered: boolean
  additional_dates: { meeting_date: string; starting_time: string; ending_time: string }[] | null
  activity_patterns:
    | {
        beginning_date: string
        ending_date: string
        weeks_of_month: string
        exception_dates: string[]
        pattern_dates: { weekdays: string; starting_time: string; ending_time: string }[]
      }[]
    | null
}

export interface ProgramRecord {
  item: SearchItem
  detail: ProgramDetail
  meetings: MeetingDates
  price: RawPrice
}

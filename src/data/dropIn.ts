import { htmlToText } from './text'

interface DropInEvidence {
  title: string
  description: string
}

const normalize = (text: string) =>
  text
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
const DROP_IN = /\bdrop[- ]?ins?\b/i
const EXCLUDED =
  /\bno\s+drop[- ]?ins?\b|\bdrop[- ]?ins?\s+(?:(?:are|is)\s+)?(?:not\s+(?:allowed|permitted|available|accepted)|unavailable)\b/i
const PERMITTED =
  /\bdrop[- ]?ins?\s+(?:(?:are|is)\s+)?(?:welcome|allowed|permitted|available|accepted)\b|\bdrop[- ]?in\s+if\s+(?:spots|spaces?)\s+(?:are\s+)?available\b|\bdrop[- ]?in\s+option\s+(?:is\s+)?available\b/i

/**
 * Burnaby participation classification, not a promise of walk-in access. Reservation titles
 * and explicit drop-in titles/permission are positive evidence; explicit exclusions win.
 * A passing mention of a drop-in rate/pass alone is insufficient. Source Drop-in calendars
 * remain positive evidence for generic titles such as Multi-sport.
 */
export function isDropInActivity(activity: DropInEvidence, calendarGroup?: string): boolean {
  const title = normalize(activity.title)
  const description = normalize(htmlToText(activity.description))
  if (EXCLUDED.test(title) || EXCLUDED.test(description)) return false
  return (
    /^reserve\s+in\s+advance\s*:/i.test(title) ||
    DROP_IN.test(title) ||
    calendarGroup === 'Drop-in' ||
    PERMITTED.test(description)
  )
}

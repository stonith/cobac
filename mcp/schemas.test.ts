import { describe, expect, it } from 'vitest'
import { calendarIdList, idList } from './schemas'

describe('supplemental calendar ids', () => {
  it('accepts negative calendar category ids without weakening centre/activity validation', () => {
    expect(calendarIdList.parse([-26, 4])).toEqual([-26, 4])
    expect(calendarIdList.safeParse([0]).success).toBe(false)
    expect(calendarIdList.safeParse([1.5]).success).toBe(false)
    expect(idList.safeParse([-26]).success).toBe(false)
  })
})

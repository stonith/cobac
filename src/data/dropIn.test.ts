import { describe, expect, it } from 'vitest'
import { isDropInActivity } from './dropIn'

describe('Burnaby drop-in classification', () => {
  it.each([
    ['Reserve In Advance: Adult Badminton', '', undefined, true],
    ['Reserve In Advance: Shoot and Score 18yrs+', 'No instruction provided.', 'Sports', true],
    ['Drop-In Modern Dance: Open level', '', 'Art & Culture', true],
    ['Basketball Drop In', '', 'Sports', true],
    ['Multi-sport', '', 'Drop-in', true],
    ['Modern Dance', '<p>Drop-ins are welcome.</p>', 'Art & Culture', true],
    ['Hockey', 'Reserve ahead or drop-in if spots are available.', 'Sports', true],
    ['Fitness course', 'Customers pay the drop-in rate.', 'Fitness', false],
    ['Ballet Advanced', 'No Drop-in.', 'Art & Culture', false],
    ['Tap', 'No drop-in option.', 'Art & Culture', false],
    ['Drop-in Dance', 'Drop-ins are not permitted.', 'Art & Culture', false],
    ['Reserve In Advance: Dance', 'No drop-ins.', 'Fitness', false],
    ['Dance', 'Drop-ins are not available.', 'Drop-in', false],
    ['Yoga', '', 'Fitness', false],
  ] as const)(
    'classifies %s with its description and calendar evidence',
    (title, description, group, expected) => {
      expect(isDropInActivity({ title, description }, group)).toBe(expected)
    },
  )

  it('normalizes Unicode hyphens and HTML entities before checking exclusions', () => {
    expect(
      isDropInActivity(
        { title: 'Dance', description: '<p>No drop&#8209;in option.</p>' },
        'Drop-in',
      ),
    ).toBe(false)
    expect(isDropInActivity({ title: 'Drop–In Dance', description: '' })).toBe(true)
  })
})

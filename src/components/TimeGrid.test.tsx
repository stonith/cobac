import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { applyFilters, emptyFilters, groupByHourAndDay } from '@/data/filters'
import { index } from '@/test/fixture'
import { TimeGrid } from './TimeGrid'

const week = '2026-09-07'
const grid = groupByHourAndDay(applyFilters(index, emptyFilters(week)))
const base = {
  index,
  weekStart: week,
  grid,
  days: [] as number[],
  onSelect: () => {},
  compact: false,
  selectedDay: week,
  onSelectDay: () => {},
}

describe('TimeGrid', () => {
  it('renders hourly rows from the earliest to the latest session', () => {
    render(<TimeGrid {...base} />)
    expect(screen.getAllByRole('columnheader')).toHaveLength(8)
    const hours = screen.getAllByRole('rowheader').map((h) => h.textContent)
    expect(hours[0]).toBe('7 am')
    expect(hours.at(-1)).toBe('6 pm')
    expect(hours).toHaveLength(12)
  })

  it('stacks sessions from every location and labels each with its centre', async () => {
    const onSelect = vi.fn()
    render(<TimeGrid {...base} onSelect={onSelect} />)
    const sport = screen.getAllByRole('button', { name: /Multi-sport/ })
    expect(sport).toHaveLength(2)
    expect(sport[0]).toHaveTextContent('Bonsor Recreation Complex (BON)')
    const badminton = screen.getByRole('button', { name: /Adult Badminton/ })
    expect(badminton).toHaveTextContent('Rosemary Brown Recreation Centre (RBR)')
    await userEvent.click(badminton)
    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('limits rows to the hours used by the selected day in compact mode', () => {
    render(<TimeGrid {...base} compact selectedDay="2026-09-12" />)
    expect(screen.getAllByRole('columnheader')).toHaveLength(2)
    expect(screen.getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['6 pm'])
  })

  it('shows an empty state when nothing matches', () => {
    render(<TimeGrid {...base} grid={new Map()} />)
    expect(screen.getByText(/No sessions match/)).toBeInTheDocument()
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { index } from '@/test/fixture'
import { Legend } from './Legend'

describe('Legend', () => {
  it('toggles drop-in participation independently of calendar groups', async () => {
    const onToggleDropIn = vi.fn()
    const onToggleGroup = vi.fn()
    render(
      <Legend
        index={{ ...index, groups: ['Fitness', 'Sports'] }}
        calendarIds={[4]}
        dropInOnly={true}
        onToggleDropIn={onToggleDropIn}
        onToggleGroup={onToggleGroup}
      />,
    )
    const button = screen.getByRole('button', { name: 'Drop-in' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveAttribute('title', expect.stringContaining('booking may be required'))
    await userEvent.click(button)
    expect(onToggleDropIn).toHaveBeenCalledOnce()
    expect(onToggleGroup).not.toHaveBeenCalled()
  })
  it('lists every group and toggles one on click', async () => {
    const onToggleGroup = vi.fn()
    render(
      <Legend
        index={index}
        calendarIds={[]}
        dropInOnly={false}
        onToggleDropIn={() => {}}
        onToggleGroup={onToggleGroup}
      />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(3)
    await userEvent.click(screen.getByRole('button', { name: 'Sports' }))
    expect(onToggleGroup).toHaveBeenCalledWith('Sports')
  })

  it('marks fully selected groups pressed and dims unselected ones while filtering', () => {
    render(
      <Legend
        index={index}
        calendarIds={[6]}
        dropInOnly={false}
        onToggleDropIn={() => {}}
        onToggleGroup={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Drop-in' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Sports' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Sports' }).className).toContain('opacity-40')
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { index } from '@/test/fixture'
import { ActivityPanel } from './ActivityPanel'

describe('ActivityPanel', () => {
  it('renders nothing when no activity is selected', () => {
    render(<ActivityPanel index={index} activityId={null} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows activity details, sessions and the ActiveNet link', () => {
    render(<ActivityPanel index={index} activityId={1} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Multi-sport')
    expect(dialog).toHaveTextContent('Bonsor Recreation Complex (BON) · BON Gym 1/2/3')
    expect(dialog).toHaveTextContent('All ages')
    expect(dialog).toHaveTextContent('100 openings remaining')
    expect(dialog).toHaveTextContent('Ada Lovelace')
    expect(dialog).toHaveTextContent('Sep 1, 2026 – Nov 10, 2026')
    expect(dialog).toHaveTextContent('Sessions (2)')
    expect(dialog).toHaveTextContent('Open gym for everyone.')
    expect(screen.getByRole('link', { name: /ActiveNet/ })).toHaveAttribute(
      'href',
      'https://ca.apm.activecommunities.com/burnaby/Activity_Search/multi-sport/1',
    )
  })

  it('lists the full fee table when available', () => {
    render(<ActivityPanel index={index} activityId={2} onClose={() => {}} />)
    const fees = screen.getByRole('list', { name: 'Fees' })
    expect(fees).toHaveTextContent('Youth (19-25 yrs) fee for up to 25 years old$5.55')
    expect(fees).toHaveTextContent('Adult (26-64 yrs) fee for 26 up to 64 years old$7.40')
  })

  it('calls onClose when dismissed', async () => {
    const onClose = vi.fn()
    render(<ActivityPanel index={index} activityId={2} onClose={onClose} />)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})

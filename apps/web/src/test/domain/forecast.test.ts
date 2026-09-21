import { describe, expect, it } from 'vitest'
import { forecastAsOf } from '../../domain/balances'

describe('forecast mode labeling', () => {
  it('settled mode for today', () => {
    const r = forecastAsOf('2026-01-10', '2026-01-10', [], [])
    expect(r.mode).toBe('settled')
  })
})

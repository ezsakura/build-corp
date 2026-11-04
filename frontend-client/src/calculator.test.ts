import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { calculateEstimate } from './calculator'

describe('calculateEstimate', () => {
  it('calculates a roof estimate with area and complexity', () => {
    assert.equal(calculateEstimate(7316, 100, 0.9), 658440)
  })

  it('calculates configurable rates for different measurement units', () => {
    assert.equal(calculateEstimate(4800, 50, 1), 240000)
    assert.equal(calculateEstimate(9968, 20, 1.25), 249200)
  })

  it('returns zero for invalid inputs', () => {
    assert.equal(calculateEstimate(6200, 0, 1), 0)
    assert.equal(calculateEstimate(6200, -5, 1), 0)
    assert.equal(calculateEstimate(6200, 10, Number.NaN), 0)
    assert.equal(calculateEstimate(-1, 10, 1), 0)
  })
})
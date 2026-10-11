import { describe, it, expect } from 'vitest'
import { isHoneypotTripped, hashIp } from './spam'

describe('honeypot', () => {
  it('passes when the hidden field is missing or empty', () => {
    expect(isHoneypotTripped({ email: 'a@b.com' })).toBe(false)
    expect(isHoneypotTripped({ _gotcha: '' })).toBe(false)
    expect(isHoneypotTripped({ _gotcha: '   ' })).toBe(false)
  })
  it('flags a filled hidden field', () => {
    expect(isHoneypotTripped({ _gotcha: 'buy cheap pills' })).toBe(true)
  })
})

describe('hashIp', () => {
  it('is deterministic and does not leak the raw IP', () => {
    const h = hashIp('1.2.3.4', 'salt')
    expect(h).toBe(hashIp('1.2.3.4', 'salt'))
    expect(h).not.toContain('1.2.3.4')
    expect(h).not.toBe(hashIp('1.2.3.5', 'salt'))
  })
})

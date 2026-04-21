import { useState, useRef } from 'react'
import { COUNTRY_CODES, getCodeFromValue } from '../config/formFields.js'
import { loginUser } from '../lib/users.js'
import { logAction } from '../lib/audit.js'

export default function LoginScreen({ onLogin }) {
  const [phoneCode, setPhoneCode] = useState('+91')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState(['', '', '', ''])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const pinRefs = [useRef(), useRef(), useRef(), useRef()]

  const handlePhone = (e) => {
    setPhone(e.target.value.replace(/[^\d\s]/g, ''))
  }

  const handlePin = (index, val) => {
    if (!/^\d?$/.test(val)) return
    const next = [...pin]
    next[index] = val
    setPin(next)
    if (val && index < 3) pinRefs[index + 1].current?.focus()
  }

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (!text) return
    e.preventDefault()
    const next = ['', '', '', '']
    for (let i = 0; i < text.length; i++) next[i] = text[i]
    setPin(next)
    const focusIdx = Math.min(text.length, 3)
    pinRefs[focusIdx].current?.focus()
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs[index - 1].current?.focus()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    const code = getCodeFromValue(phoneCode)
    const fullPhone = code + ' ' + phone.trim()
    const fullPin = pin.join('')
    if (!phone.trim()) { setError('Enter your phone number'); return }
    if (fullPin.length < 4) { setError('Enter your 4-digit PIN'); return }
    setLoading(true)
    try {
      const user = await loginUser(fullPhone, fullPin)
      if (!user) {
        setShake(true)
        setTimeout(() => setShake(false), 500)
        setError('Invalid phone or PIN')
        setPin(['', '', '', ''])
        pinRefs[0].current?.focus()
        return
      }
      await logAction(user.id, user.name, 'login', 'session', null, null)
      localStorage.setItem('ambria_user', JSON.stringify(user))
      onLogin(user)
    } catch (err) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit} noValidate>
        <div className="login-brand">
          <div className="brand-mark" aria-hidden="true">A</div>
          <div className="login-brand-text">Ambria Calendar</div>
        </div>

        <div className="login-field">
          <label className="field-label">Phone</label>
          <div className="phone-combo">
            <select
              className="phone-code-select"
              value={phoneCode}
              onChange={(e) => setPhoneCode(e.target.value)}
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.value} value={c.value}>{c.flag} {c.code}</option>
              ))}
            </select>
            <input
              type="text"
              value={phone}
              onChange={handlePhone}
              placeholder="98765 43210"
              inputMode="tel"
              autoComplete="tel"
            />
          </div>
        </div>

        <div className="login-field">
          <label className="field-label">PIN</label>
          <div className={`pin-boxes ${shake ? 'shake' : ''}`}>
            {pin.map((d, i) => (
              <input
                key={i}
                ref={pinRefs[i]}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handlePin(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
                className="pin-box"
                autoComplete="off"
              />
            ))}
          </div>
        </div>

        {error && <div className="login-error">{error}</div>}

        <button type="submit" className="btn-save login-btn" disabled={loading}>
          {loading ? 'Signing in\u2026' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}

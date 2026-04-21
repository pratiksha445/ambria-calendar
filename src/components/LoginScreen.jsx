import { useState, useRef } from 'react'
import { COUNTRY_CODES, getCodeFromValue } from '../config/formFields.js'
import { loginUser, checkPhoneStatus, requestAccess } from '../lib/users.js'
import { logAction } from '../lib/audit.js'

export default function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'success'
  const [phoneCode, setPhoneCode] = useState('+91')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState(['', '', '', ''])
  const [name, setName] = useState('')
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

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    const code = getCodeFromValue(phoneCode)
    const fullPhone = code + ' ' + phone.trim()
    const fullPin = pin.join('')
    if (!phone.trim()) { setError('Enter your phone number'); return }
    if (fullPin.length < 4) { setError('Enter your 4-digit PIN'); return }
    setLoading(true)
    try {
      const result = await loginUser(fullPhone, fullPin)
      switch (result.status) {
        case 'ok':
          await logAction(result.user.id, result.user.name, 'login', 'session', null, null)
          localStorage.setItem('ambria_user', JSON.stringify(result.user))
          onLogin(result.user)
          return
        case 'pending':
          setShake(true)
          setTimeout(() => setShake(false), 500)
          setError('Your access request is pending approval. Please wait for an admin to approve your account.')
          break
        case 'rejected':
          setShake(true)
          setTimeout(() => setShake(false), 500)
          setError('Your access request was declined.' + (result.reason ? ' Reason: ' + result.reason : ''))
          break
        case 'deactivated':
          setShake(true)
          setTimeout(() => setShake(false), 500)
          setError('Your account has been deactivated. Contact an admin.')
          break
        case 'not_found':
        case 'wrong_pin':
        default:
          setShake(true)
          setTimeout(() => setShake(false), 500)
          setError('Invalid phone or PIN')
          break
      }
      setPin(['', '', '', ''])
      pinRefs[0].current?.focus()
    } catch (err) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Enter your name'); return }
    if (!phone.trim()) { setError('Enter your phone number'); return }
    setLoading(true)
    try {
      const code = getCodeFromValue(phoneCode)
      const fullPhone = code + ' ' + phone.replace(/[^\d\s]/g, '').trim()

      // Check if phone already exists
      const existing = await checkPhoneStatus(fullPhone)
      if (existing) {
        if (existing.approval_status === 'pending') {
          setError('A request with this phone number is already pending.')
        } else if (existing.approval_status === 'rejected') {
          setError('This phone number was previously declined. Contact an admin.')
        } else {
          setError('This phone number is already registered. Try signing in.')
        }
        return
      }

      await requestAccess(name.trim(), fullPhone)
      setMode('success')
    } catch (err) {
      const msg = err?.message ?? String(err)
      if (msg.includes('duplicate') || msg.includes('unique')) {
        setError('This phone number is already registered.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const switchToSignup = () => {
    setMode('signup')
    setError(null)
    setPin(['', '', '', ''])
  }

  const switchToLogin = () => {
    setMode('login')
    setError(null)
    setName('')
  }

  if (mode === 'success') {
    return (
      <div className="login-screen">
        <div className="login-card signup-success">
          <div className="success-icon" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="9 12 11.5 14.5 16 9.5" />
            </svg>
          </div>
          <h2>Request Submitted</h2>
          <p className="success-text">
            Your access request has been sent. An admin will review and approve your account. You'll be able to sign in once approved.
          </p>
          <button type="button" className="btn-save login-btn" onClick={switchToLogin}>
            Back to Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="login-screen">
      <form
        className="login-card"
        onSubmit={mode === 'login' ? handleLogin : handleSignup}
        noValidate
      >
        <div className="login-brand">
          <div className="brand-mark" aria-hidden="true">A</div>
          <div className="login-brand-text">Ambria Calendar</div>
        </div>

        {mode === 'signup' && (
          <div className="login-field">
            <label className="field-label">Name</label>
            <input
              type="text"
              className="login-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
            />
          </div>
        )}

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

        {mode === 'login' && (
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
        )}

        {error && <div className="login-error">{error}</div>}

        <button type="submit" className="btn-save login-btn" disabled={loading}>
          {loading
            ? (mode === 'login' ? 'Signing in\u2026' : 'Submitting\u2026')
            : (mode === 'login' ? 'Sign In' : 'Request Access')
          }
        </button>

        <div className="login-link">
          {mode === 'login' ? (
            <span>
              Don't have an account?{' '}
              <button type="button" className="link-btn" onClick={switchToSignup}>
                Request Access
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button type="button" className="link-btn" onClick={switchToLogin}>
                Sign In
              </button>
            </span>
          )}
        </div>
      </form>
    </div>
  )
}

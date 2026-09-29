// ============================================================
// LoginScreen.jsx
//
// WHAT THIS FILE IS
//   Everything a logged-out person sees, as one small state machine:
//
//     signup  --submit-->  waiting  --admin approves-->  setpin  --> app
//                             |
//                             +--rejected--> "declined" card (Start over)
//     login  (Phone + PIN, for staff who already have a PIN)
//
// WHY IT EXISTS
//   A brand-new person should land on Request Access, not on a PIN box they
//   can't use. After submitting, this device remembers the request
//   (signupSession.js), so reopening the app shows the waiting screen again.
//   It checks the status every 15s and whenever the app comes back to the
//   foreground, then moves on to Set PIN by itself. There is no default
//   0000 PIN any more.
//
//   Which screen opens first:
//     pending request on this device  -> waiting
//     otherwise, always               -> signup (Request Access)
//   Existing staff tap "Sign In" under the form. The phone box there is
//   pre-filled with the last number that signed in on this device.
//
// USED BY
//   src/App.jsx (rendered whenever there is no logged-in user)
//
// DEPENDS ON
//   src/lib/users.js, src/lib/signupSession.js, src/components/SetPinScreen.jsx,
//   src/lib/pushNotifications.js, src/lib/audit.js, i18n context
// ============================================================

import { useState, useRef, useEffect } from 'react'
import { COUNTRY_CODES, getCodeFromValue, parsePhoneCode, DEPARTMENTS, SALES_TYPES, SALES_DEPARTMENTS } from '../config/formFields.js'
import { loginUser, checkPhoneStatus, requestAccess, getSignupStatus, completeSignup } from '../lib/users.js'
import { readPendingSignup, savePendingSignup, clearPendingSignup, readLastPhone, rememberPhone, forgetPhone } from '../lib/signupSession.js'
import { logAction } from '../lib/audit.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { isPushSupported, subscribeToPush } from '../lib/pushNotifications.js'
import SetPinScreen from './SetPinScreen.jsx'

const STATUS_POLL_MS = 5000

function pickInitialMode() {
  return readPendingSignup() ? 'waiting' : 'signup'
}

export default function LoginScreen({ onLogin, initialNotice }) {
  const { t, lang, setLang, theme } = useLanguage()
  // Read once on mount. These decide the first screen and pre-fill the phone box.
  const [pending, setPending] = useState(readPendingSignup) // { phone, token, name } | null
  const [initialPhone] = useState(() => parsePhoneCode(readPendingSignup()?.phone || readLastPhone()))
  const [mode, setMode] = useState(pickInitialMode) // 'signup' | 'login' | 'waiting' | 'setpin'
  const [signupStatus, setSignupStatus] = useState(null) // { status, name, rejection_reason } from the RPC
  const [checkNonce, setCheckNonce] = useState(0) // bump to force an immediate status check
  const [checking, setChecking] = useState(false)
  const [statusError, setStatusError] = useState(null) // last failed status check, shown on the waiting card
  const [phoneCode, setPhoneCode] = useState(initialPhone.value)
  const [phone, setPhone] = useState(initialPhone.number.replace(/\D/g, '').slice(0, 10))
  const [pin, setPin] = useState(['', '', '', ''])
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [department, setDepartment] = useState('')
  const [salesType, setSalesType] = useState('')
  const [error, setError] = useState(initialNotice || null)
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const [notifEnabled, setNotifEnabled] = useState(true)
  const [notifSubscribed, setNotifSubscribed] = useState(false)
  const pinRefs = [useRef(), useRef(), useRef(), useRef()]

  const handlePhone = (e) => {
    setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
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
    if (!phone.trim()) { setError(t('Enter your phone number')); return }
    if (fullPin.length < 4) { setError(t('Enter your 4-digit PIN')); return }
    setLoading(true)
    try {
      const result = await loginUser(fullPhone, fullPin)
      switch (result.status) {
        case 'ok':
          await logAction(result.user.id, result.user.name, 'login', 'session', null, { summary: 'Logged in' })
          localStorage.setItem('ambria_user', JSON.stringify(result.user))
          rememberPhone(fullPhone)
          clearPendingSignup()
          onLogin(result.user, result.needsPinChange)
          return
        case 'pending':
          setShake(true)
          setTimeout(() => setShake(false), 500)
          setError(t('Your access request is pending approval. Please wait for an admin to approve your account.'))
          break
        case 'rejected':
          setShake(true)
          setTimeout(() => setShake(false), 500)
          setError(t('Your access request was declined.') + (result.reason ? ' ' + t('Reason:') + ' ' + result.reason : ''))
          break
        case 'deactivated':
          setShake(true)
          setTimeout(() => setShake(false), 500)
          setError(t('Your account has been deactivated. Contact an admin.'))
          break
        case 'not_found':
          // The remembered number no longer has an account (e.g. it was deleted):
          // stop opening this device on Sign In for it.
          if (readLastPhone() === fullPhone) forgetPhone()
          setShake(true)
          setTimeout(() => setShake(false), 500)
          setError(t('Invalid phone or PIN'))
          break
        case 'wrong_pin':
        default:
          setShake(true)
          setTimeout(() => setShake(false), 500)
          setError(t('Invalid phone or PIN'))
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
    if (!firstName.trim()) { setError(t('First name is required')); return }
    if (!lastName.trim()) { setError(t('Last name is required')); return }
    if (!department) { setError(t('Department is required')); return }
    const isSalesDept = SALES_DEPARTMENTS.includes(department)
    if (isSalesDept && !salesType) { setError(t('Sales Type is required')); return }
    if (!phone.trim()) { setError(t('Enter your phone number')); return }
    setLoading(true)
    try {
      const code = getCodeFromValue(phoneCode)
      const fullPhone = code + ' ' + phone.replace(/[^\d\s]/g, '').trim()

      // Check if phone already exists
      const existing = await checkPhoneStatus(fullPhone)
      if (existing) {
        // This device already sent this request (e.g. the page was reloaded
        // mid-submit), so resume waiting instead of showing an error.
        const mine = readPendingSignup()
        if (existing.approval_status === 'pending' && mine?.phone === fullPhone) {
          setPending(mine)
          setMode('waiting')
          return
        }
        if (existing.approval_status === 'pending') {
          setError(t('A request with this phone number is already pending.'))
        } else if (existing.approval_status === 'rejected') {
          setError(t('This phone number was previously declined. Contact an admin.'))
        } else {
          setError(t('This phone number is already registered. Try signing in.'))
        }
        return
      }

      const name = firstName.trim() + ' ' + lastName.trim()
      const { token } = await requestAccess(name, fullPhone, department, isSalesDept ? salesType : null)
      // Save the token before anything else can fail. Losing it strands the
      // request, and only an admin PIN reset could recover it.
      const next = { phone: fullPhone, token, name }
      savePendingSignup(next)
      // Not awaited: the permission prompt and service-worker wait can take
      // forever (the SW never registers in `npm run dev`), and they must never
      // hold the user on "Submitting…". The waiting screen polls anyway.
      if (notifEnabled && isPushSupported()) {
        subscribeToPush(fullPhone).then((r) => setNotifSubscribed(r.success))
      }
      setPending(next)
      setSignupStatus({ status: 'pending', name, rejection_reason: null })
      setMode('waiting')
    } catch (err) {
      const msg = err?.message ?? String(err)
      if (msg.includes('duplicate') || msg.includes('unique')) {
        setError(t('This phone number is already registered.'))
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
    setFirstName('')
    setLastName('')
    setDepartment('')
    setSalesType('')
  }

  // Leave the waiting flow for good: forget the request on this device.
  const startOver = () => {
    clearPendingSignup()
    setPending(null)
    setSignupStatus(null)
    setError(null)
    setMode('signup')
  }

  // Poll the request status while waiting: every 5s, on foregrounding, and
  // on "Check now". A network error just keeps the waiting screen up.
  useEffect(() => {
    if (mode !== 'waiting' || !pending) return
    let cancelled = false
    const check = async () => {
      setChecking(true)
      try {
        const res = await getSignupStatus(pending.phone, pending.token)
        if (cancelled) return
        setStatusError(null)
        if (res.status === 'approved') {
          setSignupStatus(res)
          setMode('setpin')
        } else if (res.status === 'token_invalid') {
          // The PIN was already set (another tab, or via an admin reset). Sign in normally.
          clearPendingSignup()
          setPending(null)
          rememberPhone(pending.phone)
          setError(t('Your PIN is already set. Please sign in.'))
          setMode('login')
        } else if (res.status === 'not_found') {
          clearPendingSignup()
          setPending(null)
          setError(t('Your request was removed. Please submit a new one.'))
          setMode('signup')
        } else {
          setSignupStatus(res)
        }
      } catch (err) {
        // Keep waiting, but say why. A missing get_signup_status function
        // means migration 028 has not been run.
        if (!cancelled) setStatusError(err?.message ?? String(err))
      }
      finally { if (!cancelled) setChecking(false) }
    }
    check()
    const iv = setInterval(check, STATUS_POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(iv)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [mode, pending, checkNonce, t])

  // Approved: set the first PIN (proved by the token), then sign straight in.
  const handleFirstPin = async (newPin) => {
    const result = await completeSignup(pending.phone, pending.token, newPin)
    if (result === 'invalid_pin') throw new Error(t('Enter a 4-digit PIN'))
    if (result === 'not_approved') { setMode('waiting'); throw new Error(t('Your request is not approved yet.')) }
    if (result !== 'ok') throw new Error(t('This request can no longer set a PIN. Please sign in or contact an admin.'))

    const login = await loginUser(pending.phone, newPin)
    if (login.status !== 'ok') throw new Error(t('PIN saved. Please sign in.'))
    await logAction(login.user.id, login.user.name, 'set_pin', 'user', login.user.id, { summary: 'Set initial PIN', initial: true })
    await logAction(login.user.id, login.user.name, 'login', 'session', null, { summary: 'Logged in' })
    localStorage.setItem('ambria_user', JSON.stringify(login.user))
    rememberPhone(pending.phone)
    clearPendingSignup()
    onLogin(login.user, false)
  }

  if (mode === 'setpin' && pending) {
    return (
      <SetPinScreen
        user={{ name: signupStatus?.name || pending.name, phone: pending.phone }}
        onSave={handleFirstPin}
      />
    )
  }

  if (mode === 'waiting' && pending) {
    const rejected = signupStatus?.status === 'rejected'
    const deactivated = signupStatus?.status === 'deactivated'
    const blocked = rejected || deactivated
    return (
      <div className="login-screen">
        <div className="login-card signup-success">
          <div className="success-icon" aria-hidden="true">
            {blocked ? (
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            ) : (
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ambria-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            )}
          </div>
          <h2>
            {rejected ? t('Request Declined')
              : deactivated ? t('Account Deactivated')
              : t('Waiting for Approval')}
          </h2>
          <div className="set-pin-phone">{pending.phone}</div>
          <p className="success-text">
            {rejected
              ? t('Your access request was declined.') + (signupStatus.rejection_reason ? ' ' + t('Reason:') + ' ' + signupStatus.rejection_reason : '')
              : deactivated
                ? t('Your account has been deactivated. Contact an admin.')
                : t('Your request has been sent to an admin. You can close the app and come back later. Once approved, you will set your PIN here.')}
          </p>
          {!blocked && (
            <>
              <p className="success-text" style={{ marginTop: '-12px', fontSize: '13px' }}>
                {notifSubscribed
                  ? t("We'll notify you when your request is reviewed.")
                  : t('This page checks for approval automatically.')}
              </p>
              {statusError && <div className="login-error">{t('Could not check status:')} {statusError}</div>}
              <button type="button" className="btn-save login-btn" disabled={checking} onClick={() => setCheckNonce((n) => n + 1)}>
                {checking ? t('Checking…') : t('Check now')}
              </button>
            </>
          )}
          {blocked && (
            <button type="button" className="btn-save login-btn" onClick={startOver}>
              {t('Start over')}
            </button>
          )}
          <div className="login-link">
            <span>
              {t('Already have an account?')}{' '}
              <button type="button" className="link-btn" onClick={switchToLogin}>
                {t('Sign In')}
              </button>
            </span>
          </div>
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
          <div style={{ textAlign: 'center', lineHeight: 1.2, marginBottom: '4px', userSelect: 'none' }}>
            <div style={{ fontWeight: 700, fontSize: '22px', color: 'var(--ambria-accent)', fontFamily: 'inherit' }}>Ambria</div>
            <div style={{ fontWeight: 400, fontSize: '14px', color: 'var(--ambria-muted)', fontFamily: 'inherit' }}>Calendar</div>
          </div>
          <div className="lang-toggle">
            <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
            <span className="lang-sep">|</span>
            <button className={`lang-btn ${lang === 'hi' ? 'active' : ''}`} onClick={() => setLang('hi')}>हि</button>
          </div>
        </div>

        {mode === 'signup' && (
          <div className="name-row">
            <div className="login-field">
              <label className="field-label">{t('First Name')} <span className="required-star">*</span></label>
              <input
                type="text"
                className="login-input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                placeholder={t('First name')}
                autoComplete="given-name"
              />
            </div>
            <div className="login-field">
              <label className="field-label">{t('Last Name')} <span className="required-star">*</span></label>
              <input
                type="text"
                className="login-input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                placeholder={t('Last name')}
                autoComplete="family-name"
              />
            </div>
          </div>
        )}

        {mode === 'signup' && (
          <div className="name-row">
            <div className="login-field">
              <label className="field-label">{t('Department')} <span className="required-star">*</span></label>
              <select
                className="login-input"
                value={department}
                onChange={(e) => { setDepartment(e.target.value); if (!SALES_DEPARTMENTS.includes(e.target.value)) setSalesType('') }}
              >
                <option value="">{t('— Select —')}</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{t(d)}</option>
                ))}
              </select>
            </div>
            {SALES_DEPARTMENTS.includes(department) && (
              <div className="login-field">
                <label className="field-label">{t('Sales Type')} <span className="required-star">*</span></label>
                <select
                  className="login-input"
                  value={salesType}
                  onChange={(e) => setSalesType(e.target.value)}
                >
                  <option value="">{t('— Select —')}</option>
                  {SALES_TYPES.map((st) => (
                    <option key={st} value={st}>{t(st)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        <div className="login-field">
          <label className="field-label">{t('Phone')}</label>
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
            <label className="field-label">{t('PIN')}</label>
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

        {mode === 'signup' && isPushSupported() && (
          <div style={{ marginBottom: '8px', padding: '10px 12px', background: 'var(--ambria-chip)', borderRadius: '8px', fontSize: '13px' }}>
            <p style={{ margin: '0 0 6px', color: 'var(--ambria-ink)' }}>
              {t('Enable notifications to know when your request is approved')}
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--ambria-ink)' }}>
              <input
                type="checkbox"
                checked={notifEnabled}
                onChange={(e) => setNotifEnabled(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--ambria-accent)' }}
              />
              {t('Enable push notifications')}
            </label>
          </div>
        )}

        {error && <div className="login-error">{error}</div>}

        <button type="submit" className="btn-save login-btn" disabled={loading}>
          {loading
            ? (mode === 'login' ? t('Signing in…') : t('Submitting…'))
            : (mode === 'login' ? t('Sign In') : t('Request Access'))
          }
        </button>

        <div className="login-link">
          {mode === 'login' ? (
            <span>
              {t("Don't have an account?")}{' '}
              <button type="button" className="link-btn" onClick={switchToSignup}>
                {t('Request Access')}
              </button>
            </span>
          ) : (
            <span>
              {t('Already have an account?')}{' '}
              <button type="button" className="link-btn" onClick={switchToLogin}>
                {t('Sign In')}
              </button>
            </span>
          )}
        </div>
      </form>
    </div>
  )
}

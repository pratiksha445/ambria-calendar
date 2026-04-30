import { useState, useRef } from 'react'
import { COUNTRY_CODES, getCodeFromValue, DEPARTMENTS, SALES_TYPES, SALES_DEPARTMENTS } from '../config/formFields.js'
import { loginUser, checkPhoneStatus, requestAccess } from '../lib/users.js'
import { storeSession, applySession } from '../lib/supabase.js'
import { logAction } from '../lib/audit.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'

export default function LoginScreen({ onLogin }) {
  const { t, lang, setLang, theme } = useLanguage()
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'success'
  const [phoneCode, setPhoneCode] = useState('+91')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState(['', '', '', ''])
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [department, setDepartment] = useState('')
  const [salesType, setSalesType] = useState('')
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
    if (!phone.trim()) { setError(t('Enter your phone number')); return }
    if (fullPin.length < 4) { setError(t('Enter your 4-digit PIN')); return }
    setLoading(true)
    try {
      const result = await loginUser(fullPhone, fullPin)
      if (result.status === 'ok') {
        storeSession(result.access_token, result.expires_at, result.user)
        await applySession(result.access_token)
        await logAction(result.user.id, result.user.name, 'login', 'session', null, { summary: 'Logged in' })
        onLogin(result.user)
        return
      }
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setError(t('Invalid phone or PIN'))
      setPin(['', '', '', ''])
      pinRefs[0].current?.focus()
    } catch {
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setError(t('Invalid phone or PIN'))
      setPin(['', '', '', ''])
      pinRefs[0].current?.focus()
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
        if (existing.approval_status === 'pending') {
          setError(t('A request with this phone number is already pending.'))
        } else if (existing.approval_status === 'rejected') {
          setError(t('This phone number was previously declined. Contact an admin.'))
        } else {
          setError(t('This phone number is already registered. Try signing in.'))
        }
        return
      }

      await requestAccess(firstName.trim() + ' ' + lastName.trim(), fullPhone, department, isSalesDept ? salesType : null)
      setMode('success')
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
          <h2>{t('Request Submitted')}</h2>
          <p className="success-text">
            {t("Your access request has been sent. An admin will review and approve your account. You'll be able to sign in once approved.")}
          </p>
          <button type="button" className="btn-save login-btn" onClick={switchToLogin}>
            {t('Back to Sign In')}
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
          <img src={import.meta.env.BASE_URL + (theme === 'dark' ? 'logo-dark.png' : 'logo.png')} alt="Ambria" className="login-logo" />
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

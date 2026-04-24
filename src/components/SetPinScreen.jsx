import { useState, useRef } from 'react'
import { setInitialPin } from '../lib/users.js'
import { logAction } from '../lib/audit.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'

function PinBoxes({ value, onChange, shake, label }) {
  const refs = [useRef(), useRef(), useRef(), useRef()]

  const handleChange = (index, val) => {
    if (!/^\d?$/.test(val)) return
    const next = [...value]
    next[index] = val
    onChange(next)
    if (val && index < 3) refs[index + 1].current?.focus()
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      refs[index - 1].current?.focus()
    }
  }

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (!text) return
    e.preventDefault()
    const next = ['', '', '', '']
    for (let i = 0; i < text.length; i++) next[i] = text[i]
    onChange(next)
    refs[Math.min(text.length, 3)].current?.focus()
  }

  return (
    <div className="set-pin-field">
      <label className="field-label">{label}</label>
      <div className={`pin-boxes ${shake ? 'shake' : ''}`}>
        {value.map((d, i) => (
          <input
            key={i}
            ref={refs[i]}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            className="pin-box"
            autoComplete="off"
          />
        ))}
      </div>
    </div>
  )
}

export default function SetPinScreen({ user, onComplete }) {
  const { t, theme } = useLanguage()
  const [newPin, setNewPin] = useState(['', '', '', ''])
  const [confirmPin, setConfirmPin] = useState(['', '', '', ''])
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [shake, setShake] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    const pin = newPin.join('')
    const confirm = confirmPin.join('')

    if (pin.length < 4) { setError(t('Enter a 4-digit PIN')); return }
    if (pin === '0000') {
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setError(t('PIN cannot be 0000'))
      return
    }
    if (pin !== confirm) {
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setError(t('PINs do not match'))
      setConfirmPin(['', '', '', ''])
      return
    }

    setSaving(true)
    try {
      await setInitialPin(user.id, pin)
      await logAction(user.id, user.name, 'set_pin', 'user', user.id, { initial: true })
      onComplete()
    } catch (err) {
      setError(err?.message ?? String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card set-pin-card" onSubmit={handleSubmit} noValidate>
        <div className="login-brand">
          <img src={import.meta.env.BASE_URL + (theme === 'dark' ? 'logo-dark.png' : 'logo.png')} alt="Ambria" className="login-logo" />
        </div>

        <div className="set-pin-message">
          {t('Welcome, {name}! Please set a 4-digit PIN for your account.', { name: (user.name || '').split(/\s+/)[0] })}
        </div>

        <PinBoxes value={newPin} onChange={setNewPin} shake={shake} label={t('New PIN')} />
        <PinBoxes value={confirmPin} onChange={setConfirmPin} shake={shake} label={t('Confirm PIN')} />

        {error && <div className="login-error">{error}</div>}

        <button type="submit" className="btn-save login-btn" disabled={saving}>
          {saving ? t('Setting PIN…') : t('Set PIN')}
        </button>
      </form>
    </div>
  )
}

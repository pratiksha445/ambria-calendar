import { useState, useRef, useEffect } from 'react'
import { changeSelfPin } from '../lib/users.js'
import { logAction } from '../lib/audit.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'

function PinBoxes({ value, onChange, label }) {
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
    <div className="cp-field">
      <label className="field-label">{label}</label>
      <div className="pin-boxes">
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

export default function ChangePinModal({ user, onClose, showToast }) {
  const { t } = useLanguage()
  const [currentPin, setCurrentPin] = useState(['', '', '', ''])
  const [newPin, setNewPin] = useState(['', '', '', ''])
  const [confirmPin, setConfirmPin] = useState(['', '', '', ''])
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    const cur = currentPin.join('')
    const pin = newPin.join('')
    const confirm = confirmPin.join('')

    if (cur.length < 4) { setError(t('Enter your current PIN')); return }
    if (pin.length < 4) { setError(t('Enter a 4-digit new PIN')); return }
    if (pin === '0000') { setError(t('PIN cannot be 0000')); return }
    if (pin !== confirm) {
      setError(t('New PINs do not match'))
      setConfirmPin(['', '', '', ''])
      return
    }

    setSaving(true)
    try {
      const result = await changeSelfPin(user.id, cur, pin)
      if (!result.success) {
        setError(result.error)
        setCurrentPin(['', '', '', ''])
        return
      }
      await logAction(user.id, user.name, 'change_pin', 'user', user.id, null)
      showToast?.(t('PIN updated'))
      onClose()
    } catch (err) {
      setError(err?.message ?? String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-root" role="dialog" aria-modal="true">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="panel-form-card cp-card">
        <h3>{t('Change PIN')}</h3>
        <form onSubmit={handleSubmit} noValidate>
          <PinBoxes value={currentPin} onChange={setCurrentPin} label={t('Current PIN')} />
          <PinBoxes value={newPin} onChange={setNewPin} label={t('New PIN')} />
          <PinBoxes value={confirmPin} onChange={setConfirmPin} label={t('Confirm New PIN')} />

          {error && <div className="login-error">{error}</div>}

          <div className="panel-form-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>{t('Cancel')}</button>
            <button type="submit" className="btn-save" disabled={saving}>
              {saving ? t('Updating…') : t('Update PIN')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

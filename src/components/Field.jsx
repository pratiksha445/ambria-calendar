// Single form field renderer. Reads config from src/config/formFields.js
// and handles showWhen / disabledWhen visibility + disabled states.
// Supports filterFn for live input validation (strips invalid chars + shows error).

import { useEffect, useRef, useState } from 'react'

export default function Field({ field, form, value, onChange, error, readOnly }) {
  const [filterErr, setFilterErr] = useState(null)
  const timerRef = useRef(null)

  // Auto-clear filter error after 1.5s
  useEffect(() => {
    if (!filterErr) return
    timerRef.current = setTimeout(() => setFilterErr(null), 1500)
    return () => clearTimeout(timerRef.current)
  }, [filterErr])

  if (field.showWhen && !field.showWhen(form)) return null

  const disabled = readOnly || !!(field.disabledWhen && field.disabledWhen(form))
  const id = `field-${field.key}`
  const effectiveValue = value ?? ''

  const handle = (e) => {
    let val = e.target.value
    if (field.filterFn && !disabled) {
      const filtered = field.filterFn(val)
      if (filtered !== val) {
        setFilterErr(field.filterError || 'Invalid input')
        val = filtered
      }
    }
    onChange(field.key, val)
  }

  const displayError = error || filterErr

  const commonProps = {
    id,
    name: field.key,
    value: effectiveValue,
    disabled,
    onChange: handle,
    'aria-invalid': !!displayError,
  }

  let control
  if (field.type === 'select') {
    control = (
      <select {...commonProps}>
        <option value="">— Select —</option>
        {field.options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    )
  } else if (field.type === 'textarea') {
    control = (
      <textarea
        {...commonProps}
        rows={3}
        placeholder={field.placeholder ?? ''}
      />
    )
  } else if (field.type === 'date') {
    control = <input type="date" {...commonProps} />
  } else if (field.type === 'time') {
    control = <input type="time" {...commonProps} />
  } else {
    control = (
      <input
        type="text"
        {...commonProps}
        placeholder={field.placeholder ?? ''}
        inputMode={field.inputMode}
      />
    )
  }

  return (
    <div className={`field ${displayError ? 'has-error' : ''} ${disabled ? 'is-disabled' : ''}`}>
      <label htmlFor={id} className="field-label">
        {field.label}
        {field.required && !disabled && <span className="required-star"> *</span>}
      </label>
      {control}
      {displayError && <div className="field-error">{displayError}</div>}
    </div>
  )
}

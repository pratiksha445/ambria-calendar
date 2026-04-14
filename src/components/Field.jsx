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
  } else if (field.mapLink) {
    control = (
      <div className="field-with-pin">
        <input
          type="text"
          {...commonProps}
          placeholder={field.placeholder ?? ''}
          inputMode={field.inputMode}
        />
        {effectiveValue && (
          <a
            href={getMapsUrl(effectiveValue)}
            target="_blank"
            rel="noopener noreferrer"
            className="map-pin-btn"
            aria-label="Open in Google Maps"
            onClick={(e) => e.stopPropagation()}
          >
            <MapPinIcon />
          </a>
        )}
      </div>
    )
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

function getMapsUrl(location) {
  if (!location) return '#'
  if (location.startsWith('http')) return location
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
}

function MapPinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E85D75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

// Single form field renderer. Reads config from src/config/formFields.js
// and handles showWhen / disabledWhen visibility + disabled states.
// Supports filterFn for live input validation (strips invalid chars + shows error).

import { useEffect, useRef, useState } from 'react'
import { COUNTRY_CODES } from '../config/formFields.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import SearchableSelect from './SearchableSelect.jsx'

export default function Field({ field, form, value, onChange, error, readOnly, activeUsers }) {
  const { t } = useLanguage()
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
    const options = field.getOptions ? field.getOptions(form) : field.options
    const optionValues = options.map((o) => typeof o === 'object' ? o.value : o)
    const hasLegacy = effectiveValue && !optionValues.includes(effectiveValue)
    control = (
      <select {...commonProps}>
        <option value="">{t('— Select —')}</option>
        {hasLegacy && <option value={effectiveValue}>{t(effectiveValue)}</option>}
        {options.map((opt) => {
          const val = typeof opt === 'object' ? opt.value : opt
          const label = typeof opt === 'object' ? opt.label : opt
          return <option key={val} value={val}>{t(label)}</option>
        })}
      </select>
    )
  } else if (field.type === 'searchable-select') {
    control = (
      <SearchableSelect
        id={id}
        value={effectiveValue}
        options={field.options || []}
        disabled={disabled}
        onChange={(val) => onChange(field.key, val)}
      />
    )
  } else if (field.type === 'textarea') {
    control = (
      <textarea
        {...commonProps}
        rows={3}
        placeholder={field.placeholder ? t(field.placeholder) : ''}
      />
    )
  } else if (field.type === 'date') {
    control = <input type="date" {...commonProps} />
  } else if (field.type === 'time') {
    if (field.inlineCheckbox) {
      const cb = field.inlineCheckbox
      const cbChecked = !!form[cb.key]
      control = (
        <div className="time-inline-row">
          <input type="time" {...commonProps} className="time-inline-input" />
          <label className={`time-inline-cb ${disabled ? 'is-disabled' : ''}`}>
            <input
              type="checkbox"
              checked={cbChecked}
              disabled={disabled}
              onChange={(e) => onChange(cb.key, e.target.checked)}
            />
            <span>{cb.label}</span>
          </label>
        </div>
      )
    } else {
      control = <input type="time" {...commonProps} />
    }
  } else if (field.type === 'checkbox') {
    return (
      <div className={`field field-checkbox ${disabled ? 'is-disabled' : ''}`}>
        <label className="field-checkbox-row">
          <input
            type="checkbox"
            checked={!!value}
            disabled={disabled}
            onChange={(e) => onChange(field.key, e.target.checked)}
          />
          <span className="field-checkbox-text">{t(field.label)}</span>
        </label>
      </div>
    )
  } else if (field.type === 'multiselect') {
    const selected = Array.isArray(value) ? value : []
    // Options can be strings or { value, label } objects
    const opts = (field.options || []).map((o) =>
      typeof o === 'object' ? o : { value: o, label: o }
    )
    const optValues = new Set(opts.map((o) => o.value))
    // Legacy: selected values not in current options (deactivated/removed elements)
    const legacy = selected.filter((v) => !optValues.has(v))
    const toggle = (val) => {
      if (disabled) return
      const next = selected.includes(val)
        ? selected.filter((v) => v !== val)
        : [...selected, val]
      onChange(field.key, next)
    }
    return (
      <div className={`field field-multiselect ${displayError ? 'has-error' : ''} ${disabled ? 'is-disabled' : ''}`}>
        <label className="field-label">
          {t(field.label)}
          {(field.required || (field.requiredWhen && field.requiredWhen(form))) && !disabled && <span className="required-star"> *</span>}
        </label>
        {field.helperText && (() => {
          const ht = typeof field.helperText === 'function' ? field.helperText(form) : field.helperText
          return ht ? <div className="field-helper">{t(ht)}</div> : null
        })()}
        <div className="multiselect-grid">
          {opts.map((opt) => (
            <label key={opt.value} className={`multiselect-chip ${selected.includes(opt.value) ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}>
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                disabled={disabled}
              />
              <span>{opt.label}</span>
            </label>
          ))}
          {legacy.map((val) => (
            <label key={val} className={`multiselect-chip selected legacy ${disabled ? 'disabled' : ''}`}>
              <input
                type="checkbox"
                checked
                onChange={() => toggle(val)}
                disabled={disabled}
              />
              <span>{val}</span>
            </label>
          ))}
        </div>
        {displayError && <div className="field-error">{t(displayError)}</div>}
      </div>
    )
  } else if (field.type === 'user-select') {
    const listId = `userlist-${field.key}`
    // activeUsers is [{id, name}] — extract names for datalist
    const users = activeUsers || []
    const userNames = users.map((u) => typeof u === 'string' ? u : u.name)
    const currentVal = commonProps.value || ''
    const hasStored = currentVal && !userNames.includes(currentVal)
    const isEmpty = field.userFilter && users.length === 0 && !currentVal
    const idKey = field.key + '_id'
    const handleUserChange = (e) => {
      const name = e.target.value
      onChange(field.key, name)
      // Dual-write: also set the _id field when a matching user is found
      const match = users.find((u) => (typeof u === 'string' ? u : u.name) === name)
      onChange(idKey, match && typeof match === 'object' ? match.id : null)
    }
    const handleClear = (e) => {
      e.preventDefault()
      e.stopPropagation()
      onChange(field.key, '')
      onChange(idKey, null)
    }
    control = (
      <div className="user-select-wrap">
        <input
          type="text"
          {...commonProps}
          className="user-select-input"
          onChange={handleUserChange}
          list={listId}
          autoComplete="off"
          placeholder={isEmpty && field.userEmptyMsg ? t(field.userEmptyMsg) : t('Search users…')}
        />
        <div className="user-select-icons">
          {currentVal && !disabled && (
            <button type="button" className="field-clear-btn" onMouseDown={handleClear} aria-label="Clear" tabIndex={-1}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
          <span className="user-select-chevron" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </span>
        </div>
        <datalist id={listId}>
          {hasStored && <option key="__stored" value={currentVal} />}
          {userNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>
    )
  } else if (field.suffix) {
    control = (
      <div className="field-with-suffix">
        <input
          type="text"
          {...commonProps}
          placeholder={field.placeholder ? t(field.placeholder) : ''}
          inputMode={field.inputMode}
        />
        <span className="field-suffix">{field.suffix}</span>
      </div>
    )
  } else if (field.mapLink) {
    control = (
      <div className="field-with-pin">
        <input
          type="text"
          {...commonProps}
          placeholder={field.placeholder ? t(field.placeholder) : ''}
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
  } else if (field.type === 'phone') {
    const handleCode = (e) => onChange('phone_code', e.target.value)
    const handleNum = (e) => {
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
    control = (
      <div className="phone-combo">
        <select
          className="phone-code-select"
          value={form.phone_code || '+91'}
          onChange={handleCode}
          disabled={disabled}
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.value} value={c.value}>{c.flag} {c.code}</option>
          ))}
        </select>
        <input
          type="text"
          id={id}
          name={field.key}
          value={effectiveValue}
          disabled={disabled}
          onChange={handleNum}
          placeholder={field.placeholder ? t(field.placeholder) : ''}
          inputMode="tel"
          aria-invalid={!!displayError}
        />
      </div>
    )
  } else if (field.inlineCheckbox) {
    const cb = field.inlineCheckbox
    const cbChecked = !!form[cb.key]
    control = (
      <div className="time-inline-row">
        <input
          type="text"
          {...commonProps}
          className="time-inline-input"
          placeholder={field.placeholder ? t(field.placeholder) : ''}
          inputMode={field.inputMode}
        />
        <label className={`time-inline-cb ${disabled ? 'is-disabled' : ''}`}>
          <input
            type="checkbox"
            checked={cbChecked}
            disabled={disabled}
            onChange={(e) => onChange(cb.key, e.target.checked)}
          />
          <span>{cb.label}</span>
        </label>
      </div>
    )
  } else {
    control = (
      <input
        type="text"
        {...commonProps}
        placeholder={field.placeholder ? t(field.placeholder) : ''}
        inputMode={field.inputMode}
      />
    )
  }

  return (
    <div className={`field ${displayError ? 'has-error' : ''} ${disabled ? 'is-disabled' : ''} ${field.fullWidth ? 'field-full-width' : ''}`}>
      <label htmlFor={id} className="field-label">
        {t(field.label)}
        {(field.required || (field.requiredWhen && field.requiredWhen(form))) && !disabled && <span className="required-star"> *</span>}
      </label>
      {field.helperText && (() => {
        const ht = typeof field.helperText === 'function' ? field.helperText(form) : field.helperText
        return ht ? <div className="field-helper">{t(ht)}</div> : null
      })()}
      {control}
      {displayError && <div className="field-error">{t(displayError)}</div>}
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

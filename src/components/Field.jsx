// Single form field renderer. Reads config from src/config/formFields.js
// and handles showWhen / disabledWhen visibility + disabled states.

export default function Field({ field, form, value, onChange, error, readOnly }) {
  if (field.showWhen && !field.showWhen(form)) return null

  const disabled = readOnly || !!(field.disabledWhen && field.disabledWhen(form))
  const id = `field-${field.key}`
  const effectiveValue = value ?? ''

  const handle = (e) => onChange(field.key, e.target.value)

  const commonProps = {
    id,
    name: field.key,
    value: effectiveValue,
    disabled,
    onChange: handle,
    'aria-invalid': !!error,
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
      />
    )
  }

  return (
    <div className={`field ${error ? 'has-error' : ''} ${disabled ? 'is-disabled' : ''}`}>
      <label htmlFor={id} className="field-label">
        {field.label}
        {field.required && !disabled && <span className="required-star"> *</span>}
      </label>
      {control}
      {error && <div className="field-error">{error}</div>}
    </div>
  )
}

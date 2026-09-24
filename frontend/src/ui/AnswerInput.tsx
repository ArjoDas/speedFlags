import { useEffect, useMemo, useRef, useState } from 'react'
import type { Country } from '../api/client'
import { suggestions } from '../game/search'

type Props = {
  countries: Country[]
  disabled: boolean
  questionId: string
  onAnswer: (text: string) => void
  onSkip: () => void
}
export function AnswerInput({ countries, disabled, questionId, onAnswer, onSkip }: Props) {
  const [text, setText] = useState('')
  const [active, setActive] = useState(-1)
  const [open, setOpen] = useState(false)
  const [composing, setComposing] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const options = useMemo(() => suggestions(countries, text), [countries, text])
  useEffect(() => {
    setText('')
    setActive(-1)
    setOpen(false)
  }, [questionId])
  useEffect(() => {
    if (!disabled) input.current?.focus({ preventScroll: true })
  }, [disabled, questionId])
  function choose(name: string) {
    setText(name)
    setActive(-1)
    setOpen(false)
    input.current?.focus()
  }
  return (
    <form
      className="answer-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (disabled || composing || !text.trim()) return
        if (open && active >= 0 && options[active]) {
          choose(options[active].name)
          return
        }
        setOpen(false)
        onAnswer(text.trim())
      }}
    >
      <label htmlFor="answer">Which country or territory is this?</label>
      <div className="input-row">
        <input
          ref={input}
          id="answer"
          role="combobox"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          aria-autocomplete="list"
          aria-controls="country-options"
          aria-expanded={open && options.length > 0}
          aria-activedescendant={open && active >= 0 ? `option-${active}` : undefined}
          aria-describedby="answer-help"
          placeholder="Type a country name…"
          maxLength={100}
          value={text}
          disabled={disabled}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          onChange={(event) => {
            setText(event.target.value)
            setActive(-1)
            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setOpen(true)
              setActive((i) => Math.min(i + 1, options.length - 1))
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActive((i) => Math.max(-1, i - 1))
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              setOpen(false)
              setActive(-1)
            }
          }}
          onBlur={(event) => {
            if (!event.currentTarget.form?.contains(event.relatedTarget)) setOpen(false)
          }}
        />
        <button className="primary submit" type="submit" disabled={disabled || !text.trim()}>
          Submit <span aria-hidden="true">↵</span>
        </button>
      </div>
      {open && options.length > 0 && (
        <ul
          id="country-options"
          className="suggestions"
          role="listbox"
          aria-label="Country suggestions"
        >
          {options.map((country, i) => (
            <li
              key={country.id}
              id={`option-${i}`}
              role="option"
              aria-selected={i === active}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(country.name)}
            >
              {country.name}
              <span>{country.id}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="answer-footer">
        <p id="answer-help">Type an answer or choose a suggestion.</p>
        <button type="button" className="text-button" onClick={onSkip} disabled={disabled}>
          Skip flag <span aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  )
}

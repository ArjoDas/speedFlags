import { useEffect, useRef, type ReactNode } from 'react'

type Props = {
  open: boolean
  busy: boolean
  onDismiss: () => void
  onVisibilityChange: (visible: boolean) => void
  children: ReactNode
}

export function SettingsDialog({ open, busy, onDismiss, onVisibilityChange, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current!
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!open && !element.open) return
    if (open && !element.open) element.showModal()
    onVisibilityChange(true)
    element.dataset.closing = String(!open)
    const frames = [
      { opacity: 0, transform: 'translateY(12px) scale(.98)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' },
    ]
    const animation = element.animate(open ? frames : [...frames].reverse(), {
      duration: reduced ? 0 : 180,
      easing: 'ease-out',
      fill: 'both',
    })
    animation.finished
      .then(() => {
        if (!open) {
          element.close()
          onVisibilityChange(false)
          document.getElementById('answer')?.focus({ preventScroll: true })
        }
      })
      .catch(() => {
        /* Opening again or unmounting cancels the previous transition. */
      })
    return () => animation.cancel()
  }, [open, onVisibilityChange])

  return (
    <dialog
      ref={dialog}
      className="settings-dialog"
      aria-labelledby="settings-heading"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onDismiss()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onDismiss()
      }}
    >
      <div className="settings-content">
        <div className="settings-heading">
          <h1 id="settings-heading">New game</h1>
          <button
            type="button"
            className="close-settings"
            aria-label="Close settings"
            disabled={busy}
            onClick={onDismiss}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}

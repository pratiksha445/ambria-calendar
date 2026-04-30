// Horizontal swipe gesture hook for calendar navigation.
// Attaches pointer events to a ref'd element, applies CSS transform
// during drag for visual feedback, and calls onPrev/onNext on commit.
// Uses a callback ref so listeners are attached once (not re-attached on render).

import { useEffect, useRef } from 'react'

const DIST_THRESHOLD = 50    // px minimum horizontal distance
const DRIFT_MAX = 60          // px max vertical drift before abort
const VELOCITY_THRESHOLD = 0.3 // px/ms — quick flick override

const HINT_KEY = 'ambria_swipe_hint_seen'

export default function useSwipeNav(elRef, { onPrev, onNext }) {
  // Keep callbacks in a ref so the event handlers always see the latest
  const cb = useRef({ onPrev, onNext })
  useEffect(() => { cb.current = { onPrev, onNext } }, [onPrev, onNext])

  const gesture = useRef(null) // active gesture state

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    function handleDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (e.target.closest('.modal-root, .booking-form, .day-modal, .time-popup')) return

      gesture.current = {
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        t0: Date.now(),
        dx: 0,
        aborted: false,
        committed: false,
        locked: false,
      }
      el.style.transition = 'none'
      // NOTE: Do NOT setPointerCapture here — capturing eagerly prevents the
      // browser click event from reaching child elements (buttons, pills,
      // EventCards). Capture is deferred to handleMove once the gesture is
      // confirmed horizontal (g.locked = true).
    }

    function handleMove(e) {
      const g = gesture.current
      if (!g || g.id !== e.pointerId || g.aborted || g.committed) return

      const dx = e.clientX - g.x0
      const dy = e.clientY - g.y0

      // Early direction lock — first 10px of motion decides axis
      if (!g.locked) {
        if (Math.sqrt(dx * dx + dy * dy) > 10) {
          if (Math.abs(dy) > Math.abs(dx)) {
            // Vertical-dominant → abort, let page scroll
            g.aborted = true
            el.style.transition = 'transform 200ms ease-out'
            el.style.transform = ''
            return
          }
          g.locked = true
          el.setPointerCapture(e.pointerId)
        }
      }

      // Abort if vertical drift exceeds limit
      if (Math.abs(dy) > DRIFT_MAX) {
        g.aborted = true
        el.style.transition = 'transform 200ms ease-out'
        el.style.transform = ''
        return
      }

      g.dx = dx
      el.style.transform = `translate3d(${dx * 0.4}px,0,0)`
    }

    function handleUp(e) {
      const g = gesture.current
      if (!g || g.id !== e.pointerId) return
      gesture.current = null

      if (g.aborted) {
        el.style.transition = 'transform 200ms ease-out'
        el.style.transform = ''
        return
      }

      const dx = g.dx
      const dt = Date.now() - g.t0
      const velocity = dt > 0 ? Math.abs(dx) / dt : 0
      const commit = Math.abs(dx) >= DIST_THRESHOLD ||
                     (velocity >= VELOCITY_THRESHOLD && Math.abs(dx) > 20)

      if (commit) {
        const dir = dx < 0 ? -1 : 1
        el.style.transition = 'transform 200ms ease-out'
        el.style.transform = `translate3d(${dir * 80}px,0,0)`
        g.committed = true
        setTimeout(() => {
          el.style.transition = 'none'
          el.style.transform = ''
          if (dir < 0) cb.current.onNext()
          else cb.current.onPrev()
        }, 200)
      } else {
        el.style.transition = 'transform 200ms ease-out'
        el.style.transform = ''
      }
    }

    function handleCancel(e) {
      const g = gesture.current
      if (!g || g.id !== e.pointerId) return
      gesture.current = null
      el.style.transition = 'transform 200ms ease-out'
      el.style.transform = ''
    }

    // Prevent default touchmove only when gesture is confirmed horizontal
    function handleTouchMove(e) {
      const g = gesture.current
      if (g && g.locked && !g.aborted && !g.committed) {
        e.preventDefault()
      }
    }

    el.addEventListener('pointerdown', handleDown)
    el.addEventListener('pointermove', handleMove)
    el.addEventListener('pointerup', handleUp)
    el.addEventListener('pointercancel', handleCancel)
    el.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      el.removeEventListener('pointerdown', handleDown)
      el.removeEventListener('pointermove', handleMove)
      el.removeEventListener('pointerup', handleUp)
      el.removeEventListener('pointercancel', handleCancel)
      el.removeEventListener('touchmove', handleTouchMove)
    }
  }, [elRef])

  // One-time swipe hint
  useEffect(() => {
    if (localStorage.getItem(HINT_KEY) === '1') return
    localStorage.setItem(HINT_KEY, '1')
    const hint = document.createElement('div')
    hint.className = 'swipe-hint'
    hint.textContent = '\u2190 Swipe to navigate \u2192'
    document.body.appendChild(hint)
    setTimeout(() => {
      hint.style.opacity = '0'
      setTimeout(() => hint.remove(), 400)
    }, 3000)
  }, [])
}

import { useEffect, useRef } from 'react'
import { installArvanChangeHooks, runArvanSync } from '../domain/arvan-sync'

const INTERVAL_MS = 60_000
const DEBOUNCE_PUSH_MS = 2_500

/**
 * Background Arvan sync: every 1 minute, and debounced push after local writes
 * (dirty flag is set by Dexie hooks).
 */
export function useArvanSync(enabledBoot: boolean) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabledBoot) return
    installArvanChangeHooks()

    const tick = () => {
      void runArvanSync()
    }

    // initial sync shortly after boot
    const boot = setTimeout(tick, 1500)
    timerRef.current = setInterval(tick, INTERVAL_MS)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisibility)

    const onStorageHint = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(tick, DEBOUNCE_PUSH_MS)
    }
    window.addEventListener('bahesab-data-changed', onStorageHint)

    const onPulled = () => {
      // Remote ledger replaced local IndexedDB — refresh UI
      window.location.reload()
    }
    window.addEventListener('bahesab-ledger-pulled', onPulled)

    return () => {
      clearTimeout(boot)
      if (timerRef.current) clearInterval(timerRef.current)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('bahesab-data-changed', onStorageHint)
      window.removeEventListener('bahesab-ledger-pulled', onPulled)
    }
  }, [enabledBoot])
}

/** Fire after mutations so sync debounces a push (hooks also mark dirty). */
export function notifyDataChanged(): void {
  window.dispatchEvent(new Event('bahesab-data-changed'))
}

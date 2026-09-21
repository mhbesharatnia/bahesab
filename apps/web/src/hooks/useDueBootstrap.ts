import { useEffect, useState } from 'react'
import { todayISO } from '../lib/dates'
import { getSettings } from '../lib/db'
import { runDueBootstrap } from '../domain/due-processing'

export function useDueBootstrap(): { ready: boolean; converted: number } {
  const [ready, setReady] = useState(false)
  const [converted, setConverted] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const settings = await getSettings()
        const n = await runDueBootstrap(todayISO(), settings.dueMode)
        if (!cancelled) setConverted(n)
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { ready, converted }
}

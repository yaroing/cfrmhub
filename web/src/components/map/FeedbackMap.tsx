import { lazy, Suspense, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MapPoint } from './FeedbackMapInner'

const FeedbackMapInner = lazy(() => import('./FeedbackMapInner'))

type Props = { pins: MapPoint[] }

function MapSkeleton() {
  return (
    <div
      className="flex h-full min-h-[18rem] flex-col items-center justify-center gap-2 rounded-2xl bg-[var(--surface-hover)] text-sm text-[var(--text-muted)] md:min-h-[24rem]"
      aria-hidden
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-sky-500" />
      <span>Chargement de la carte…</span>
    </div>
  )
}

export function FeedbackMap({ pins }: Props) {
  const { t } = useTranslation()
  const pts = pins.filter((f) => f.lat != null && f.lng != null)

  const [deferMount, setDeferMount] = useState(false)

  useEffect(() => {
    if (pts.length === 0) return

    let cancelled = false
    const enable = () => {
      if (!cancelled) setDeferMount(true)
    }

    let idleId: number | undefined
    const useIdle = typeof requestIdleCallback !== 'undefined'
    if (useIdle) {
      idleId = requestIdleCallback(enable, { timeout: 500 })
    } else {
      idleId = window.setTimeout(enable, 80) as unknown as number
    }

    return () => {
      cancelled = true
      if (useIdle && idleId !== undefined) cancelIdleCallback(idleId)
      else window.clearTimeout(idleId)
    }
  }, [pts.length])

  if (pts.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-center text-sm text-[var(--text-muted)]">
        {t('dashboard.mapNoPinsHelp')}
      </div>
    )
  }

  return (
    <div className="h-72 overflow-hidden rounded-2xl border border-[var(--border)] md:h-96">
      {!deferMount ? (
        <MapSkeleton />
      ) : (
        <Suspense fallback={<MapSkeleton />}>
          <FeedbackMapInner pts={pts} />
        </Suspense>
      )}
    </div>
  )
}

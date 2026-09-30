import { useSyncExternalStore } from 'react'

export interface ChartColors {
  expense: string
  income: string
  grid: string
  text: string
  muted: string
  surface: string
  primary: string
}

function read(): ChartColors {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(name).trim()
  return {
    expense: v('--chart-expense'),
    income: v('--chart-income'),
    grid: v('--chart-grid'),
    text: v('--text'),
    muted: v('--text-muted'),
    surface: v('--surface'),
    primary: v('--primary'),
  }
}

// SVG attributes can't take var(), so Recharts gets resolved colours; the cache is
// refreshed whenever the theme class on <html> changes.
let cached: ChartColors | null = null
let cacheKey = ''

function snapshot(): ChartColors {
  const key = document.documentElement.className
  if (!cached || key !== cacheKey) {
    cached = read()
    cacheKey = key
  }
  return cached
}

function subscribe(notify: () => void) {
  const observer = new MutationObserver(notify)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

export function useChartColors(): ChartColors {
  return useSyncExternalStore(subscribe, snapshot)
}

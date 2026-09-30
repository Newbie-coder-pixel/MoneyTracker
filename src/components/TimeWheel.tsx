import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'

const ITEM = 44 // px per row; also the touch target height
const pad = (n: number) => String(n).padStart(2, '0')
const HOURS = Array.from({ length: 24 }, (_, h) => pad(h))

/** iOS-style scroll wheel for a `HH:MM` time: an hour column and a minute column that snap to the centre row. */
export function TimeWheel({ value, onChange, minuteStep = 5 }: { value: string; onChange: (time: string) => void; minuteStep?: number }) {
  const [h, m] = value.split(':')
  const minutes = Array.from({ length: 60 / minuteStep }, (_, i) => pad(i * minuteStep))
  // Keep a previously saved off-step minute (e.g. 21:07) selectable instead of silently moving it.
  if (!minutes.includes(m)) {
    minutes.push(m)
    minutes.sort()
  }

  return (
    <div className="relative flex items-center justify-center gap-1">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 h-11 -translate-y-1/2 rounded-full bg-surface-muted" />
      <Wheel items={HOURS} value={h} onChange={(hour) => onChange(`${hour}:${m}`)} label="Jam" />
      <span aria-hidden="true" className="relative text-2xl font-semibold">
        :
      </span>
      <Wheel items={minutes} value={m} onChange={(minute) => onChange(`${h}:${minute}`)} label="Menit" />
    </div>
  )
}

function Wheel({ items, value, onChange, label }: { items: string[]; value: string; onChange: (v: string) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined)
  const index = Math.max(0, items.indexOf(value))
  const [active, setActive] = useState(index)

  // Bring the selected row to the centre on mount and when the value changes from outside.
  useLayoutEffect(() => {
    const el = ref.current
    if (el && Math.round(el.scrollTop / ITEM) !== index) el.scrollTop = index * ITEM
  }, [index])

  const scrollTo = (i: number) => ref.current?.scrollTo({ top: Math.min(Math.max(i, 0), items.length - 1) * ITEM, behavior: 'smooth' })

  const onScroll = () => {
    const el = ref.current!
    const i = Math.min(Math.max(Math.round(el.scrollTop / ITEM), 0), items.length - 1)
    setActive(i)
    // Commit once the snap has settled, not on every scroll frame.
    clearTimeout(settle.current)
    settle.current = setTimeout(() => onChange(items[i]), 120)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    scrollTo(active + (e.key === 'ArrowDown' ? 1 : -1))
  }

  return (
    <div
      ref={ref}
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={Number(items[active])}
      aria-valuetext={items[active]}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      className="relative h-[220px] w-20 snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-2xl outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-scrollbar]:hidden"
      style={{ paddingBlock: ITEM * 2, maskImage: 'linear-gradient(transparent, #000 35%, #000 65%, transparent)' }}
    >
      {items.map((item, i) => (
        <div
          key={item}
          onClick={() => scrollTo(i)}
          className={`grid h-11 snap-center place-items-center text-2xl tabular-nums transition-colors ${i === active ? 'font-semibold text-text' : 'text-text-muted'}`}
        >
          {item}
        </div>
      ))}
    </div>
  )
}

import { createElement } from 'react'
import { tint } from '../lib/palette'
import { iconFor } from './icons'

type IconBadgeProps = {
  icon: string
  color: string
  size?: 'sm' | 'md' | 'lg'
  /** Solid fill (selected state) instead of a soft tint. */
  solid?: boolean
}

const SIZES = { sm: 'size-9 [&>svg]:size-4', md: 'size-11 [&>svg]:size-5', lg: 'size-12 [&>svg]:size-6' }

export function IconBadge({ icon, color, size = 'md', solid = false }: IconBadgeProps) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full ${SIZES[size]}`}
      style={solid ? { background: color, color: '#fff' } : { background: tint(color, 0.15), color }}
      aria-hidden="true"
    >
      {createElement(iconFor(icon))}
    </span>
  )
}

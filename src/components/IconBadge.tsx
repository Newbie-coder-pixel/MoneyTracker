import { createElement } from 'react'
import { iconFor } from './icons'

type IconBadgeProps = {
  icon: string
  color: string
  size?: 'sm' | 'md' | 'lg'
  /** Solid fill (selected state) instead of the paper tile. */
  solid?: boolean
}

const SIZES = { sm: 'size-9 rounded-lg [&>svg]:size-4', md: 'size-11 rounded-[10px] [&>svg]:size-5', lg: 'size-12 rounded-xl [&>svg]:size-6' }

/** Icon on a small paper tile; the user's picked colour inks the glyph. */
export function IconBadge({ icon, color, size = 'md', solid = false }: IconBadgeProps) {
  return (
    <span
      className={`grid shrink-0 place-items-center border ${SIZES[size]} ${solid ? 'border-transparent' : 'border-border bg-surface-muted'}`}
      style={solid ? { background: color, color: '#fff' } : { color }}
      aria-hidden="true"
    >
      {createElement(iconFor(icon), { strokeWidth: 1.75 })}
    </span>
  )
}

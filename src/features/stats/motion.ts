/** Recharts animations are off when the user asks for reduced motion (PRD §7.1). */
export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

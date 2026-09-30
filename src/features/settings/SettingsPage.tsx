import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { useTheme } from '../../hooks/useTheme'
import type { ThemePreference } from '../../lib/theme'

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Terang', icon: Sun },
  { value: 'dark', label: 'Gelap', icon: Moon },
  { value: 'system', label: 'Sistem', icon: Monitor },
]

export function SettingsPage() {
  const { preference, setPreference } = useTheme()

  return (
    <>
      <AppHeader title="Pengaturan" back />
      <main className="space-y-6 p-4">
        {/* Later stages add month start day, hide balance, PIN, reminders and delete-all (FR-10). */}
        <section className="rounded-3xl bg-surface p-4">
          <h2 id="theme-heading" className="font-semibold">
            Tema Aplikasi
          </h2>
          <p className="mb-3 text-sm text-text-muted">Pilih tampilan terang, gelap, atau ikuti HP.</p>
          <div role="radiogroup" aria-labelledby="theme-heading" className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-muted p-1">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
              const selected = preference === value
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPreference(value)}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-sm font-medium ${
                    selected ? 'bg-surface text-primary shadow-sm' : 'text-text-muted'
                  }`}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {label}
                </button>
              )
            })}
          </div>
        </section>
      </main>
    </>
  )
}

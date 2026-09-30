import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './app/router'
import './hooks/useTheme' // registers the system-theme listener at startup
import './pwa/install-prompt' // must catch beforeinstallprompt early
import './pwa/register' // service worker from the first visit (offline + push)
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

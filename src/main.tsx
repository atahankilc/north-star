import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './styles/global.css'
import './state/theme'
import { takeSandboxParam } from './onboarding/devSandbox'

// Dev only: `?onboarding=reset` / `=real`, read before the router can drop it (devSandbox.ts).
if (import.meta.env.DEV) takeSandboxParam()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { assertEnv } from './config/env'
import './i18n'
import './index.css'
import App from './App.tsx'

assertEnv()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

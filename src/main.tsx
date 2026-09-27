import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import './index.css'
import App from './App.tsx'
import { warmFromCache } from './reunion/reunion'
import { unburnTestDay } from './birthday/birthdayDate'

// Before the first frame, so a cold start near the date is warm from the
// splash onwards rather than a second later.
warmFromCache()
// TEMPORARY: see unburnTestDay.
unburnTestDay()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

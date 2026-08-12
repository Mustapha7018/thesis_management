import { notifyManager } from "@tanstack/react-query"
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Default scheduler defers cache-change notifications via setTimeout(0), which
// Chrome throttles in backgrounded/inactive tabs (can stretch to 1s+ delays).
// Notifying synchronously keeps the UI responsive regardless of tab focus.
notifyManager.setScheduler((callback) => callback())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

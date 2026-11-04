import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
const hadFragment = window.location.hash.length > 0
const shouldStartAtTop = navigation?.type === 'reload' || window.location.hash === '#contact'

if (shouldStartAtTop) {
  if (hadFragment) window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`)
  const previousRestoration = window.history.scrollRestoration
  window.history.scrollRestoration = 'manual'
  window.scrollTo(0, 0)
  const frame = window.requestAnimationFrame(() => window.scrollTo(0, 0))
  window.addEventListener('load', () => {
    window.scrollTo(0, 0)
    window.history.scrollRestoration = previousRestoration
  }, { once: true })
  window.addEventListener('pagehide', () => window.cancelAnimationFrame(frame), { once: true })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// biome-ignore lint/style/noNonNullAssertion: the #root element is guaranteed by index.html (canonical Vite mount).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

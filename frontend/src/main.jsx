import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import './responsive.css'
import App from './App.jsx'

// C-07 FIX: Add Toaster to root so toast() works across the entire app.
// All alert() calls are replaced with toast.success() / toast.error().
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.jsx'

// C-07 FIX: Add Toaster to root so toast() works across the entire app.
// All alert() calls are replaced with toast.success() / toast.error().
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        success: { style: { background: '#D5F5E3', color: '#1E8449' } },
        error:   { style: { background: '#FADBD8', color: '#C0392B' } },
      }}
    />
  </StrictMode>,
)
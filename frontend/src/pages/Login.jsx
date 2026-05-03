// Login.jsx — Redesigned: warm geometric brutalism meets Islamic pattern art
// Concept: School in Gujarat → geometric tile motifs, warm saffron-teal palette,
// bold editorial typography, asymmetric split layout.
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI, extractError } from '../services/api'
import { setAuthUser, setToken } from '../services/auth'

// Animated SVG tile pattern — Islamic geometric / Gujarat craft inspiration
function GeometricPattern() {
  return (
    <svg
      width="100%" height="100%"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', inset: 0, opacity: 0.18 }}
    >
      <defs>
        <pattern id="tile" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
          {/* 8-point star */}
          <polygon points="40,4 48,28 72,20 60,40 72,60 48,52 40,76 32,52 8,60 20,40 8,20 32,28"
            fill="none" stroke="#fff" strokeWidth="1" />
          <rect x="24" y="24" width="32" height="32" fill="none" stroke="#fff" strokeWidth="0.5" transform="rotate(45 40 40)" />
          <circle cx="40" cy="40" r="6" fill="none" stroke="#fff" strokeWidth="0.8" />
          {/* Corner diamonds */}
          <polygon points="0,0 8,0 0,8" fill="none" stroke="#fff" strokeWidth="0.6" />
          <polygon points="80,0 72,0 80,8" fill="none" stroke="#fff" strokeWidth="0.6" />
          <polygon points="0,80 8,80 0,72" fill="none" stroke="#fff" strokeWidth="0.6" />
          <polygon points="80,80 72,80 80,72" fill="none" stroke="#fff" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#tile)" />
    </svg>
  )
}

// Floating dots decoration
function FloatingDots({ count = 12, color }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const size = 3 + (i % 4) * 2
        const x = 5 + (i * 8.3) % 90
        const y = 5 + (i * 11.7) % 90
        const delay = (i * 0.3) % 3
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `${x}%`,
            top: `${y}%`,
            width: size,
            height: size,
            borderRadius: '50%',
            background: color || 'rgba(255,255,255,0.4)',
            animation: `floatDot ${2.5 + delay}s ease-in-out ${delay}s infinite alternate`,
          }} />
        )
      })}
    </>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState(null)
  const [mounted, setMounted]           = useState(false)
  const [focusedField, setFocusedField] = useState(null)

  useEffect(() => {
    // Staggered mount animation
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  // In frontend/src/pages/Login.jsx
// Replace the handleSubmit function's navigate call with this logic:

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const r = await authAPI.login(email, password)
      setToken(r.data.access_token)
      setAuthUser({
        id: r.data.user_id,
        name: r.data.user_name,
        role: r.data.role,
        assignedClassIds: r.data.assigned_class_ids || [],
        linkedStudentId: r.data.linked_student_id || null,
        linkedStudentIds: r.data.linked_student_ids || [],
      })
      // S10: route student/parent to portal, admin/teacher to dashboard
      const role = r.data.role
      if (role === 'student' || role === 'parent') {
        navigate('/portal')
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap');

        @keyframes floatDot {
          from { transform: translateY(0px) scale(1); opacity: 0.4; }
          to   { transform: translateY(-12px) scale(1.2); opacity: 0.8; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes shimmerBar {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }

        .login-root {
          min-height: 100vh;
          display: flex;
          font-family: 'DM Sans', system-ui, sans-serif;
          background: #fdf6ee;
          overflow: hidden;
        }

        /* ── Left panel ───────────────────────────────────── */
        .login-left {
          width: 46%;
          min-height: 100vh;
          background: linear-gradient(155deg, #c84b11 0%, #e8600a 35%, #c06d2d 70%, #8b3a0f 100%);
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px 52px;
          overflow: hidden;
          flex-shrink: 0;
        }
        .login-left::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(220deg, rgba(255,200,100,0.15) 0%, transparent 50%, rgba(0,0,0,0.2) 100%);
        }

        .brand-mark {
          position: relative;
          z-index: 2;
          animation: slideUp 0.6s ease-out 0.1s both;
        }
        .brand-icon {
          width: 52px;
          height: 52px;
          background: rgba(255,255,255,0.15);
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
          backdrop-filter: blur(10px);
        }
        .brand-name {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 26px;
          font-weight: 900;
          color: #fff;
          line-height: 1.1;
          letter-spacing: -0.02em;
        }
        .brand-sub {
          font-size: 12px;
          font-weight: 500;
          color: rgba(255,255,255,0.65);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-top: 4px;
        }

        .left-hero {
          position: relative;
          z-index: 2;
          animation: slideUp 0.7s ease-out 0.25s both;
        }
        .hero-eyebrow {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(255,220,160,0.9);
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .hero-eyebrow::before {
          content: '';
          display: block;
          width: 28px;
          height: 2px;
          background: rgba(255,220,160,0.7);
        }
        .hero-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(32px, 4vw, 52px);
          font-weight: 900;
          color: #fff;
          line-height: 1.1;
          letter-spacing: -0.03em;
          margin-bottom: 18px;
        }
        .hero-title em {
          font-style: italic;
          color: rgba(255,220,160,0.95);
        }
        .hero-desc {
          font-size: 15px;
          font-weight: 400;
          color: rgba(255,255,255,0.72);
          line-height: 1.7;
          max-width: 320px;
        }

        .left-stats {
          position: relative;
          z-index: 2;
          display: flex;
          gap: 28px;
          animation: slideUp 0.7s ease-out 0.4s both;
        }
        .stat-pill {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .stat-pill-val {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 28px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.03em;
          line-height: 1;
        }
        .stat-pill-label {
          font-size: 11px;
          font-weight: 500;
          color: rgba(255,255,255,0.55);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .stat-divider {
          width: 1px;
          background: rgba(255,255,255,0.2);
          align-self: stretch;
          margin: 4px 0;
        }

        /* ── Right panel ──────────────────────────────────── */
        .login-right {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 32px;
          position: relative;
          background: #fdf6ee;
          overflow: hidden;
        }
        .login-right::before {
          content: '';
          position: absolute;
          top: -120px;
          right: -120px;
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(200,75,17,0.06) 0%, transparent 70%);
          pointer-events: none;
        }
        .login-right::after {
          content: '';
          position: absolute;
          bottom: -80px;
          left: -80px;
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(0,120,100,0.05) 0%, transparent 70%);
          pointer-events: none;
        }

        .form-container {
          width: 100%;
          max-width: 400px;
          position: relative;
          z-index: 1;
        }

        .form-header {
          margin-bottom: 36px;
          animation: slideUp 0.55s ease-out 0.3s both;
        }
        .form-eyebrow {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #c84b11;
          margin-bottom: 10px;
        }
        .form-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 34px;
          font-weight: 900;
          color: #1a120a;
          letter-spacing: -0.03em;
          line-height: 1.1;
          margin-bottom: 8px;
        }
        .form-subtitle {
          font-size: 14px;
          font-weight: 400;
          color: #6b5240;
          line-height: 1.5;
        }

        /* Error */
        .error-box {
          background: #fff5f0;
          border: 1.5px solid #f4b8a0;
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 13px;
          color: #b03a1a;
          font-weight: 500;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 22px;
          animation: slideUp 0.3s ease-out both;
        }

        /* Fields */
        .field-group {
          display: flex;
          flex-direction: column;
          gap: 18px;
          margin-bottom: 28px;
          animation: slideUp 0.6s ease-out 0.45s both;
        }
        .field-wrap {
          position: relative;
        }
        .field-label {
          display: block;
          font-size: 11.5px;
          font-weight: 600;
          color: #4a3020;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 8px;
        }
        .field-input-wrap {
          position: relative;
        }
        .field-input {
          width: 100%;
          padding: 14px 16px 14px 48px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 400;
          color: #1a120a;
          background: #fff;
          border: 2px solid #e8d8c8;
          border-radius: 12px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          -webkit-appearance: none;
          box-sizing: border-box;
        }
        .field-input:hover { border-color: #d4b898; }
        .field-input:focus {
          border-color: #c84b11;
          box-shadow: 0 0 0 4px rgba(200,75,17,0.1);
          background: #fffcf9;
        }
        .field-input::placeholder { color: #c4a888; }
        .field-icon {
          position: absolute;
          left: 15px;
          top: 50%;
          transform: translateY(-50%);
          color: #c4a888;
          transition: color 0.2s;
          pointer-events: none;
        }
        .field-input:focus ~ .field-icon,
        .field-wrap:focus-within .field-icon {
          color: #c84b11;
        }
        .field-action {
          position: absolute;
          right: 13px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #b09070;
          padding: 4px;
          display: flex;
          align-items: center;
          transition: color 0.15s;
        }
        .field-action:hover { color: #c84b11; }

        /* Submit */
        .submit-btn {
          width: 100%;
          padding: 16px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 600;
          color: #fff;
          background: linear-gradient(135deg, #c84b11 0%, #e8600a 100%);
          border: none;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
          box-shadow: 0 4px 16px rgba(200,75,17,0.35);
          letter-spacing: 0.01em;
          animation: slideUp 0.6s ease-out 0.6s both;
          position: relative;
          overflow: hidden;
        }
        .submit-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
          background-size: 200% auto;
          animation: shimmerBar 2.5s linear infinite;
          opacity: 0;
          transition: opacity 0.3s;
        }
        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(200,75,17,0.4);
        }
        .submit-btn:hover:not(:disabled)::before { opacity: 1; }
        .submit-btn:active:not(:disabled) { transform: translateY(0); }
        .submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .btn-spinner {
          width: 18px; height: 18px;
          border: 2.5px solid rgba(255,255,255,0.4);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        /* Footer hint */
        .form-hint {
          margin-top: 28px;
          padding: 16px 18px;
          background: #f5ede3;
          border: 1px solid #e8d8c8;
          border-radius: 10px;
          animation: slideUp 0.6s ease-out 0.75s both;
        }
        .form-hint-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #8b6040;
          margin-bottom: 6px;
        }
        .form-hint-body {
          font-size: 12.5px;
          color: #7a5535;
          line-height: 1.6;
        }
        .form-hint-code {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11.5px;
          background: rgba(200,75,17,0.1);
          color: #c84b11;
          padding: 1px 6px;
          border-radius: 4px;
        }

        /* Teal accent bar on right panel top */
        .accent-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #c84b11, #e8600a, #00877a, #006b62);
          animation: fadeIn 1s ease-out 0.8s both;
        }

        /* Corner decoration — geometric diamond */
        .corner-deco {
          position: absolute;
          bottom: 32px;
          right: 32px;
          opacity: 0.08;
          animation: fadeIn 1s ease-out 1s both;
        }

        /* ── Mobile responsive ────────────────────────────── */
        @media (max-width: 768px) {
          .login-root { flex-direction: column; }
          .login-left {
            width: 100%;
            min-height: auto;
            padding: 36px 28px 32px;
          }
          .left-hero { margin: 24px 0 20px; }
          .hero-title { font-size: 30px; }
          .left-stats { gap: 20px; }
          .stat-pill-val { font-size: 22px; }
          .login-right { padding: 32px 20px 40px; }
          .form-title { font-size: 28px; }
          .corner-deco { display: none; }
          .login-right::before, .login-right::after { display: none; }
        }
        @media (max-width: 480px) {
          .login-left { padding: 28px 20px 24px; }
          .brand-name { font-size: 22px; }
          .hero-title { font-size: 26px; }
          .left-stats { flex-wrap: wrap; gap: 16px; }
          .form-title { font-size: 24px; }
        }
      `}</style>

      <div className="login-root">
        {/* ── Left panel ───────────────────────────── */}
        <div className="login-left">
          <GeometricPattern />
          <FloatingDots count={10} color="rgba(255,220,160,0.35)" />

          {/* Brand */}
          <div className="brand-mark">
            <div className="brand-icon">
              <svg width="26" height="26" fill="none" viewBox="0 0 24 24">
                <path d="M12 2L3 7l9 5 9-5-9-5z" fill="white" />
                <path d="M3 12l9 5 9-5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M3 17l9 5 9-5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="brand-name">Iqra School</div>
            <div className="brand-sub">Chadotar, Gujarat · GSEB</div>
          </div>

          {/* Hero copy */}
          <div className="left-hero">
            <div className="hero-eyebrow">Management System</div>
            <h1 className="hero-title">
              Educating<br />
              <em>minds,</em><br />
              shaping futures.
            </h1>
            <p className="hero-desc">
              A complete school management platform — student records, marks, attendance, fees and year-end workflows in one place.
            </p>
          </div>

          {/* Stats row */}
          <div className="left-stats">
            <div className="stat-pill">
              <div className="stat-pill-val">13+</div>
              <div className="stat-pill-label">Standards</div>
            </div>
            <div className="stat-divider" />
            <div className="stat-pill">
              <div className="stat-pill-val">GSEB</div>
              <div className="stat-pill-label">Affiliated</div>
            </div>
            <div className="stat-divider" />
            <div className="stat-pill">
              <div className="stat-pill-val">∞</div>
              <div className="stat-pill-label">Records</div>
            </div>
          </div>
        </div>

        {/* ── Right panel ──────────────────────────── */}
        <div className="login-right">
          <div className="accent-bar" />

          {/* Corner geometric decoration */}
          <div className="corner-deco">
            <svg width="180" height="180" viewBox="0 0 180 180" fill="none">
              <polygon points="90,10 160,50 160,130 90,170 20,130 20,50" stroke="#c84b11" strokeWidth="2" fill="none" />
              <polygon points="90,30 145,62 145,118 90,150 35,118 35,62" stroke="#c84b11" strokeWidth="1.2" fill="none" />
              <polygon points="90,50 130,74 130,106 90,130 50,106 50,74" stroke="#c84b11" strokeWidth="0.8" fill="none" />
              <circle cx="90" cy="90" r="16" stroke="#c84b11" strokeWidth="1.2" fill="none" />
            </svg>
          </div>

          <div className="form-container">
            {/* Header */}
            <div className="form-header">
              <div className="form-eyebrow">Administrator Portal</div>
              <h2 className="form-title">Welcome back</h2>
              <p className="form-subtitle">Sign in to manage your school</p>
            </div>

            {/* Error */}
            {error && (
              <div className="error-box">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10" strokeWidth={2} />
                  <path strokeLinecap="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="field-group">
                {/* Email */}
                <div className="field-wrap">
                  <label className="field-label" htmlFor="email">Email address</label>
                  <div className="field-input-wrap">
                    <input
                      id="email"
                      type="email"
                      className="field-input"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="admin@iqraschool.in"
                      required
                      autoFocus
                      autoComplete="email"
                    />
                    <span className="field-icon">
                      <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </span>
                  </div>
                </div>

                {/* Password */}
                <div className="field-wrap">
                  <label className="field-label" htmlFor="password">Password</label>
                  <div className="field-input-wrap">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      className="field-input"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      style={{ paddingRight: '46px' }}
                    />
                    <span className="field-icon">
                      <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth={1.8} />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                    </span>
                    <button
                      type="button"
                      className="field-action"
                      onClick={() => setShowPassword(s => !s)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? (
                  <>
                    <div className="btn-spinner" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in to Dashboard
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
            </form>


          </div>
        </div>
      </div>
    </>
  )
}

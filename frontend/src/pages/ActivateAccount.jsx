import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { studentAuthAPI, extractError } from '../services/api'
import { normalizeAuthUser, setAuthUser, setToken } from '../services/auth'

const STORE_KEY = 'sms_activation_state'

function loadState() {
  try {
    return JSON.parse(sessionStorage.getItem(STORE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveState(next) {
  sessionStorage.setItem(STORE_KEY, JSON.stringify(next))
}

function ActivationShell({ children }) {
  return (
    <div className="activation-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600;700;800&display=swap');

        .activation-root {
          min-height: 100vh;
          display: flex;
          font-family: 'DM Sans', system-ui, sans-serif;
          background: #fdf6ee;
        }
        .activation-left {
          width: 42%;
          min-height: 100vh;
          background: linear-gradient(155deg, #c84b11 0%, #e8600a 35%, #c06d2d 70%, #8b3a0f 100%);
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 42px 44px;
          color: #fff;
          overflow: hidden;
          flex-shrink: 0;
        }
        .activation-left::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(220deg, rgba(255,200,100,0.14) 0%, transparent 50%, rgba(0,0,0,0.2) 100%);
        }
        .activation-brand,
        .activation-hero,
        .activation-stats {
          position: relative;
          z-index: 1;
        }
        .activation-brand-name {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 28px;
          font-weight: 900;
          line-height: 1.1;
          letter-spacing: -0.02em;
        }
        .activation-brand-sub {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255,255,255,0.65);
          letter-spacing: 0.11em;
          text-transform: uppercase;
          margin-top: 4px;
        }
        .activation-hero-eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255,220,160,0.92);
          margin-bottom: 14px;
        }
        .activation-hero-title {
          margin: 0;
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(32px, 3.5vw, 48px);
          line-height: 1.1;
          letter-spacing: -0.03em;
        }
        .activation-hero-desc {
          margin-top: 14px;
          max-width: 340px;
          font-size: 14px;
          line-height: 1.7;
          color: rgba(255,255,255,0.76);
        }
        .activation-stats {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .activation-stat-val {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 24px;
          font-weight: 700;
          line-height: 1;
        }
        .activation-stat-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(255,255,255,0.62);
          margin-top: 4px;
        }
        .activation-stat-divider {
          width: 1px;
          align-self: stretch;
          background: rgba(255,255,255,0.2);
        }
        .activation-right {
          flex: 1;
          display: grid;
          place-items: center;
          padding: 28px;
          position: relative;
          overflow: hidden;
        }
        .activation-right::before {
          content: '';
          position: absolute;
          top: -120px;
          right: -110px;
          width: 360px;
          height: 360px;
          background: radial-gradient(circle, rgba(200,75,17,0.06) 0%, transparent 72%);
        }
        .activation-right::after {
          content: '';
          position: absolute;
          bottom: -80px;
          left: -80px;
          width: 280px;
          height: 280px;
          background: radial-gradient(circle, rgba(0,120,100,0.06) 0%, transparent 70%);
        }
        .activation-panel {
          width: min(100%, 520px);
          background: rgba(255,255,255,0.96);
          border: 1.5px solid #e8d8c8;
          border-radius: 14px;
          box-shadow: 0 16px 46px rgba(40,30,20,0.14);
          padding: 28px;
          position: relative;
          z-index: 1;
        }
        .activation-panel::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          border-top-left-radius: 12px;
          border-top-right-radius: 12px;
          background: linear-gradient(90deg, #c84b11, #e8600a, #00877a, #006b62);
        }
        .activation-kicker {
          color: #c84b11;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.13em;
          margin: 10px 0 8px;
        }
        .activation-title {
          margin: 0;
          color: #1a120a;
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(30px, 3.2vw, 38px);
          line-height: 1.08;
          letter-spacing: -0.02em;
        }
        .activation-subtitle {
          margin: 10px 0 24px;
          color: #6b5240;
          line-height: 1.58;
          font-size: 14px;
        }
        .activation-form { display: grid; gap: 14px; }
        .activation-label {
          display: grid;
          gap: 6px;
          color: #4a3020;
          font-size: 11.5px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 700;
        }
        .activation-input {
          width: 100%;
          min-height: 48px;
          border: 2px solid #e8d8c8;
          border-radius: 12px;
          padding: 0 14px;
          color: #1a120a;
          font: inherit;
          background: #fff;
          box-sizing: border-box;
        }
        .activation-input:focus {
          outline: none;
          border-color: #c84b11;
          box-shadow: 0 0 0 4px rgba(200,75,17,0.1);
          background: #fffcf9;
        }
        .activation-segment {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          padding: 4px;
          background: #f5ede3;
          border-radius: 12px;
          border: 1px solid #e8d8c8;
        }
        .activation-segment button {
          min-height: 44px;
          border: 0;
          border-radius: 9px;
          background: transparent;
          color: #7a5535;
          font-weight: 800;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }
        .activation-segment button.active {
          background: linear-gradient(135deg, #c84b11 0%, #e8600a 100%);
          color: #fff;
          box-shadow: 0 8px 18px rgba(200,75,17,0.28);
        }
        .activation-button {
          min-height: 48px;
          border: 0;
          border-radius: 12px;
          background: linear-gradient(135deg, #c84b11 0%, #e8600a 100%);
          color: #fff;
          font-weight: 800;
          cursor: pointer;
          font-size: 15px;
          box-shadow: 0 6px 18px rgba(200,75,17,0.28);
        }
        .activation-button:disabled { opacity: 0.62; cursor: not-allowed; }
        .activation-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          color: #0f766e;
          font-weight: 800;
          text-decoration: none;
          border: 0;
          background: transparent;
          cursor: pointer;
        }
        .activation-secondary:disabled { opacity: 0.55; cursor: not-allowed; }
        .activation-otp {
          text-align: center;
          font-size: 24px;
          letter-spacing: 8px;
          font-weight: 900;
        }
        .activation-meta {
          color: #7a5535;
          font-size: 13px;
          text-align: center;
          min-height: 20px;
        }
        @media (max-width: 1024px) {
          .activation-left { width: 38%; padding: 34px 30px; }
          .activation-right { padding: 24px; }
          .activation-brand-name { font-size: 24px; }
          .activation-hero-title { font-size: clamp(28px, 3vw, 40px); }
          .activation-stats { gap: 12px; }
        }
        @media (max-width: 860px) {
          .activation-root { flex-direction: column; }
          .activation-left {
            width: 100%;
            min-height: auto;
            gap: 24px;
            padding: 28px 22px 24px;
          }
          .activation-hero-desc { max-width: none; }
          .activation-right {
            padding: 18px 14px 24px;
          }
          .activation-right::before,
          .activation-right::after { display: none; }
          .activation-panel { width: 100%; padding: 24px; }
        }
        @media (max-width: 520px) {
          .activation-title { font-size: 30px; }
          .activation-panel { padding: 22px 18px; }
          .activation-segment button { min-height: 42px; font-size: 13px; }
          .activation-otp { font-size: 22px; letter-spacing: 6px; }
        }
      `}</style>
      <aside className="activation-left">
        <div className="activation-brand">
          <div className="activation-brand-name">Iqra School</div>
          <div className="activation-brand-sub">Chadotar, Gujarat · GSEB</div>
        </div>
        <div className="activation-hero">
          <div className="activation-hero-eyebrow">Portal Access</div>
          <h2 className="activation-hero-title">Student & parent onboarding</h2>
          <p className="activation-hero-desc">Activate your school portal account securely and continue to attendance, fees and results.</p>
        </div>
        <div className="activation-stats">
          <div>
            <div className="activation-stat-val">2 min</div>
            <div className="activation-stat-label">Quick setup</div>
          </div>
          <div className="activation-stat-divider" />
          <div>
            <div className="activation-stat-val">1 code</div>
            <div className="activation-stat-label">Email verified</div>
          </div>
          <div className="activation-stat-divider" />
          <div>
            <div className="activation-stat-val">24/7</div>
            <div className="activation-stat-label">Portal access</div>
          </div>
        </div>
      </aside>
      <main className="activation-right">
        <section className="activation-panel">{children}</section>
      </main>
    </div>
  )
}

export default function ActivateAccount() {
  const navigate = useNavigate()
  const location = useLocation()
  const stored = useMemo(loadState, [])
  const [accountType, setAccountType] = useState(stored.accountType || 'student')
  const [identifier, setIdentifier] = useState(stored.identifier || '')
  const [email, setEmail] = useState(stored.email || '')
  const [activationId, setActivationId] = useState(stored.activationId || '')
  const [activationToken, setActivationToken] = useState(stored.activationToken || '')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendAt, setResendAt] = useState(stored.resendAt || null)
  const [secondsLeft, setSecondsLeft] = useState(0)

  const step = location.pathname.includes('/verify')
    ? 'verify'
    : location.pathname.includes('/password')
      ? 'password'
      : location.pathname.includes('/success')
        ? 'success'
        : 'start'

  useEffect(() => {
    const tick = () => {
      if (!resendAt) {
        setSecondsLeft(0)
        return
      }
      setSecondsLeft(Math.max(0, Math.ceil((new Date(resendAt).getTime() - Date.now()) / 1000)))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [resendAt])

  useEffect(() => {
    if (step === 'verify' && !activationId) navigate('/activate-account', { replace: true })
    if (step === 'password' && !activationToken) navigate('/activate-account/verify', { replace: true })
  }, [step, activationId, activationToken, navigate])

  const persist = next => {
    const state = {
      accountType,
      identifier,
      email,
      activationId,
      activationToken,
      resendAt,
      ...next,
    }
    saveState(state)
  }

  const start = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await studentAuthAPI.startActivation({
        account_type: accountType,
        identifier,
        email,
      })
      const next = {
        accountType,
        identifier,
        email,
        activationId: res.data.activation_id,
        resendAt: res.data.resend_available_at,
      }
      setActivationId(next.activationId)
      setResendAt(next.resendAt)
      persist(next)
      toast.success('Activation code sent if the details match school records')
      navigate('/activate-account/verify')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    if (!activationId || secondsLeft > 0) return
    setLoading(true)
    try {
      const res = await studentAuthAPI.resendOtp(activationId)
      setResendAt(res.data.resend_available_at)
      persist({ resendAt: res.data.resend_available_at })
      toast.success('A new code has been sent')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  const verify = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await studentAuthAPI.verifyOtp(activationId, otp)
      setActivationToken(res.data.activation_token)
      persist({ activationToken: res.data.activation_token })
      navigate('/activate-account/password')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  const complete = async e => {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const res = await studentAuthAPI.completeRegistration(activationToken, password)
      setToken(res.data.access_token)
      setAuthUser(normalizeAuthUser(res.data))
      sessionStorage.removeItem(STORE_KEY)
      navigate('/activate-account/success')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  if (step === 'success') {
    return (
      <ActivationShell>
        <div className="activation-kicker">Account Ready</div>
        <h1 className="activation-title">Portal access is active</h1>
        <p className="activation-subtitle">Your account is linked and ready to use.</p>
        <Link className="activation-button" style={{ display: 'flex', textDecoration: 'none', alignItems: 'center', justifyContent: 'center' }} to="/portal">
          Continue to Portal
        </Link>
      </ActivationShell>
    )
  }

  return (
    <ActivationShell>
      <div className="activation-kicker">School Portal</div>
      <h1 className="activation-title">
        {step === 'start' ? 'Activate Account' : step === 'verify' ? 'Verify Code' : 'Set Password'}
      </h1>
      <p className="activation-subtitle">
        {step === 'start'
          ? 'Use the email provided during admission to activate portal access.'
          : step === 'verify'
            ? 'Enter the 6-digit code sent to your email.'
            : 'Create a secure password for future logins.'}
      </p>

      {step === 'start' && (
        <form className="activation-form" onSubmit={start}>
          <div className="activation-segment">
            <button type="button" className={accountType === 'student' ? 'active' : ''} onClick={() => setAccountType('student')}>Student</button>
            <button type="button" className={accountType === 'parent' ? 'active' : ''} onClick={() => setAccountType('parent')}>Parent</button>
          </div>
          <label className="activation-label">
            Admission number or student ID
            <input className="activation-input" value={identifier} onChange={e => setIdentifier(e.target.value)} required />
          </label>
          <label className="activation-label">
            {accountType === 'student' ? 'Student email' : 'Guardian email'}
            <input className="activation-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </label>
          <button className="activation-button" disabled={loading}>{loading ? 'Sending...' : 'Send Activation Code'}</button>
          <Link className="activation-secondary" to="/login">Back to Login</Link>
        </form>
      )}

      {step === 'verify' && (
        <form className="activation-form" onSubmit={verify}>
          <label className="activation-label">
            Activation code
            <input
              className="activation-input activation-otp"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              required
            />
          </label>
          <button className="activation-button" disabled={loading || otp.length !== 6}>{loading ? 'Checking...' : 'Verify Code'}</button>
          <button type="button" className="activation-secondary" disabled={loading || secondsLeft > 0} onClick={resend}>
            {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend Code'}
          </button>
          <div className="activation-meta">{email}</div>
        </form>
      )}

      {step === 'password' && (
        <form className="activation-form" onSubmit={complete}>
          <label className="activation-label">
            Password
            <input className="activation-input" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required />
          </label>
          <label className="activation-label">
            Confirm password
            <input className="activation-input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={8} required />
          </label>
          <button className="activation-button" disabled={loading}>{loading ? 'Activating...' : 'Activate Portal'}</button>
        </form>
      )}
    </ActivationShell>
  )
}

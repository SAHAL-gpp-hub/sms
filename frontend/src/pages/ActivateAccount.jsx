// ActivateAccount.jsx — Redesigned to match Login page split-layout
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import logo from '../assets/logo.svg'
import classroomBg from '../assets/classroom_green_bg.png'
import { studentAuthAPI, extractError } from '../services/api'
import { normalizeAuthUser, setAuthUser, setToken } from '../services/auth'

const STORE_KEY = 'sms_activation_state'

function loadState() {
  try { return JSON.parse(sessionStorage.getItem(STORE_KEY) || '{}') }
  catch { return {} }
}
function saveState(next) {
  sessionStorage.setItem(STORE_KEY, JSON.stringify(next))
}

// ── SVG Icons ──────────────────────────────────────────────────────────────────
const StudentSVG = () => (
  <svg width="18" height="18" viewBox="0 0 36 36" fill="none">
    <path d="M18 6 L32 13 L18 20 L4 13 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M10 17 L10 26 C10 26 13 30 18 30 C23 30 26 26 26 26 L26 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M32 13 L32 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="32" cy="23" r="2" fill="currentColor"/>
  </svg>
)
const ParentSVG = () => (
  <svg width="18" height="18" viewBox="0 0 36 36" fill="none">
    <circle cx="12" cy="11" r="4.5" stroke="currentColor" strokeWidth="2"/>
    <circle cx="24" cy="11" r="4.5" stroke="currentColor" strokeWidth="2"/>
    <path d="M2 30 C2 23.373 6.477 18 12 18 C14.5 18 16.8 19 18 20.5 C19.2 19 21.5 18 24 18 C29.523 18 34 23.373 34 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)
const EmailSVG = () => (
  <svg width="17" height="17" viewBox="0 0 34 34" fill="none">
    <rect x="3" y="7" width="28" height="20" rx="3" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M3 11 L17 19 L31 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IdSVG = () => (
  <svg width="17" height="17" viewBox="0 0 34 34" fill="none">
    <rect x="3" y="7" width="28" height="20" rx="3" stroke="currentColor" strokeWidth="1.8"/>
    <circle cx="12" cy="17" r="4" stroke="currentColor" strokeWidth="1.6"/>
    <path d="M20 13 L29 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    <path d="M20 17 L27 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    <path d="M20 21 L25 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
)
const LockSVG = () => (
  <svg width="17" height="17" viewBox="0 0 34 34" fill="none">
    <rect x="5" y="15" width="24" height="16" rx="3" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M10 15 L10 10 C10 6.134 13.134 3 17 3 C20.866 3 24 6.134 24 10 L24 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="17" cy="23" r="2.5" fill="currentColor" opacity="0.7"/>
    <path d="M17 25.5 L17 28" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)
const SendSVG = () => (
  <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
    <path d="M4 16 L28 4 L20 28 L15 18 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M15 18 L21 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)
const CheckSVG = () => (
  <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
    <path d="M6 17 L12 23 L26 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const BackSVG = () => (
  <svg width="14" height="14" viewBox="0 0 28 28" fill="none">
    <path d="M18 6 L10 14 L18 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const ArrowSVG = () => (
  <svg width="15" height="15" viewBox="0 0 30 30" fill="none">
    <path d="M6 15 L24 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M17 8 L24 15 L17 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const ShieldSVG = () => (
  <svg width="15" height="15" viewBox="0 0 30 30" fill="none">
    <path d="M15 2 L26 6.5 L26 15 C26 20.5 21.5 25.5 15 28 C8.5 25.5 4 20.5 4 15 L4 6.5 Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    <path d="M10 15 L13 18 L20 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const SpinnerSVG = () => (
  <svg width="18" height="18" viewBox="0 0 36 36" fill="none" style={{ animation: 'spin 0.75s linear infinite', flexShrink: 0 }}>
    <circle cx="18" cy="18" r="14" stroke="rgba(255,255,255,0.25)" strokeWidth="3"/>
    <path d="M18 4 A14 14 0 0 1 32 18" stroke="white" strokeWidth="3" strokeLinecap="round"/>
  </svg>
)
const VisionSVG = () => (
  <svg width="24" height="24" viewBox="0 0 36 36" fill="none">
    <path d="M2 18 C2 18 7 8 18 8 C29 8 34 18 34 18 C34 18 29 28 18 28 C7 28 2 18 2 18Z" stroke="currentColor" strokeWidth="2"/>
    <circle cx="18" cy="18" r="5" stroke="currentColor" strokeWidth="2"/>
    <circle cx="18" cy="18" r="2" fill="currentColor"/>
  </svg>
)
const MissionSVG = () => (
  <svg width="24" height="24" viewBox="0 0 36 36" fill="none">
    <circle cx="18" cy="18" r="14" stroke="currentColor" strokeWidth="2"/>
    <circle cx="18" cy="18" r="7" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="18" cy="18" r="3" fill="currentColor"/>
    <path d="M18 4 L18 8M32 18 L28 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)
const ActivateBadgeSVG = () => (
  <svg width="15" height="15" viewBox="0 0 30 30" fill="none">
    <circle cx="12" cy="10" r="4" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M4 26 C4 21 7.6 17 12 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="22" cy="22" r="6" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M19 22 L21 24 L25 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const SuccessStarSVG = () => (
  <svg width="56" height="56" viewBox="0 0 112 112" fill="none">
    <circle cx="56" cy="56" r="52" fill="rgba(14,62,38,0.07)" stroke="rgba(14,62,38,0.12)" strokeWidth="2"/>
    <circle cx="56" cy="56" r="36" fill="rgba(14,62,38,0.1)" stroke="rgba(14,62,38,0.15)" strokeWidth="1.5"/>
    <path d="M38 56 L50 68 L74 44" stroke="#0e3e26" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

function DotsGrid() {
  const dots = []
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 8; c++)
      dots.push(<circle key={`${r}-${c}`} cx={c*18+9} cy={r*18+9} r="2.5" fill="#eab308" opacity="0.6"/>)
  return (
    <svg className="act-dots-grid" viewBox="0 0 153 99" fill="none">
      {dots}
    </svg>
  )
}

// Step indicator
const STEPS = ['start', 'verify', 'password', 'success']

function StepDots({ current }) {
  const idx = STEPS.indexOf(current)
  return (
    <div className="act-stepper">
      {['Details', 'Verify', 'Password'].map((label, i) => (
        <div key={i} className={`act-step${i < idx ? ' act-step--done' : i === idx ? ' act-step--active' : ''}`}>
          <div className="act-step-dot">
            {i < idx ? <CheckSVG /> : <span>{i + 1}</span>}
          </div>
          <span className="act-step-label">{label}</span>
          {i < 2 && <div className="act-step-line" />}
        </div>
      ))}
    </div>
  )
}

export default function ActivateAccount() {
  const navigate = useNavigate()
  const location = useLocation()
  const activationBase = location.pathname.startsWith('/portal/activate-account')
    ? '/portal/activate-account' : '/activate-account'
  const stored = useMemo(loadState, [])
  const [accountType, setAccountType]       = useState(stored.accountType || 'student')
  const [identifier, setIdentifier]         = useState(stored.identifier || '')
  const [email, setEmail]                   = useState(stored.email || '')
  const [activationId, setActivationId]     = useState(stored.activationId || '')
  const [activationToken, setActivationToken] = useState(stored.activationToken || '')
  const [otp, setOtp]                       = useState('')
  const [password, setPassword]             = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading]               = useState(false)
  const [inviteMode, setInviteMode]         = useState(false)
  const [resendAt, setResendAt]             = useState(stored.resendAt || null)
  const [secondsLeft, setSecondsLeft]       = useState(0)

  const step = location.pathname.includes('/verify')   ? 'verify'
    : location.pathname.includes('/password') ? 'password'
    : location.pathname.includes('/success')  ? 'success'
    : 'start'

  useEffect(() => {
    const tick = () => {
      if (!resendAt) { setSecondsLeft(0); return }
      setSecondsLeft(Math.max(0, Math.ceil((new Date(resendAt).getTime() - Date.now()) / 1000)))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [resendAt])

  useEffect(() => {
    if (step === 'verify'   && !activationId)     navigate(activationBase, { replace: true })
    if (step === 'password' && !activationToken)  navigate(`${activationBase}/verify`, { replace: true })
  }, [step, activationBase, activationId, activationToken, navigate])

  useEffect(() => {
    const inviteToken = new URLSearchParams(location.search).get('invite')
    if (!inviteToken || activationId || loading) return
    setInviteMode(true)
    setLoading(true)
    studentAuthAPI.acceptInvite(inviteToken)
      .then(res => {
        const next = { activationId: res.data.activation_id, resendAt: res.data.resend_available_at }
        setActivationId(next.activationId)
        setResendAt(next.resendAt)
        saveState({ accountType, identifier, email, activationToken, ...next })
        toast.success('Activation code sent. Check the invited email inbox.')
        navigate(`${activationBase}/verify`, { replace: true })
      })
      .catch(err => toast.error(extractError(err)))
      .finally(() => setLoading(false))
  }, [accountType, activationBase, activationId, activationToken, email, identifier, loading, location.search, navigate])

  const persist = useCallback(next => {
    saveState({ accountType, identifier, email, activationId, activationToken, resendAt, ...next })
  }, [accountType, activationId, activationToken, email, identifier, resendAt])

  const start = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await studentAuthAPI.startActivation({ account_type: accountType, identifier, email })
      const next = { accountType, identifier, email, activationId: res.data.activation_id, resendAt: res.data.resend_available_at }
      setActivationId(next.activationId); setResendAt(next.resendAt); persist(next)
      toast.success('Activation code sent if the details match school records')
      navigate(`${activationBase}/verify`)
    } catch (err) { toast.error(extractError(err)) }
    finally { setLoading(false) }
  }

  const resend = async () => {
    if (!activationId || secondsLeft > 0) return
    setLoading(true)
    try {
      const res = await studentAuthAPI.resendOtp(activationId)
      setResendAt(res.data.resend_available_at)
      persist({ resendAt: res.data.resend_available_at })
      toast.success('A new code has been sent')
    } catch (err) { toast.error(extractError(err)) }
    finally { setLoading(false) }
  }

  const verify = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await studentAuthAPI.verifyOtp(activationId, otp)
      setActivationToken(res.data.activation_token)
      persist({ activationToken: res.data.activation_token })
      navigate(`${activationBase}/password`)
    } catch (err) { toast.error(extractError(err)) }
    finally { setLoading(false) }
  }

  const complete = async e => {
    e.preventDefault()
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return }
    setLoading(true)
    try {
      const res = await studentAuthAPI.completeRegistration(activationToken, password)
      setToken(res.data.access_token)
      setAuthUser(normalizeAuthUser(res.data))
      sessionStorage.removeItem(STORE_KEY)
      navigate(`${activationBase}/success`)
    } catch (err) { toast.error(extractError(err)) }
    finally { setLoading(false) }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes bgExpand{ 0% { transform:scale(1); } 100% { transform:scale(1.15); } }
        @keyframes dotCheck {
          0%   { transform: scale(0) rotate(-30deg); opacity: 0; }
          60%  { transform: scale(1.2) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes successPop {
          0%   { transform: scale(0.6); opacity: 0; }
          70%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes otpGlow {
          0%,100% { box-shadow: 0 0 0 3px rgba(14,62,38,0.09); }
          50%     { box-shadow: 0 0 0 6px rgba(234,179,8,0.15); }
        }

        /* ── Root ── */
        .act {
          min-height: 100vh;
          display: flex;
          font-family: 'DM Sans', system-ui, sans-serif;
          background: #f0f2f0;
          position: relative;
          overflow: hidden;
        }

        /* ── Left panel ── */
        .act-left {
          width: 48%;
          min-height: 100vh;
          position: relative;
          display: flex;
          flex-direction: column;
          padding: 48px 52px 120px;
          flex-shrink: 0;
          overflow: hidden;
          z-index: 2;
          clip-path: polygon(
            0% 0%,
            98.5% 0%,
            98.2% 5%,
            97.8% 10%,
            97.2% 15%,
            96.5% 20%,
            95.7% 25%,
            95.0% 30%,
            94.5% 35%,
            94.2% 40%,
            94.0% 45%,
            94.2% 50%,
            94.5% 55%,
            95.2% 60%,
            96.0% 65%,
            96.8% 70%,
            97.5% 75%,
            98.0% 80%,
            98.4% 85%,
            98.6% 90%,
            98.8% 95%,
            99.0% 100%,
            0% 100%
          );
        }
        .act-left-bg {
          position: absolute; inset: -10%;
          background-size: cover; background-position: center 25%;
          z-index: 0;
          animation: bgExpand 25s infinite alternate linear;
        }
        .act-left-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(155deg,
            rgba(5,35,20,0.85) 0%,
            rgba(8,45,25,0.78) 45%,
            rgba(5,35,20,0.88) 100%
          );
          z-index: 1;
        }
        .act-dots-grid {
          position: absolute; bottom: 80px; left: 40px;
          width: 140px; z-index: 3; pointer-events: none;
        }
        .act-left-content {
          position: relative; z-index: 5;
          display: flex; flex-direction: column; height: 100%;
        }

        /* ── Golden Curve SVG Overlay ── */
        .act-curve-overlay {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          z-index: 20;
          pointer-events: none;
          overflow: visible;
        }

        /* ── Right panel ── */
        .act-right {
          flex: 1;
          display: flex; align-items: center; justify-content: center;
          padding: 48px 52px;
          position: relative;
          background: #f0f2f0;
          z-index: 1;
        }

        /* ── Form card ── */
        .act-card {
          width: 100%; max-width: 480px;
          position: relative; z-index: 10;
          background: #fff;
          padding: 44px 44px 36px;
          border-radius: 28px;
          box-shadow:
            0 4px 12px rgba(14,62,38,0.04),
            0 12px 32px rgba(14,62,38,0.08),
            0 48px 80px rgba(14,62,38,0.12);
          border: 1px solid rgba(14,62,38,0.06);
          animation: fadeUp .6s ease-out .2s both;
        }

        /* Brand */
        .act-brand { display:flex; align-items:center; gap:22px; margin-bottom:40px; animation:fadeUp .6s ease-out .1s both; }
        .act-logo { width:110px; height:110px; object-fit:contain; border-radius:50%; background:#fff; padding:4px; box-shadow:0 6px 24px rgba(0,0,0,0.35),0 0 0 3px rgba(234,179,8,0.5); flex-shrink:0; }
        .act-brand-text { display:flex; flex-direction:column; }
        .act-brand-name { font-family:'Playfair Display',Georgia,serif; font-size:38px; font-weight:700; color:#fff; line-height:1.05; letter-spacing:-.02em; }
        .act-brand-loc { font-size:13.5px; font-weight:700; color:rgba(255,255,255,0.68); letter-spacing:.14em; text-transform:uppercase; margin-top:7px; }
        .act-brand-trust { font-size:10.5px; font-weight:500; color:rgba(255,255,255,0.42); letter-spacing:.07em; text-transform:uppercase; margin-top:3px; }

        /* Eyebrow */
        .act-eyebrow { display:flex; align-items:center; gap:10px; font-size:11px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; color:#eab308; margin-bottom:16px; animation:fadeUp .6s ease-out .2s both; }
        .act-eyebrow-icon { width:28px; height:28px; border-radius:8px; background:rgba(234,179,8,0.15); border:1px solid rgba(234,179,8,0.3); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#eab308; }

        /* Hero */
        .act-h1 { font-family:'Playfair Display',Georgia,serif; font-size:clamp(34px,3.8vw,52px); font-weight:800; color:#fff; line-height:1.06; letter-spacing:-.03em; margin-bottom:36px; animation:fadeUp .65s ease-out .25s both; }
        .act-h1 em { font-style:italic; color:#eab308; }

        /* VM card */
        .act-vm { background:rgba(255,255,255,0.055); backdrop-filter:blur(18px); border:1px solid rgba(255,255,255,0.11); border-radius:20px; padding:28px 30px; display:flex; flex-direction:column; animation:fadeUp .7s ease-out .35s both; flex:1; }
        .act-vm-divider { height:1px; background:rgba(255,255,255,0.09); margin:22px 0; }
        .act-vm-row { display:flex; gap:18px; align-items:flex-start; }
        .act-vm-icon-wrap { width:52px; height:52px; border-radius:50%; flex-shrink:0; background:rgba(234,179,8,0.12); border:1.5px solid rgba(234,179,8,0.28); display:flex; align-items:center; justify-content:center; color:#eab308; }
        .act-vm-label { font-size:11.5px; font-weight:800; text-transform:uppercase; letter-spacing:.13em; color:#eab308; margin-bottom:9px; }
        .act-vm-text { font-size:14.5px; line-height:1.68; color:rgba(255,255,255,0.76); }
        .act-vm-text + .act-vm-text { margin-top:7px; }

        /* Form header */
        .act-form-eyebrow { font-size:11px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; color:#0e3e26; margin-bottom:8px; }
        .act-form-title { font-family:'Playfair Display',Georgia,serif; font-size:34px; font-weight:700; color:#0c1f15; letter-spacing:-.025em; line-height:1.1; margin-bottom:10px; }
        .act-form-title em { font-style:normal; color:#eab308; }
        .act-title-accent { display:block; width:36px; height:3px; background:#eab308; border-radius:2px; margin-bottom:10px; }
        .act-form-sub { font-size:14px; color:#8a92a0; line-height:1.5; margin-bottom:24px; font-weight:400; }

        /* Stepper */
        .act-stepper { display:flex; align-items:center; margin-bottom:28px; }
        .act-step { display:flex; align-items:center; gap:8px; flex:1; }
        .act-step:last-child { flex:none; }
        .act-step-dot { width:28px; height:28px; border-radius:50%; flex-shrink:0; border:2px solid #e5e7eb; background:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:#9ca3af; transition:all .3s; }
        .act-step--active .act-step-dot { border-color:#0e3e26; background:#0e3e26; color:#fff; box-shadow:0 0 0 4px rgba(14,62,38,0.12); }
        .act-step--done .act-step-dot { border-color:#10b981; background:#10b981; color:#fff; animation:dotCheck .35s ease-out forwards; }
        .act-step-label { font-size:11px; font-weight:600; color:#9ca3af; transition:color .3s; white-space:nowrap; }
        .act-step--active .act-step-label { color:#0e3e26; font-weight:700; }
        .act-step--done .act-step-label { color:#10b981; }
        .act-step-line { flex:1; height:1.5px; margin:0 8px; background:#e5e7eb; transition:background .3s; }
        .act-step--done > .act-step-line { background:#10b981; }

        /* Role tabs */
        .act-tabs-label { font-size:12px; font-weight:700; color:#374151; margin-bottom:10px; display:block; }
        .act-tabs { display:grid; grid-template-columns:1fr 1fr; background:#f3f4f6; padding:4px; border-radius:14px; margin-bottom:24px; gap:4px; border:1px solid #e9eaec; }
        .act-tab { display:flex; align-items:center; justify-content:center; gap:8px; padding:13px 8px; font-size:13.5px; font-weight:700; color:#9ca3af; background:transparent; border:none; border-radius:10px; cursor:pointer; transition:color .2s,background .2s; }
        .act-tab:hover:not(.act-tab--active) { color:#374151; background:rgba(255,255,255,0.5); }
        .act-tab--active { background:#fff; color:#0e3e26; box-shadow:0 2px 8px rgba(14,62,38,0.1),0 1px 2px rgba(14,62,38,0.06); }

        /* Fields */
        .act-fields { display:flex; flex-direction:column; gap:18px; margin-bottom:10px; }
        .act-field-label { display:block; font-size:12.5px; font-weight:700; color:#374151; margin-bottom:8px; }
        .act-field-wrap { position:relative; }
        .act-input { width:100%; padding:13px 16px 13px 46px; font-family:'DM Sans',sans-serif; font-size:14.5px; color:#0c1f15; background:#fafbfa; border:1.5px solid #e5e7eb; border-radius:12px; outline:none; transition:border-color .2s,box-shadow .2s,background .2s; -webkit-appearance:none; }
        .act-input:hover { border-color:#c5cdd6; }
        .act-input:focus { border-color:#0e3e26; box-shadow:0 0 0 3px rgba(14,62,38,0.09); background:#fff; }
        .act-input::placeholder { color:#b8bfc8; }
        .act-field-icon { position:absolute; left:15px; top:50%; transform:translateY(-50%); color:#c0c8d4; pointer-events:none; display:flex; align-items:center; transition:color .2s; }
        .act-field-wrap:focus-within .act-field-icon { color:#0e3e26; }
        .act-hint { font-size:12px; color:#78839a; margin-top:7px; font-weight:500; line-height:1.45; }

        /* OTP */
        .act-otp { text-align:center; font-size:28px; letter-spacing:10px; font-weight:900; padding-left:20px; border-color:#0e3e26 !important; }
        .act-otp:focus { animation:otpGlow 2s ease-in-out infinite; }

        /* Submit */
        .act-submit { width:100%; padding:14px; font-family:'DM Sans',sans-serif; font-size:15px; font-weight:700; color:#fff; background:#11452c; border:none; border-radius:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:9px; transition:transform .15s,box-shadow .15s,background .2s; box-shadow:0 4px 16px rgba(14,62,38,0.22); margin-top:22px; margin-bottom:10px; }
        .act-submit:hover:not(:disabled) { background:#0b301e; transform:translateY(-1.5px); box-shadow:0 8px 24px rgba(14,62,38,0.32); }
        .act-submit:active:not(:disabled) { transform:translateY(0); }
        .act-submit:disabled { opacity:.7; cursor:not-allowed; }

        /* Secondary */
        .act-secondary { display:flex; align-items:center; justify-content:center; gap:7px; font-size:13px; font-weight:600; color:#0e3e26; background:transparent; border:none; cursor:pointer; margin-top:8px; transition:opacity .15s; text-decoration:none; opacity:.8; width:100%; }
        .act-secondary:hover { opacity:1; text-decoration:underline; }
        .act-secondary:disabled { opacity:.5; cursor:not-allowed; pointer-events:none; }
        .act-meta { text-align:center; font-size:12.5px; color:#9ca3af; margin-top:6px; font-weight:500; }

        /* Badge */
        .act-badge { display:flex; align-items:center; justify-content:center; gap:7px; font-size:12px; color:#a0adb8; font-weight:500; margin-top:20px; }
        .act-badge svg { color:#10b981; }

        /* Success */
        .act-success-inner { display:flex; flex-direction:column; align-items:center; text-align:center; gap:16px; padding:8px 0; }
        .act-success-icon { animation:successPop .5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .act-success-title { font-family:'Playfair Display',Georgia,serif; font-size:30px; font-weight:700; color:#0c1f15; letter-spacing:-.02em; }
        .act-success-text { font-size:14px; color:#78839a; line-height:1.6; max-width:300px; }
        .act-continue-btn { display:flex; align-items:center; gap:9px; padding:14px 32px; font-family:'DM Sans',sans-serif; font-size:14.5px; font-weight:700; color:#fff; background:#11452c; border:none; border-radius:12px; cursor:pointer; text-decoration:none; box-shadow:0 4px 14px rgba(14,62,38,0.25); transition:transform .15s,box-shadow .15s; margin-top:8px; }
        .act-continue-btn:hover { transform:translateY(-1.5px); box-shadow:0 8px 22px rgba(14,62,38,0.3); }

        /* Responsive */
        @media (max-width: 1024px) {
          .act-left { width:44%; padding:40px 40px 100px; }
          .act-right { padding:40px 36px; }
          .act-card { padding:38px 36px 32px; }
        }
        @media (max-width: 768px) {
          .act { flex-direction: column; overflow-y: auto; }
          .dots-grid { display: none; }
          .act-left {
            width: 100%;
            min-height: unset;
            padding: 24px 20px 28px;
            clip-path: none;
          }
          .act-brand { gap: 14px; margin-bottom: 16px; }
          .act-logo  { width: 90px; height: 90px; }
          .act-brand-name { font-size: 22px; }
          .act-h1 { font-size: 22px; margin-bottom: 0; }
          .act-vm { display: none; }

          .act-right { padding: 20px 16px 36px; }
          .act-card  { max-width: 100%; padding: 24px 20px 20px; border-radius: 20px; }

          /* Stepper: tighten dots + hide labels on very small screens */
          .act-stepper { gap: 0; }
          .act-step-label { display: none; }
          .act-step-dot   { width: 24px; height: 24px; font-size: 10px; }
          .act-step-line  { margin: 0 4px; }

          /* OTP: reduce letter-spacing so it doesn't overflow */
          .act-otp { font-size: 24px; letter-spacing: 6px; padding-left: 12px; }

          .act-curve-overlay { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .act-brand,.act-eyebrow,.act-h1,.act-vm,.act-card { animation:none !important; opacity:1 !important; }
          .act-left-bg { animation:none !important; }
        }
      `}</style>

      <div className="act">

        {/* ── Left panel ── */}
        <aside className="act-left">
          <div className="act-left-bg" style={{ backgroundImage: `url(${classroomBg})` }} />
          <div className="act-left-overlay" />
          <DotsGrid />
          <div className="act-left-content">
            <div className="act-brand">
              <img src={logo} alt="Iqra School" className="act-logo" />
              <div className="act-brand-text">
                <span className="act-brand-name">Iqra English<br />Medium School</span>
                <span className="act-brand-loc">Chadotar</span>
                <span className="act-brand-trust">Kohetoor Education &amp; Charitable Trust</span>
              </div>
            </div>
            <div className="act-eyebrow">
              <div className="act-eyebrow-icon"><ActivateBadgeSVG /></div>
              Account Activation
            </div>
            <h1 className="act-h1">Activate your <em>digital learning</em><br />journey.</h1>
            <div className="act-vm">
              <div className="act-vm-row">
                <div className="act-vm-icon-wrap"><VisionSVG /></div>
                <div>
                  <div className="act-vm-label">Our Vision</div>
                  <div className="act-vm-text">To be a leading institution that empowers every learner with knowledge, character, and confidence to excel academically and contribute meaningfully to society.</div>
                </div>
              </div>
              <div className="act-vm-divider" />
              <div className="act-vm-row">
                <div className="act-vm-icon-wrap"><MissionSVG /></div>
                <div>
                  <div className="act-vm-label">Our Mission</div>
                  <div className="act-vm-text">To nurture a generation of lifelong learners grounded in knowledge, integrity, and compassion.</div>
                  <div className="act-vm-text">To foster a safe, inclusive, and inspiring environment that encourages curiosity, creativity, and critical thinking.</div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Golden Curve SVG Overlay ── */}
        <svg
          className="act-curve-overlay"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M47.3,0 C46.5,20 44.2,35 44.0,50 C43.8,65 45.8,80 47.5,100"
            stroke="#eab308" strokeWidth="1.2" opacity="0.08" vectorEffect="non-scaling-stroke"/>
          <path d="M47.3,0 C46.5,20 44.2,35 44.0,50 C43.8,65 45.8,80 47.5,100"
            stroke="#eab308" strokeWidth="0.6" opacity="0.15" vectorEffect="non-scaling-stroke"/>
          <path d="M47.3,0 C46.5,20 44.2,35 44.0,50 C43.8,65 45.8,80 47.5,100"
            stroke="#eab308" strokeWidth="0.15" opacity="0.4" vectorEffect="non-scaling-stroke"/>
          <path d="M47.3,0 C46.5,20 44.2,35 44.0,50 C43.8,65 45.8,80 47.5,100"
            stroke="#eab308" strokeWidth="0.28" opacity="0.95" vectorEffect="non-scaling-stroke"/>
          <path d="M47.8,0 C47.0,20 44.7,35 44.5,50 C44.3,65 46.3,80 48.0,100"
            stroke="#eab308" strokeWidth="0.1" opacity="0.25" vectorEffect="non-scaling-stroke"/>
        </svg>

        {/* ── Right panel ── */}
        <main className="act-right">
          <div className="act-card">
            <div className="act-form-eyebrow">School Portal</div>

            {step === 'success' ? (
              <>
                <div className="act-success-inner">
                  <div className="act-success-icon"><SuccessStarSVG /></div>
                  <h2 className="act-success-title">Portal activated!</h2>
                  <p className="act-success-text">Your account is linked and ready. You now have full access to your academic portal.</p>
                  <Link className="act-continue-btn" to="/portal">
                    Continue to Portal <ArrowSVG />
                  </Link>
                </div>
                <div className="act-badge"><ShieldSVG />Secured by 256-bit SSL encryption</div>
              </>
            ) : (
              <>
                <StepDots current={step} />

                <h2 className="act-form-title">
                  {step === 'start'  ? <>Activate <em>Account</em></> :
                   step === 'verify' ? <>Verify <em>Code</em></> :
                                       <>Set <em>Password</em></>}
                </h2>
                <span className="act-title-accent" />
                <p className="act-form-sub">
                  {step === 'start'
                    ? (inviteMode ? 'Checking your secure invite link…' : 'Enter the details from your admission receipt to get started.')
                    : step === 'verify'
                      ? `We sent a 6-digit code to ${email || 'your email'}.`
                      : "Create a strong password you'll use to sign in."}
                </p>

                {/* ── Start ── */}
                {step === 'start' && inviteMode && loading && (
                  <>
                    <button className="act-submit" disabled><SpinnerSVG />Opening secure invite…</button>
                    <Link className="act-secondary" to="/login"><BackSVG /> Back to Login</Link>
                  </>
                )}

                {step === 'start' && !inviteMode && (
                  <form onSubmit={start}>
                    <span className="act-tabs-label">I am a</span>
                    <div className="act-tabs">
                      <button type="button"
                        className={`act-tab${accountType === 'student' ? ' act-tab--active' : ''}`}
                        onClick={() => setAccountType('student')}>
                        <StudentSVG /> Student
                      </button>
                      <button type="button"
                        className={`act-tab${accountType === 'parent' ? ' act-tab--active' : ''}`}
                        onClick={() => setAccountType('parent')}>
                        <ParentSVG /> Parent
                      </button>
                    </div>

                    <div className="act-fields">
                      <div className="act-field">
                        <label className="act-field-label" htmlFor="act-identifier">Student ID / GR Number / Mobile Number</label>
                        <div className="act-field-wrap">
                          <input id="act-identifier" className="act-input" value={identifier}
                            onChange={e => setIdentifier(e.target.value)}
                            placeholder="Enter Student ID, GR Number or Mobile" required autoFocus />
                          <span className="act-field-icon"><IdSVG /></span>
                        </div>
                        <div className="act-hint">Found on your admission receipt or fee receipt.</div>
                      </div>

                      <div className="act-field">
                        <label className="act-field-label" htmlFor="act-email">{accountType === 'student' ? 'Student' : 'Guardian'} Email Address</label>
                        <div className="act-field-wrap">
                          <input id="act-email" className="act-input" type="email" value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="Enter email address" required />
                          <span className="act-field-icon"><EmailSVG /></span>
                        </div>
                      </div>
                    </div>

                    <button className="act-submit" disabled={loading}>
                      {loading ? <><SpinnerSVG />Sending…</> : <><SendSVG />Send Verification Code&nbsp;&nbsp;<ArrowSVG /></>}
                    </button>
                    <Link className="act-secondary" to="/login"><BackSVG /> Back to Login</Link>
                  </form>
                )}

                {/* ── Verify ── */}
                {step === 'verify' && (
                  <form onSubmit={verify}>
                    <div className="act-fields">
                      <div className="act-field">
                        <label className="act-field-label" htmlFor="act-otp">6-digit activation code</label>
                        <div className="act-field-wrap">
                          <input id="act-otp" className="act-input act-otp" value={otp}
                            onChange={e => setOtp(e.target.value.replace(/\D/g,'').slice(0,6))}
                            inputMode="numeric" maxLength={6} placeholder="——————" required autoFocus />
                        </div>
                      </div>
                    </div>
                    <button className="act-submit" disabled={loading || otp.length !== 6}>
                      {loading ? <><SpinnerSVG />Checking…</> : <><CheckSVG />Verify Code&nbsp;&nbsp;<ArrowSVG /></>}
                    </button>
                    <button type="button" className="act-secondary"
                      disabled={loading || secondsLeft > 0} onClick={resend}>
                      {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Didn't get it? Resend code"}
                    </button>
                    <div className="act-meta">{email}</div>
                  </form>
                )}

                {/* ── Password ── */}
                {step === 'password' && (
                  <form onSubmit={complete}>
                    <div className="act-fields">
                      <div className="act-field">
                        <label className="act-field-label" htmlFor="act-pwd">New Password</label>
                        <div className="act-field-wrap">
                          <input id="act-pwd" className="act-input" type="password" value={password}
                            onChange={e => setPassword(e.target.value)}
                            minLength={8} placeholder="Min. 8 characters" required autoFocus />
                          <span className="act-field-icon"><LockSVG /></span>
                        </div>
                      </div>
                      <div className="act-field">
                        <label className="act-field-label" htmlFor="act-confirm">Confirm Password</label>
                        <div className="act-field-wrap">
                          <input id="act-confirm" className="act-input" type="password" value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            minLength={8} placeholder="Repeat your password" required />
                          <span className="act-field-icon"><LockSVG /></span>
                        </div>
                      </div>
                    </div>
                    <button className="act-submit" disabled={loading}>
                      {loading ? <><SpinnerSVG />Activating…</> : <><ShieldSVG />Activate Portal&nbsp;&nbsp;<ArrowSVG /></>}
                    </button>
                  </form>
                )}

                <div className="act-badge"><ShieldSVG />Secured by 256-bit SSL encryption</div>
              </>
            )}
          </div>
        </main>

      </div>
    </>
  )
}
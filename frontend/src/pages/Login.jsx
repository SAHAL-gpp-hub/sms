import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logo from '../assets/logo.svg'
import classroomBg from '../assets/classroom_green_bg.png'
import { authAPI, extractError } from '../services/api'
import { normalizeAuthUser, setAuthUser, setToken } from '../services/auth'

// ── SVG Icons ──────────────────────────────────────────────────────────────────
const EmailSVG = () => (
  <svg width="17" height="17" viewBox="0 0 34 34" fill="none">
    <rect x="3" y="7" width="28" height="20" rx="3" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M3 11 L17 19 L31 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
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
const EyeSVG = ({ open }) => open ? (
  <svg width="17" height="17" viewBox="0 0 34 34" fill="none">
    <path d="M3 17 C3 17 8 7 17 7 C26 7 31 17 31 17 C31 17 26 27 17 27 C8 27 3 17 3 17Z" stroke="currentColor" strokeWidth="1.8"/>
    <circle cx="17" cy="17" r="4" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M5 5 L29 29" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
) : (
  <svg width="17" height="17" viewBox="0 0 34 34" fill="none">
    <path d="M3 17 C3 17 8 7 17 7 C26 7 31 17 31 17 C31 17 26 27 17 27 C8 27 3 17 3 17Z" stroke="currentColor" strokeWidth="1.8"/>
    <circle cx="17" cy="17" r="4" stroke="currentColor" strokeWidth="1.8"/>
  </svg>
)
const ShieldSVG = () => (
  <svg width="15" height="15" viewBox="0 0 30 30" fill="none">
    <path d="M15 2 L26 6.5 L26 15 C26 20.5 21.5 25.5 15 28 C8.5 25.5 4 20.5 4 15 L4 6.5 Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    <path d="M10 15 L13 18 L20 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const ArrowSVG = () => (
  <svg width="15" height="15" viewBox="0 0 30 30" fill="none">
    <path d="M6 15 L24 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M17 8 L24 15 L17 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const SpinnerSVG = () => (
  <svg width="18" height="18" viewBox="0 0 36 36" fill="none" style={{ animation: 'spin 0.75s linear infinite', flexShrink: 0 }}>
    <circle cx="18" cy="18" r="14" stroke="rgba(255,255,255,0.25)" strokeWidth="3"/>
    <path d="M18 4 A14 14 0 0 1 32 18" stroke="white" strokeWidth="3" strokeLinecap="round"/>
  </svg>
)
const ActivateSVG = () => (
  <svg width="15" height="15" viewBox="0 0 30 30" fill="none">
    <circle cx="12" cy="10" r="4" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M4 26 C4 21 7.6 17 12 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="22" cy="22" r="6" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M19 22 L21 24 L25 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const SetupSVG = () => (
  <svg width="15" height="15" viewBox="0 0 30 30" fill="none">
    <circle cx="15" cy="15" r="4" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M15 3 L15 7M15 23 L15 27M3 15 L7 15M23 15 L27 15M6.5 6.5 L9.3 9.3M20.7 20.7 L23.5 23.5M6.5 23.5 L9.3 20.7M20.7 9.3 L23.5 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
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
const AdminIcon = () => (
  <svg width="18" height="18" viewBox="0 0 36 36" fill="none">
    <circle cx="18" cy="13" r="6" stroke="currentColor" strokeWidth="2"/>
    <path d="M6 30 C6 23.373 11.373 18 18 18 C24.627 18 30 23.373 30 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <rect x="14" y="2" width="8" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
)
const TeacherIcon = () => (
  <svg width="18" height="18" viewBox="0 0 36 36" fill="none">
    <rect x="4" y="8" width="28" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M4 14 L32 14" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="18" cy="22" r="3" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M6 30 L30 30M12 26 L12 30M24 26 L24 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)
const StudentIcon = () => (
  <svg width="18" height="18" viewBox="0 0 36 36" fill="none">
    <path d="M18 6 L32 13 L18 20 L4 13 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M10 17 L10 26 C10 26 13 30 18 30 C23 30 26 26 26 26 L26 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M32 13 L32 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="32" cy="23" r="2" fill="currentColor"/>
  </svg>
)
const ParentIcon = () => (
  <svg width="18" height="18" viewBox="0 0 36 36" fill="none">
    <circle cx="12" cy="11" r="4.5" stroke="currentColor" strokeWidth="2"/>
    <circle cx="24" cy="11" r="4.5" stroke="currentColor" strokeWidth="2"/>
    <path d="M2 30 C2 23.373 6.477 18 12 18 C14.5 18 16.8 19 18 20.5 C19.2 19 21.5 18 24 18 C29.523 18 34 23.373 34 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

function DotsGrid() {
  const dots = []
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 8; c++)
      dots.push(<circle key={`${r}-${c}`} cx={c*18+9} cy={r*18+9} r="2.5" fill="#eab308" opacity="0.6"/>)
  return (
    <svg className="dots-grid" viewBox="0 0 153 99" fill="none">
      {dots}
    </svg>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const [selectedRole, setSelectedRole] = useState('ADMIN')
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [requires2FA, setRequires2FA]   = useState(false)
  const [challengeId, setChallengeId]   = useState('')
  const [otp, setOtp]                   = useState('')
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (requires2FA) {
        const r = await authAPI.verify2FA(challengeId, otp)
        setToken(r.data.access_token)
        setAuthUser(normalizeAuthUser(r.data))
        navigate(r.data.role === 'student' || r.data.role === 'parent' ? '/portal' : '/')
      } else {
        const r = await authAPI.login(email, password)
        if (r.data?.requires_2fa) {
          setRequires2FA(true); setChallengeId(r.data.challenge_id || ''); setOtp(''); return
        }
        setToken(r.data.access_token)
        setAuthUser(normalizeAuthUser(r.data))
        navigate(r.data.role === 'student' || r.data.role === 'parent' ? '/portal' : '/')
      }
    } catch (err) { setError(extractError(err)) }
    finally { setLoading(false) }
  }

  const ROLES = [
    { role:'ADMIN',   label:'Admin',   Icon:AdminIcon,   color:'#16a34a', bg:'rgba(22,163,74,0.1)',   border:'rgba(22,163,74,0.25)' },
    { role:'TEACHER', label:'Teacher', Icon:TeacherIcon, color:'#16a34a', bg:'rgba(22,163,74,0.1)',   border:'rgba(22,163,74,0.25)' },
    { role:'STUDENT', label:'Student', Icon:StudentIcon, color:'#d97706', bg:'rgba(217,119,6,0.1)',   border:'rgba(217,119,6,0.25)' },
    { role:'PARENT',  label:'Parent',  Icon:ParentIcon,  color:'#7c3aed', bg:'rgba(124,58,237,0.1)',  border:'rgba(124,58,237,0.25)' },
  ]

  /*
   * THE CURVE PATH — same bezier used in BOTH:
   *   1. clip-path on .lr-left  (cuts the image along this curve)
   *   2. the golden SVG line    (drawn exactly on that cut edge)
   *
   * Coordinate system for clip-path: percentage of the element.
   * The left panel is 48vw wide. The curve moves ±3% horizontally.
   *
   * path() for clip-path (px, relative to the element):
   *   We use a CSS custom property trick — actually we use an inline SVG
   *   absolutely positioned on top of .lr that spans full width/height,
   *   and we clip .lr-left with clip-path: path(...)
   *
   * Simpler approach that works cross-browser:
   *   Use a full-viewport SVG overlay with two jobs:
   *     a) Fill left polygon (clip visual) 
   *     b) Draw the golden stroke on the curve
   */

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes bgExpand{ 0% { transform:scale(1); } 100% { transform:scale(1.15); } }
        @keyframes errShake{
          0%,100%{transform:translateX(0);}
          20%,60%{transform:translateX(-5px);}
          40%,80%{transform:translateX(5px);}
        }

        /* ── Root ── */
        .lr {
          min-height: 100vh;
          display: flex;
          font-family: 'DM Sans', system-ui, sans-serif;
          background: #f0f2f0;
          position: relative;
          overflow: hidden;
        }

        /* ────────────────────────────────────────────────────────────────────
           LEFT PANEL
           Width = exactly 48%. The curved edge is created by clip-path.
           clip-path path() draws the S-curve on the right side of the panel.
           The path goes: top-left corner → along the S-curve right edge →
           bottom-right corner → bottom-left corner → close.
           
           The S-curve control points (in % of element width/height):
             Start : (100%, 0%)        — top right
             CP1   : (97%,  30%)       — pulls slightly left near top
             CP2   : (93%,  50%)       — inflection, furthest left at midpoint  
             CP3   : (97%,  70%)       — pulls back right
             End   : (100%, 100%)      — bottom right
           
           We use clip-path with polygon approximation for broad support,
           then a real SVG overlay for the golden line.
        ─────────────────────────────────────────────────────────────────── */
        .lr-left {
          width: 48%;
          min-height: 100vh;
          position: relative;
          display: flex;
          flex-direction: column;
          padding: 48px 52px 120px;
          flex-shrink: 0;
          overflow: hidden;
          z-index: 2;
          /* 
           * clip-path: S-curve on the right edge.
           * Points trace: left edge top → curve right edge → left edge bottom
           * The curve uses polygon with many steps to approximate the bezier.
           * For the real bezier we use the SVG overlay below.
           */
          clip-path: polygon(
            0% 0%,
            /* S-curve right edge — 20 steps approximating the bezier */
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

        .lr-left-bg {
          position: absolute; inset: -10%;
          background-size: cover; background-position: center 25%;
          z-index: 0;
          animation: bgExpand 25s infinite alternate linear;
        }
        .lr-left-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(155deg,
            rgba(5,35,20,0.85) 0%,
            rgba(8,45,25,0.78) 45%,
            rgba(5,35,20,0.88) 100%
          );
          z-index: 1;
        }
        .dots-grid {
          position: absolute; bottom: 80px; left: 40px;
          width: 140px; z-index: 3; pointer-events: none;
        }
        .lr-left-content {
          position: relative; z-index: 5;
          display: flex; flex-direction: column; height: 100%;
        }

        /* ────────────────────────────────────────────────────────────────────
           GOLDEN CURVE SVG OVERLAY
           Position: fixed over the full .lr container.
           Draws the EXACT same S-curve as the clip-path, as a golden stroke.
           This sits above both panels (z-index 20).
        ─────────────────────────────────────────────────────────────────── */
        .lr-curve-overlay {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          z-index: 20;
          pointer-events: none;
          overflow: visible;
        }

        /* ── Right panel ── */
        .lr-right {
          flex: 1;
          display: flex; align-items: center; justify-content: center;
          padding: 48px 52px;
          position: relative;
          background: #f0f2f0;
          z-index: 1;
        }

        /* ── Form card ── */
        .lr-form-card {
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
        .lr-brand { display:flex; align-items:center; gap:22px; margin-bottom:40px; animation:fadeUp .6s ease-out .1s both; }
        .lr-logo { width:110px; height:110px; object-fit:contain; border-radius:50%; background:#fff; padding:4px; box-shadow:0 6px 24px rgba(0,0,0,0.35),0 0 0 3px rgba(234,179,8,0.5); flex-shrink:0; }
        .lr-brand-text { display:flex; flex-direction:column; }
        .lr-brand-name { font-family:'Playfair Display',Georgia,serif; font-size:38px; font-weight:700; color:#fff; line-height:1.05; letter-spacing:-.02em; }
        .lr-brand-loc { font-size:13.5px; font-weight:700; color:rgba(255,255,255,0.68); letter-spacing:.14em; text-transform:uppercase; margin-top:7px; }
        .lr-brand-trust { font-size:10.5px; font-weight:500; color:rgba(255,255,255,0.42); letter-spacing:.07em; text-transform:uppercase; margin-top:3px; }

        /* Eyebrow */
        .lr-eyebrow { display:flex; align-items:center; gap:10px; font-size:11px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; color:#eab308; margin-bottom:16px; animation:fadeUp .6s ease-out .2s both; }
        .lr-eyebrow-icon { width:28px; height:28px; border-radius:8px; background:rgba(234,179,8,0.15); border:1px solid rgba(234,179,8,0.3); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#eab308; }

        /* Hero */
        .lr-h1 { font-family:'Playfair Display',Georgia,serif; font-size:clamp(34px,3.8vw,52px); font-weight:800; color:#fff; line-height:1.06; letter-spacing:-.03em; margin-bottom:36px; animation:fadeUp .65s ease-out .25s both; }
        .lr-h1 em { font-style:italic; color:#eab308; }

        /* VM card */
        .lr-vm { background:rgba(255,255,255,0.055); backdrop-filter:blur(18px); border:1px solid rgba(255,255,255,0.11); border-radius:20px; padding:28px 30px; display:flex; flex-direction:column; animation:fadeUp .7s ease-out .35s both; flex:1; }
        .lr-vm-divider { height:1px; background:rgba(255,255,255,0.09); margin:22px 0; }
        .lr-vm-row { display:flex; gap:18px; align-items:flex-start; }
        .lr-vm-icon-wrap { width:52px; height:52px; border-radius:50%; flex-shrink:0; background:rgba(234,179,8,0.12); border:1.5px solid rgba(234,179,8,0.28); display:flex; align-items:center; justify-content:center; color:#eab308; }
        .lr-vm-label { font-size:11.5px; font-weight:800; text-transform:uppercase; letter-spacing:.13em; color:#eab308; margin-bottom:9px; }
        .lr-vm-text { font-size:14.5px; line-height:1.68; color:rgba(255,255,255,0.76); }
        .lr-vm-text + .lr-vm-text { margin-top:7px; }

        /* Form header */
        .lr-form-eyebrow { font-size:11px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; color:#0e3e26; margin-bottom:8px; }
        .lr-form-title { font-family:'Playfair Display',Georgia,serif; font-size:36px; font-weight:700; color:#0c1f15; letter-spacing:-.025em; line-height:1.1; margin-bottom:10px; }
        .lr-title-accent { display:block; width:36px; height:3px; background:#eab308; border-radius:2px; margin-bottom:10px; }
        .lr-form-sub { font-size:14px; color:#8a92a0; line-height:1.5; margin-bottom:28px; font-weight:400; }

        /* Error */
        .lr-error { display:flex; align-items:flex-start; gap:10px; background:#fff5f5; border:1px solid #fecaca; border-radius:12px; padding:12px 14px; margin-bottom:20px; font-size:13.5px; color:#b91c1c; font-weight:500; animation:errShake .4s ease-out; }

        /* Tabs */
        .lr-tabs-label { font-size:12px; font-weight:700; color:#374151; margin-bottom:10px; display:block; }
        .lr-tabs { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:26px; }
        .lr-tab { display:flex; flex-direction:row; align-items:center; justify-content:center; gap:7px; padding:10px 6px; font-size:12.5px; font-weight:600; color:#9ca3af; background:#f3f4f6; border:1.5px solid #e9eaec; border-radius:10px; cursor:pointer; transition:all .18s ease; white-space:nowrap; }
        .lr-tab:hover:not(.lr-tab--active) { color:#374151; background:#edf0ed; border-color:#d1d5db; }
        .lr-tab--active { background:var(--tab-bg); border-color:var(--tab-border); color:var(--tab-color); box-shadow:0 2px 8px rgba(0,0,0,0.08); }

        /* Fields */
        .lr-fields { display:flex; flex-direction:column; gap:18px; margin-bottom:10px; }
        .lr-field-label { display:block; font-size:12.5px; font-weight:700; color:#374151; margin-bottom:8px; }
        .lr-field-wrap { position:relative; }
        .lr-input { width:100%; padding:13px 16px 13px 46px; font-family:'DM Sans',sans-serif; font-size:14.5px; color:#0c1f15; background:#fafbfa; border:1.5px solid #e5e7eb; border-radius:12px; outline:none; transition:border-color .2s,box-shadow .2s,background .2s; -webkit-appearance:none; }
        .lr-input:hover { border-color:#c5cdd6; }
        .lr-input:focus { border-color:#0e3e26; box-shadow:0 0 0 3px rgba(14,62,38,0.09); background:#fff; }
        .lr-input::placeholder { color:#b8bfc8; }
        .lr-field-icon { position:absolute; left:15px; top:50%; transform:translateY(-50%); color:#c0c8d4; pointer-events:none; display:flex; align-items:center; transition:color .2s; }
        .lr-field-wrap:focus-within .lr-field-icon { color:#0e3e26; }
        .lr-field-action { position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#b0b8c4; padding:4px; display:flex; align-items:center; transition:color .15s; }
        .lr-field-action:hover { color:#0e3e26; }
        .lr-forgot-password { display:flex; justify-content:flex-end; margin-bottom:24px; margin-top:8px; }
        .lr-forgot-password a { font-size:13px; font-weight:700; color:#0e3e26; text-decoration:none; transition:opacity 0.2s; }
        .lr-forgot-password a:hover { opacity:0.8; text-decoration:underline; }
        .lr-otp-hint { font-size:13px; color:#78839a; line-height:1.5; margin-bottom:10px; }
        .lr-otp-input { text-align:center; font-size:26px; letter-spacing:10px; font-weight:900; padding-left:26px; }

        /* Submit */
        .lr-submit { width:100%; padding:14px; font-family:'DM Sans',sans-serif; font-size:15px; font-weight:700; color:#fff; background:#11452c; border:none; border-radius:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:9px; transition:transform .15s,box-shadow .15s,background .2s; box-shadow:0 4px 16px rgba(14,62,38,0.22); margin-bottom:20px; }
        .lr-submit:hover:not(:disabled) { background:#0b301e; transform:translateY(-1.5px); box-shadow:0 8px 24px rgba(14,62,38,0.32); }
        .lr-submit:active:not(:disabled) { transform:translateY(0); }
        .lr-submit:disabled { opacity:.7; cursor:not-allowed; }

        /* Divider */
        .lr-divider { display:flex; align-items:center; gap:12px; margin-bottom:18px; font-size:12.5px; color:#c8cdd6; font-weight:500; }
        .lr-divider::before,.lr-divider::after { content:''; flex:1; height:1px; background:#e9eaec; }

        /* Secondary */
        .lr-secondary { display:flex; justify-content:space-between; align-items:center; margin-bottom:22px; }
        .lr-sec-link { display:flex; align-items:center; gap:7px; font-size:13px; font-weight:600; color:#0e3e26; text-decoration:none; opacity:.85; transition:opacity .15s; }
        .lr-sec-link:hover { opacity:1; }
        .lr-sec-link-amber { display:flex; align-items:center; gap:7px; font-size:13px; font-weight:600; color:#10b981; text-decoration:none; opacity:.85; transition:opacity .15s; }
        .lr-sec-link-amber:hover { opacity:1; }
        .lr-badge { display:flex; align-items:center; justify-content:center; gap:7px; font-size:12px; color:#a0adb8; font-weight:500; }
        .lr-badge svg { color:#10b981; }

        /* Responsive */
        @media (max-width: 1024px) {
          .lr-left { width:44%; padding:40px 40px 100px; }
          .lr-right { padding:40px 36px; }
          .lr-form-card { padding:38px 36px 32px; }
        }
        @media (max-width: 768px) {
          .lr { flex-direction: column; overflow-y: auto; }
          .dots-grid { display: none; }
          /* Compact banner — logo + name side by side, no wasted height */
          .lr-left {
            width: 100%;
            min-height: unset;
            padding: 24px 20px 28px;
            clip-path: none;
          }
          .lr-brand { gap: 14px; margin-bottom: 16px; }
          .lr-logo  { width: 90px; height: 90px; }
          .lr-brand-name { font-size: 22px; }
          .lr-h1 { font-size: 22px; margin-bottom: 0; }

          /* Hide the vision/mission card — not useful on mobile login */
          .lr-vm { display: none; }

          .lr-right { padding: 20px 16px 36px; }
          .lr-form-card { max-width: 100%; padding: 24px 20px 20px; border-radius: 20px; }

          /* 2×2 grid instead of 4-col row */
          .lr-tabs { grid-template-columns: repeat(2, 1fr); gap: 6px; }
          .lr-tab  { padding: 11px 6px; font-size: 13px; }

          /* Stack activate + setup links vertically */
          .lr-secondary { flex-direction: column; align-items: flex-start; gap: 12px; }

          .lr-curve-overlay { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lr-brand,.lr-eyebrow,.lr-h1,.lr-vm,.lr-form-card { animation:none !important; opacity:1 !important; }
          .lr-left-bg { animation:none !important; }
        }
      `}
      </style>

      <div className="lr">

        {/* ── Left panel ── */}
        <aside className="lr-left">
          <div className="lr-left-bg" style={{ backgroundImage: `url(${classroomBg})` }} />
          <div className="lr-left-overlay" />
          <DotsGrid />
          <div className="lr-left-content">
            <div className="lr-brand">
              <img src={logo} alt="Iqra School" className="lr-logo" />
              <div className="lr-brand-text">
                <span className="lr-brand-name">Iqra English<br />Medium School</span>
                <span className="lr-brand-loc">Chadotar</span>
                <span className="lr-brand-trust">Kohetoor Education &amp; Charitable Trust</span>
              </div>
            </div>
            <div className="lr-eyebrow">
              <div className="lr-eyebrow-icon"><ShieldSVG /></div>
              Management System
            </div>
            <h1 className="lr-h1">Educating <em>minds</em>,<br />shaping futures.</h1>
            <div className="lr-vm">
              <div className="lr-vm-row">
                <div className="lr-vm-icon-wrap"><VisionSVG /></div>
                <div>
                  <div className="lr-vm-label">Our Vision</div>
                  <div className="lr-vm-text">To be a leading institution that empowers every learner with knowledge, character, and confidence to excel academically and contribute meaningfully to society.</div>
                </div>
              </div>
              <div className="lr-vm-divider" />
              <div className="lr-vm-row">
                <div className="lr-vm-icon-wrap"><MissionSVG /></div>
                <div>
                  <div className="lr-vm-label">Our Mission</div>
                  <div className="lr-vm-text">To nurture a generation of lifelong learners grounded in knowledge, integrity, and compassion.</div>
                  <div className="lr-vm-text">To foster a safe, inclusive, and inspiring environment that encourages curiosity, creativity, and critical thinking.</div>
                  <div className="lr-vm-text">To partner with parents and the community in shaping responsible global citizens.</div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/*
          ── GOLDEN CURVE SVG OVERLAY ──────────────────────────────────────
          Spans the FULL .lr container (position:absolute, 100%×100%).
          Uses viewBox="0 0 100 100" so coordinates are in % of the container.
          The left panel is 48% wide, so the curve's x-coords are near 48.
          
          The S-curve path (matching the clip-path polygon above):
            Start : (47.3, 0)   — top, slightly left of 48%
            CP1   : (45.5, 25)  — bows left near top quarter
            Inflect: (45.0, 50) — furthest left at midpoint
            CP2   : (45.5, 75)  — comes back right near bottom quarter  
            End   : (47.5, 100) — bottom, back near 48%
          
          This EXACTLY matches where clip-path cuts the image.
        ────────────────────────────────────────────────────────────────── */}
        <svg
          className="lr-curve-overlay"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Outer glow */}
          <path
            d="M47.3,0 C46.5,20 44.2,35 44.0,50 C43.8,65 45.8,80 47.5,100"
            stroke="#eab308" strokeWidth="1.2" opacity="0.08"
            vectorEffect="non-scaling-stroke"
          />
          {/* Mid glow */}
          <path
            d="M47.3,0 C46.5,20 44.2,35 44.0,50 C43.8,65 45.8,80 47.5,100"
            stroke="#eab308" strokeWidth="0.6" opacity="0.15"
            vectorEffect="non-scaling-stroke"
          />
          {/* Thin outer accent */}
          <path
            d="M47.3,0 C46.5,20 44.2,35 44.0,50 C43.8,65 45.8,80 47.5,100"
            stroke="#eab308" strokeWidth="0.15" opacity="0.4"
            vectorEffect="non-scaling-stroke"
          />
          {/* MAIN golden line */}
          <path
            d="M47.3,0 C46.5,20 44.2,35 44.0,50 C43.8,65 45.8,80 47.5,100"
            stroke="#eab308" strokeWidth="0.28" opacity="0.95"
            vectorEffect="non-scaling-stroke"
          />
          {/* Inner thin parallel */}
          <path
            d="M47.8,0 C47.0,20 44.7,35 44.5,50 C44.3,65 46.3,80 48.0,100"
            stroke="#eab308" strokeWidth="0.1" opacity="0.25"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* ── Right panel ── */}
        <main className="lr-right">
          <div className="lr-form-card">
            <div className="lr-form-eyebrow">School Portal</div>
            <h2 className="lr-form-title">Welcome back</h2>
            <span className="lr-title-accent" />
            <p className="lr-form-sub">Sign in to your school management account</p>

            {error && (
              <div className="lr-error">
                <svg width="15" height="15" viewBox="0 0 30 30" fill="none">
                  <circle cx="15" cy="15" r="12" stroke="currentColor" strokeWidth="2"/>
                  <path d="M15 9 L15 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                  <circle cx="15" cy="21" r="1.5" fill="currentColor"/>
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {!requires2FA ? (
                <>
                  <span className="lr-tabs-label">Sign in as</span>
                  <div className="lr-tabs">
                    {ROLES.map(({ role, label, Icon, color, bg, border }) => (
                      <button key={role} type="button"
                        className={`lr-tab${selectedRole===role?' lr-tab--active':''}`}
                        style={{'--tab-color':color,'--tab-bg':bg,'--tab-border':border}}
                        onClick={() => setSelectedRole(role)}>
                        <span style={{color:selectedRole===role?color:'#9ca3af',display:'flex',alignItems:'center'}}><Icon /></span>
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="lr-fields">
                    <div className="lr-field">
                      <label className="lr-field-label" htmlFor="lr-email">Email Address</label>
                      <div className="lr-field-wrap">
                        <input id="lr-email" type="email" className="lr-input"
                          value={email} onChange={e=>setEmail(e.target.value)}
                          placeholder="you@iqraschool.edu.in" required autoFocus autoComplete="email"/>
                        <span className="lr-field-icon"><EmailSVG /></span>
                      </div>
                    </div>
                    <div className="lr-field">
                      <label className="lr-field-label" htmlFor="lr-pwd">Password</label>
                      <div className="lr-field-wrap">
                        <input id="lr-pwd" type={showPassword?'text':'password'} className="lr-input"
                          value={password} onChange={e=>setPassword(e.target.value)}
                          placeholder="Enter your password" required autoComplete="current-password"
                          style={{paddingRight:'44px'}}/>
                        <span className="lr-field-icon"><LockSVG /></span>
                        <button type="button" className="lr-field-action"
                          onClick={()=>setShowPassword(s=>!s)}
                          aria-label={showPassword?'Hide password':'Show password'}>
                          <EyeSVG open={showPassword} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="lr-forgot-password">
                    <Link to="/forgot-password">Forgot password?</Link>
                  </div>
                </>
              ) : (
                <div className="lr-fields">
                  <div className="lr-field">
                    <label className="lr-field-label" htmlFor="lr-otp">Verification Code</label>
                    <p className="lr-otp-hint">Enter the 6-digit code sent to your 2FA destination. Codes expire in 5 minutes.</p>
                    <div className="lr-field-wrap">
                      <input id="lr-otp" type="text" className="lr-input lr-otp-input"
                        value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))}
                        placeholder="------" required autoFocus autoComplete="one-time-code"/>
                    </div>
                    <button type="button"
                      onClick={()=>{setRequires2FA(false);setOtp('');setChallengeId('')}}
                      style={{marginTop:10,border:0,background:'transparent',color:'#0e3e26',fontWeight:700,cursor:'pointer',fontSize:13,fontFamily:'DM Sans, sans-serif'}}>
                      ← Use different credentials
                    </button>
                  </div>
                </div>
              )}

              <button type="submit" className="lr-submit" disabled={loading}>
                {loading
                  ? <><SpinnerSVG />{requires2FA?'Verifying…':'Signing in…'}</>
                  : <><LockSVG />{requires2FA?'Verify & sign in':'Sign in to school portal'}&nbsp;&nbsp;<ArrowSVG /></>
                }
              </button>
            </form>

            <div className="lr-divider">or</div>
            <div className="lr-secondary">
              <Link to="/activate-account" className="lr-sec-link"><ActivateSVG />Parent / Student activation</Link>
              <Link to="/register" className="lr-sec-link-amber"><SetupSVG />First time setup</Link>
            </div>
            <div className="lr-badge"><ShieldSVG />Secured by 256-bit SSL encryption</div>
          </div>
        </main>

      </div>
    </>
  )
}
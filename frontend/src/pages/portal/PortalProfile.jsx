// frontend/src/pages/portal/PortalProfile.jsx
import { useState, useEffect } from 'react'
import { usePortalContext } from '../../layouts/portalContext'
import { portalAPI } from '../../services/api'
import { getAuthUser } from '../../services/auth'

const CHILD_COLORS = ['#0d7377','#7c3aed','#d97706','#dc2626','#16a34a']

function ProfileRow({ label, value }) {
  if (!value) return null
  return (
    <div style={{ padding:'11px 0', borderBottom:'1px solid #f0f7f7', display:'flex', gap:'12px', alignItems:'baseline' }}>
      <div style={{ fontSize:'10.5px', fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', minWidth:'100px', flexShrink:0 }}>
        {label}
      </div>
      <div style={{ fontSize:'14px', fontWeight:600, color:'#0f172a', flex:1, wordBreak:'break-word' }}>
        {value}
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ background:'white', borderRadius:'16px', padding:'14px 16px', marginBottom:'12px', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize:'10.5px', fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'4px' }}>{title}</div>
      {children}
    </div>
  )
}

function StudentProfileCard({ student, index, isActive, onClick }) {
  const color = CHILD_COLORS[index % CHILD_COLORS.length]
  const inits = (student.name_en || 'S').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
  return (
    <button
      onClick={onClick}
      style={{
        display:'flex', alignItems:'center', gap:'12px',
        padding:'12px 14px', borderRadius:'14px', width:'100%',
        border:`2px solid ${isActive ? color : '#f1f5f9'}`,
        background: isActive ? color + '0e' : '#fafafa',
        cursor:'pointer', textAlign:'left',
        fontFamily:'Nunito,sans-serif', transition:'all 0.15s',
        touchAction:'manipulation', marginBottom:'8px',
      }}
    >
      <div style={{ width:'42px', height:'42px', borderRadius:'11px', background:`linear-gradient(135deg,${color},${color}bb)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'15px', fontWeight:900, color:'white', flexShrink:0, boxShadow:`0 2px 8px ${color}44` }}>
        {inits}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'13.5px', fontWeight:800, color: isActive ? color : '#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{student.name_en}</div>
        <div style={{ fontSize:'11px', color:'#64748b', fontWeight:600, marginTop:'1px' }}>
          Std {student.class_id} · Roll {student.roll_number || '—'} · {student.student_id}
        </div>
      </div>
      {isActive && (
        <div style={{ width:'20px', height:'20px', borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="10" height="10" fill="none" stroke="white" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  )
}

export default function PortalProfile() {
  const { role, profile: ctxProfile, children, selectedChildId, setSelectedChildId } = usePortalContext()
  const isParent = role === 'parent'
  const authUser = getAuthUser()

  // For student: load own profile directly; for parent: use context profile (already loaded)
  const [ownProfile,  setOwnProfile]  = useState(null)
  const [loadingOwn,  setLoadingOwn]  = useState(!isParent)

  useEffect(() => {
    if (isParent) return
    portalAPI.getProfile()
      .then(r => { setOwnProfile(r.data); setLoadingOwn(false) })
      .catch(() => setLoadingOwn(false))
  }, [isParent])

  const profile  = isParent ? ctxProfile : ownProfile
  const loading  = isParent ? !ctxProfile : loadingOwn

  const fmtDate = (d) => {
    if (!d) return '—'
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' }) }
    catch { return d }
  }

  const activeChildIndex = isParent ? children.findIndex(c => c.id === selectedChildId) : -1
  const avatarColor = isParent && activeChildIndex >= 0
    ? CHILD_COLORS[activeChildIndex % CHILD_COLORS.length]
    : '#0d7377'
  const inits = (profile?.name_en || authUser?.name || 'S').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()

  return (
    <>
      <style>{`
        .portal-profile-layout { display: grid; gap: 12px; }
        .portal-profile-side,
        .portal-profile-main { display: grid; gap: 12px; align-content: start; }
        @media (min-width: 900px) {
          .portal-profile-layout {
            grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
            gap: 14px;
          }
          .portal-profile-side {
            position: sticky;
            top: 12px;
          }
        }
      `}</style>
      <div style={{ marginBottom:'14px' }}>
        <h2 style={{ fontSize:'18px', fontWeight:900, color:'#0f172a', letterSpacing:'-0.02em' }}>Profile</h2>
        <p style={{ fontSize:'12.5px', color:'#64748b', marginTop:'2px', fontWeight:600 }}>
          {isParent ? 'Read-only student records' : 'Read-only student record'}
        </p>
      </div>

      <div className="portal-profile-layout">
        <aside className="portal-profile-side">
          {/* Parent: linked children switcher at top of profile */}
          {isParent && children.length > 0 && (
            <Section title={`Linked Students — ${children.length} total`}>
              {children.map((c, i) => (
                <StudentProfileCard
                  key={c.id}
                  student={c}
                  index={i}
                  isActive={c.id === selectedChildId}
                  onClick={() => setSelectedChildId(c.id)}
                />
              ))}
            </Section>
          )}

          {/* Avatar card */}
          <div style={{ background:'white', borderRadius:'18px', padding:'22px 20px', textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
            {loading ? (
              <>
                <div style={{ width:'72px', height:'72px', borderRadius:'50%', background:'#f0f7f7', margin:'0 auto 12px' }} />
                <div style={{ height:'18px', width:'150px', margin:'0 auto 8px', borderRadius:'8px', background:'#f0f7f7' }} />
                <div style={{ height:'13px', width:'100px', margin:'0 auto', borderRadius:'6px', background:'#f0f7f7' }} />
              </>
            ) : (
              <>
                <div style={{ width:'70px', height:'70px', borderRadius:'50%', background:`linear-gradient(135deg,${avatarColor},${avatarColor}bb)`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px', fontSize:'24px', fontWeight:900, color:'white', boxShadow:`0 4px 16px ${avatarColor}44` }}>
                  {inits}
                </div>
                <div style={{ fontSize:'18px', fontWeight:900, color:'#0f172a', letterSpacing:'-0.02em' }}>{profile?.name_en || authUser?.name || '—'}</div>
                {profile?.name_gu && <div style={{ fontSize:'14px', color:'#64748b', marginTop:'2px', fontWeight:600 }}>{profile.name_gu}</div>}
                <div style={{ display:'flex', gap:'8px', justifyContent:'center', marginTop:'10px', flexWrap:'wrap' }}>
                  {profile?.student_id && (
                    <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'20px', background:'#f0f7f7', color:'#0d7377', fontFamily:'monospace' }}>
                      {profile.student_id}
                    </span>
                  )}
                  {profile?.status && (
                    <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'20px', background: profile.status === 'Active' ? '#dcfce7':'#f1f5f9', color: profile.status === 'Active' ? '#15803d':'#64748b' }}>
                      {profile.status}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Login info footer */}
          <div style={{ padding:'11px 14px', background:'#f0f7f7', borderRadius:'12px', fontSize:'12px', color:'#64748b', fontWeight:600, display:'flex', alignItems:'center', gap:'8px' }}>
            <svg width='14' height='14' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'/></svg>
            <span>
              Logged in as <strong style={{ color:'#0f172a' }}>{authUser?.name}</strong>
              &nbsp;·&nbsp;
              <span style={{ textTransform:'capitalize' }}>{authUser?.role}</span>
              {isParent && children.length > 0 && (
                <> · {children.length} student{children.length !== 1 ? 's':''} linked</>
              )}
            </span>
          </div>
        </aside>

        <section className="portal-profile-main">
          {/* Details */}
          {!loading && profile && (
            <>
              <Section title="Academic Details">
                <ProfileRow label="Class"      value={profile.class_id ? `Standard ${profile.class_id}` : null} />
                <ProfileRow label="Roll No."   value={profile.roll_number ? String(profile.roll_number) : null} />
                <ProfileRow label="GR Number"  value={profile.gr_number} />
                <ProfileRow label="Student ID" value={profile.student_id} />
                <ProfileRow label="Admission"  value={fmtDate(profile.admission_date)} />
              </Section>

              <Section title="Personal Details">
                <ProfileRow label="Date of Birth" value={fmtDate(profile.dob)} />
                <ProfileRow label="Gender"         value={profile.gender === 'M' ? 'Male' : profile.gender === 'F' ? 'Female' : profile.gender} />
                <ProfileRow label="Category"       value={profile.category} />
              </Section>

              <Section title="Family & Contact">
                <ProfileRow label="Father"   value={profile.father_name} />
                <ProfileRow label="Mother"   value={profile.mother_name} />
                <ProfileRow label="Contact"  value={profile.contact} />
                <ProfileRow label="Address"  value={profile.address} />
              </Section>
            </>
          )}
        </section>
      </div>
    </>
  )
}

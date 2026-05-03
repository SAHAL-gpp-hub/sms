// frontend/src/pages/portal/PortalProfile.jsx
import { useState, useEffect } from 'react'
import { portalAPI } from '../../services/api'
import { getAuthUser } from '../../services/auth'

function ProfileRow({ label, value }) {
  if (!value) return null
  return (
    <div style={{ padding: '11px 0', borderBottom: '1px solid #f0f7f7', display: 'flex', gap: '12px', alignItems: 'baseline' }}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: '110px', flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', flex: 1, wordBreak: 'break-word' }}>
        {value}
      </div>
    </div>
  )
}

export default function PortalProfile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const authUser = getAuthUser()

  useEffect(() => {
    portalAPI.getProfile()
      .then(r => { setProfile(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const fmtDate = (d) => {
    if (!d) return '—'
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) }
    catch { return d }
  }

  const initials = (profile?.name_en || authUser?.name || 'S').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <>
      <div style={{ marginBottom: '14px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>My Profile</h2>
        <p style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px', fontWeight: 600 }}>Read-only student record</p>
      </div>

      {/* Avatar card */}
      <div style={{
        background: 'white', borderRadius: '18px', padding: '24px 20px',
        textAlign: 'center', marginBottom: '12px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #0d7377, #14a085)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 12px',
          fontSize: '24px', fontWeight: 900, color: 'white',
          boxShadow: '0 4px 16px rgba(13,115,119,0.3)',
        }}>
          {initials}
        </div>

        {loading ? (
          <div>
            <div style={{ height: '20px', width: '150px', margin: '0 auto 8px', borderRadius: '8px', background: '#f0f7f7' }} />
            <div style={{ height: '14px', width: '100px', margin: '0 auto', borderRadius: '6px', background: '#f0f7f7' }} />
          </div>
        ) : (
          <>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
              {profile?.name_en || authUser?.name || '—'}
            </div>
            {profile?.name_gu && (
              <div style={{ fontSize: '14px', color: '#64748b', marginTop: '2px', fontWeight: 600 }}>
                {profile.name_gu}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
              {profile?.student_id && (
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: '#f0f7f7', color: '#0d7377', fontFamily: 'monospace' }}>
                  {profile.student_id}
                </span>
              )}
              {profile?.status && (
                <span style={{
                  fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                  background: profile.status === 'Active' ? '#dcfce7' : '#f1f5f9',
                  color: profile.status === 'Active' ? '#15803d' : '#64748b',
                }}>
                  {profile.status}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Details */}
      {!loading && profile && (
        <>
          <div style={{ background: 'white', borderRadius: '16px', padding: '14px 16px', marginBottom: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
              Academic Details
            </div>
            <ProfileRow label="Class" value={profile.class_id ? `Standard ${profile.class_id}` : null} />
            <ProfileRow label="Roll No." value={profile.roll_number ? String(profile.roll_number) : null} />
            <ProfileRow label="GR Number" value={profile.gr_number} />
            <ProfileRow label="Admission" value={fmtDate(profile.admission_date)} />
            <ProfileRow label="Acad. Year" value={profile.academic_year_id ? `Year ${profile.academic_year_id}` : null} />
          </div>

          <div style={{ background: 'white', borderRadius: '16px', padding: '14px 16px', marginBottom: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
              Personal Details
            </div>
            <ProfileRow label="Date of Birth" value={fmtDate(profile.dob)} />
            <ProfileRow label="Gender" value={profile.gender === 'M' ? 'Male' : profile.gender === 'F' ? 'Female' : profile.gender} />
            <ProfileRow label="Category" value={profile.category} />
          </div>

          <div style={{ background: 'white', borderRadius: '16px', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
              Family & Contact
            </div>
            <ProfileRow label="Father" value={profile.father_name} />
            <ProfileRow label="Mother" value={profile.mother_name} />
            <ProfileRow label="Contact" value={profile.contact} />
            <ProfileRow label="Address" value={profile.address} />
          </div>
        </>
      )}

      {/* Login info */}
      <div style={{
        marginTop: '12px', padding: '12px 16px',
        background: '#f0f7f7', borderRadius: '12px',
        fontSize: '12px', color: '#64748b', fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span>🔒</span>
        <span>Logged in as <strong>{authUser?.name}</strong> ({authUser?.role})</span>
      </div>
    </>
  )
}

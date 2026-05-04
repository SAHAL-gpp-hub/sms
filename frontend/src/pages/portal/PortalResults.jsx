// frontend/src/pages/portal/PortalResults.jsx
import { useState, useEffect } from 'react'
import { usePortalContext } from '../../layouts/PortalLayout'
import { portalAPI } from '../../services/api'

const GRADE_COLORS = {
  A1:'#15803d', A2:'#065f46', B1:'#1d4ed8', B2:'#4338ca',
  C1:'#d97706', C2:'#c2410c', D:'#b91c1c',  E:'#9f1239',
}
function GradePill({ grade }) {
  const color = GRADE_COLORS[grade] || '#64748b'
  return (
    <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', minWidth:'32px', height:'22px', padding:'0 6px', borderRadius:'6px', fontSize:'11.5px', fontWeight:800, background: color+'18', color }}>
      {grade}
    </span>
  )
}

function Shimmer() {
  return <div style={{ height:'80px', borderRadius:'16px', background:'linear-gradient(90deg,#f0f7f7 25%,#e0eded 50%,#f0f7f7 75%)', backgroundSize:'200% auto', animation:'portalShimmer 1.5s linear infinite', marginBottom:'10px' }} />
}

function ExamCard({ exam }) {
  const [expanded, setExpanded] = useState(false)
  const isPassed = exam.result === 'PASS'

  return (
    <div style={{ background:'white', borderRadius:'16px', overflow:'hidden', marginBottom:'10px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width:'100%', padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'none', border:'none', cursor:'pointer', fontFamily:'Nunito,sans-serif', touchAction:'manipulation' }}
      >
        <div style={{ textAlign:'left' }}>
          <div style={{ fontSize:'14px', fontWeight:800, color:'#0f172a' }}>{exam.name || `Exam ${exam.exam_id}`}</div>
          <div style={{ fontSize:'12px', color:'#64748b', marginTop:'2px', fontWeight:600 }}>
            {Math.round(exam.total_marks||0)}/{Math.round(exam.max_marks||0)} · {Number(exam.percentage||0).toFixed(1)}%
            {exam.exam_date ? ` · ${exam.exam_date}` : ''}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <span style={{ fontSize:'11px', fontWeight:800, padding:'3px 10px', borderRadius:'20px', background: isPassed ? '#dcfce7':'#fee2e2', color: isPassed ? '#15803d':'#b91c1c' }}>
            {exam.result}
          </span>
          <svg width="16" height="16" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" style={{ transform: expanded ? 'rotate(180deg)':'none', transition:'transform 0.2s', flexShrink:0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop:'1px solid #f0f7f7' }}>
          {/* Summary strip */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'6px', padding:'10px 14px' }}>
            {[
              { label:'CGPA',  value: exam.cgpa },
              { label:'Grade', value: exam.grade },
              { label:'Rank',  value: exam.class_rank ? `#${exam.class_rank}` : '—' },
            ].map(s => (
              <div key={s.label} style={{ background:'#f0f7f7', borderRadius:'8px', padding:'8px', textAlign:'center' }}>
                <div style={{ fontSize:'9.5px', fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.label}</div>
                <div style={{ fontSize:'15px', fontWeight:900, color:'#0d7377', marginTop:'1px' }}>{s.value}</div>
              </div>
            ))}
          </div>
          {/* Subject rows */}
          {(exam.subjects || []).map((sub, i) => {
            const total    = sub.total ?? ((sub.theory_marks != null) ? (sub.theory_marks + (sub.practical_marks||0)) : null)
            const maxTotal = (sub.max_theory||0) + (sub.max_practical||0)
            const pct      = total != null && maxTotal > 0 ? ((total / maxTotal) * 100).toFixed(0) : null
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 16px', borderBottom: i < exam.subjects.length-1 ? '1px solid #f0f7f7':'none' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'13px', fontWeight:700, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sub.subject_name}</div>
                  {pct != null && (
                    <div style={{ marginTop:'4px', height:'3px', background:'#e2e8f0', borderRadius:'2px', width:'80px' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:'#0d7377', borderRadius:'2px' }} />
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
                  <span style={{ fontSize:'13px', fontWeight:700, color:'#0f172a', fontFamily:'monospace' }}>
                    {total != null ? `${Math.round(total)}/${maxTotal}` : 'AB'}
                  </span>
                  <GradePill grade={sub.grade || 'AB'} />
                </div>
              </div>
            )
          })}
          {/* Marksheet link */}
          {exam.exam_id && (
            <div style={{ padding:'8px 14px 12px' }}>
              <a
                href={portalAPI.getMarksheet(exam.exam_id)}
                target="_blank" rel="noreferrer"
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'10px', borderRadius:'10px', background:'#0d737710', color:'#0d7377', fontWeight:700, fontSize:'13px', textDecoration:'none', border:'1px solid #0d737730' }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Marksheet PDF
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PortalResults() {
  const { role, selectedChildId } = usePortalContext()
  const isParent = role === 'parent'

  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    setLoading(true); setError(false); setResults([])
    const req = isParent && selectedChildId
      ? portalAPI.getChildResults(selectedChildId)
      : !isParent
        ? portalAPI.getResults()
        : null

    if (!req) { setLoading(false); return }

    req.then(r => { setResults(r.data || []); setLoading(false) })
       .catch(() => { setError(true); setLoading(false) })
  }, [isParent, selectedChildId])

  return (
    <>
      <style>{`@keyframes portalShimmer{0%{background-position:-200% center}100%{background-position:200% center}}`}</style>
      <div style={{ marginBottom:'14px' }}>
        <h2 style={{ fontSize:'18px', fontWeight:900, color:'#0f172a', letterSpacing:'-0.02em' }}>Results</h2>
        <p style={{ fontSize:'12.5px', color:'#64748b', marginTop:'2px', fontWeight:600 }}>
          {loading ? 'Loading…' : `${results.length} exam${results.length !== 1 ? 's':''} · tap to expand`}
        </p>
      </div>

      {loading && [1,2,3].map(i => <Shimmer key={i} />)}
      {error && (
        <div style={{ textAlign:'center', padding:'40px 20px', background:'white', borderRadius:'16px' }}>
          <div style={{ fontSize:'36px', marginBottom:'10px' }}>⚠️</div>
          <div style={{ fontWeight:700, color:'#0f172a' }}>Couldn't load results</div>
        </div>
      )}
      {!loading && !error && results.length === 0 && (
        <div style={{ textAlign:'center', padding:'40px 20px', background:'white', borderRadius:'16px' }}>
          <div style={{ fontSize:'36px', marginBottom:'10px' }}>📊</div>
          <div style={{ fontWeight:700, fontSize:'15px', color:'#0f172a' }}>No results yet</div>
          <div style={{ fontSize:'13px', color:'#64748b', marginTop:'4px' }}>Results appear once marks are entered</div>
        </div>
      )}
      {!loading && !error && results.map((exam, i) => <ExamCard key={i} exam={exam} />)}
    </>
  )
}
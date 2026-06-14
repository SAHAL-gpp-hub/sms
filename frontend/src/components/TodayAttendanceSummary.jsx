import { memo } from 'react'
import { PieChart, Pie, Cell } from 'recharts'

const COLORS = {
  present:    '#4ade80',
  absent:     '#f87171',
  not_marked: '#94a3b8',
}

const PILL_META = [
  { key: 'present',    label: 'Present',    color: COLORS.present },
  { key: 'absent',     label: 'Absent',     color: COLORS.absent },
  { key: 'not_marked', label: 'Not Marked', color: COLORS.not_marked },
]

function TodayAttendanceSummary({ present = 0, absent = 0, not_marked = 0, total = 0 }) {
  const noData = total === 0

  if (noData) {
    return (
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.46)', fontSize: 12.5, lineHeight: 1.5 }}>
          Attendance not<br />taken yet
        </div>
      </div>
    )
  }

  const pct = total > 0 ? Math.round((present / total) * 100) : 0

  const chartData = [
    { name: 'present',    value: present    || 0 },
    { name: 'absent',     value: absent     || 0 },
    { name: 'not_marked', value: not_marked || 0 },
  ].filter(d => d.value > 0)

  // If all segments are 0 somehow, show a placeholder
  if (chartData.length === 0) {
    chartData.push({ name: 'not_marked', value: 1 })
  }

  return (
    <div style={{ marginTop: 12 }}>
      {/* Donut chart + centered label */}
      <div style={{ position: 'relative', width: 160, height: 160, margin: '0 auto' }}>
        <PieChart width={160} height={160}>
          <Pie
            data={chartData}
            cx={80}
            cy={80}
            innerRadius={52}
            outerRadius={76}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
            isAnimationActive={false}
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={COLORS[entry.name] || COLORS.not_marked} />
            ))}
          </Pie>
        </PieChart>

        {/* Center label — absolute positioned */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{
            fontSize: 26,
            fontWeight: 850,
            lineHeight: 1,
            color: 'white',
            letterSpacing: '-0.04em',
          }}>
            {pct}%
          </span>
          <span style={{
            marginTop: 3,
            fontSize: 10,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.62)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            present today
          </span>
        </div>
      </div>

      {/* Pill rows */}
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {PILL_META.map(({ key, label, color }) => {
          const val = key === 'present' ? present : key === 'absent' ? absent : not_marked
          return (
            <div key={key} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)', fontWeight: 600 }}>
                  {label}
                </span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.88)' }}>
                {val}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default memo(TodayAttendanceSummary)

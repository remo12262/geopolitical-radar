import { useState, useEffect, useRef, useCallback } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8001'

// Country positions on radar: [angle_from_north_deg, radius_0_to_1]
const POSITIONS = {
  US: [268, 0.62], CA: [278, 0.52], BR: [295, 0.74], VE: [302, 0.72],
  UK: [348, 0.40], FR: [355, 0.38], DE: [8, 0.36], IT: [14, 0.44],
  ES: [350, 0.46], PL: [15, 0.40], UA: [22, 0.46], TR: [28, 0.52],
  RU: [42, 0.52], BY: [20, 0.44],
  IL: [32, 0.62], SA: [50, 0.68], IR: [58, 0.64], SY: [36, 0.62],
  YE: [55, 0.74], IQ: [45, 0.64], EG: [26, 0.66], LY: [18, 0.68],
  PK: [72, 0.68], IN: [82, 0.68], AF: [65, 0.72],
  CN: [95, 0.62], KP: [112, 0.56], KR: [116, 0.58], JP: [120, 0.60],
  TW: [118, 0.62], PH: [128, 0.72], MM: [105, 0.70],
  AU: [130, 0.82], NZ: [138, 0.88],
  NATO: [358, 0.22], EU: [6, 0.28], UN: [0, 0.14], MULTI: [0, 0.10],
}

const SEV_COLOR = { CRITICAL: '#ff2020', HIGH: '#ff7700', MEDIUM: '#ffcc00', LOW: '#00ff88' }
const SEV_RGBA = { CRITICAL: '255,32,32', HIGH: '255,119,0', MEDIUM: '255,204,0', LOW: '0,255,136' }

const TYPE_ICON = {
  PROCUREMENT: '🛡', EXERCISE: '⚔', POLICY: '📋', THREAT: '⚠',
  ALLIANCE: '🤝', SANCTIONS: '🚫', INCIDENT: '💥', INTELLIGENCE: '👁', DEPLOYMENT: '🚀',
}

function maxSeverity(cs) {
  if (!cs) return null
  if (cs.critical > 0) return 'CRITICAL'
  if (cs.high > 0) return 'HIGH'
  if (cs.count > 0) return 'MEDIUM'
  return null
}

function RadarCanvas({ countryStats }) {
  const canvasRef = useRef(null)
  const sweepRef = useRef(0)
  const rafRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    const cx = W / 2, cy = H / 2
    const maxR = W / 2 - 24

    const toXY = (angleDeg, radius) => {
      const r = (angleDeg - 90) * Math.PI / 180
      return { x: cx + maxR * radius * Math.cos(r), y: cy + maxR * radius * Math.sin(r) }
    }

    const draw = () => {
      ctx.fillStyle = '#030810'
      ctx.fillRect(0, 0, W, H)

      // Concentric rings
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath()
        ctx.arc(cx, cy, maxR * i / 4, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(0,180,80,${0.06 + i * 0.03})`
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Spokes
      ctx.strokeStyle = 'rgba(0,180,80,0.07)'
      ctx.lineWidth = 1
      for (let a = 0; a < 360; a += 30) {
        const rad = (a - 90) * Math.PI / 180
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + maxR * Math.cos(rad), cy + maxR * Math.sin(rad))
        ctx.stroke()
      }

      // Outer ring
      ctx.beginPath()
      ctx.arc(cx, cy, maxR, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(0,220,100,0.25)'
      ctx.lineWidth = 2
      ctx.stroke()

      // Sweep trail
      const sweep = sweepRef.current
      const sweepRad = (sweep - 90) * Math.PI / 180
      const trailWidth = Math.PI / 5
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, maxR, sweepRad - trailWidth, sweepRad)
      ctx.closePath()
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR)
      grad.addColorStop(0, 'rgba(0,255,100,0.0)')
      grad.addColorStop(0.6, 'rgba(0,255,100,0.04)')
      grad.addColorStop(1, 'rgba(0,255,100,0.14)')
      ctx.fillStyle = grad
      ctx.fill()
      ctx.restore()

      // Sweep line
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + maxR * Math.cos(sweepRad), cy + maxR * Math.sin(sweepRad))
      ctx.strokeStyle = 'rgba(0,255,100,0.75)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Country blips
      const stats = countryStats || {}
      Object.entries(POSITIONS).forEach(([code, [angle, radius]]) => {
        const { x, y } = toXY(angle, radius)
        const cs = stats[code]
        const sev = maxSeverity(cs)
        const rgba = sev ? SEV_RGBA[sev] : '0,150,255'
        const hex = sev ? SEV_COLOR[sev] : '#0066aa'
        const size = cs ? Math.min(3 + cs.count * 1.2, 10) : 2.5

        // Glow for active countries
        if (sev) {
          const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 4)
          glow.addColorStop(0, `rgba(${rgba},0.5)`)
          glow.addColorStop(1, `rgba(${rgba},0)`)
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(x, y, size * 4, 0, Math.PI * 2)
          ctx.fill()
        }

        // Dot
        ctx.beginPath()
        ctx.arc(x, y, size, 0, Math.PI * 2)
        ctx.fillStyle = sev ? hex : 'rgba(0,120,200,0.45)'
        ctx.fill()

        // Label
        ctx.fillStyle = sev ? `rgba(${rgba},0.9)` : 'rgba(160,200,220,0.55)'
        ctx.font = `${sev ? '9.5' : '8.5'}px monospace`
        ctx.fillText(code, x + size + 3, y + 3.5)
      })

      // Center
      ctx.beginPath()
      ctx.arc(cx, cy, 3, 0, Math.PI * 2)
      ctx.fillStyle = '#00ff88'
      ctx.fill()

      sweepRef.current = (sweep + 0.4) % 360
      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [countryStats])

  return (
    <canvas ref={canvasRef} width={480} height={480}
      style={{ borderRadius: '50%', boxShadow: '0 0 60px rgba(0,255,100,0.12), 0 0 120px rgba(0,255,100,0.05)' }} />
  )
}

export default function App() {
  const [radar, setRadar] = useState(null)
  const [events, setEvents] = useState([])
  const [alerts, setAlerts] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filterSev, setFilterSev] = useState(null)
  const [filterType, setFilterType] = useState(null)

  const fetchAll = useCallback(async () => {
    try {
      const [r, e, a, s] = await Promise.all([
        fetch(`${API}/api/radar`).then(x => x.json()),
        fetch(`${API}/api/events?limit=40`).then(x => x.json()),
        fetch(`${API}/api/alerts`).then(x => x.json()),
        fetch(`${API}/api/stats`).then(x => x.json()),
      ])
      setRadar(r); setEvents(e); setAlerts(a); setStats(s)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetch(`${API}/api/refresh`, { method: 'POST' }).catch(() => {})
    setTimeout(() => { fetchAll(); setRefreshing(false) }, 4000)
  }

  const filtered = events.filter(e =>
    (!filterSev || e.severity === filterSev) &&
    (!filterType || e.event_type === filterType)
  )

  if (loading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#030810' }}>
      <div style={{ color: '#00ff88', fontSize: 13, letterSpacing: 4 }}>INITIALIZING RADAR...</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#030810', color: '#c0d8e0', fontFamily: "'Courier New', monospace", overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderBottom: '1px solid #0a2a1a', background: '#04080f', flexShrink: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#00ff88', letterSpacing: 3 }}>⬡ GEOPOLITICAL RADAR</span>
        {stats && <>
          <Pill color="#ff2020">{stats.by_severity?.CRITICAL || 0} CRITICAL</Pill>
          <Pill color="#ff7700">{stats.by_severity?.HIGH || 0} HIGH</Pill>
          <Pill color="#0088cc">{stats.total || 0} EVENTS</Pill>
        </>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {stats?.last_refresh && (
            <span style={{ fontSize: 10, color: '#3a5a60' }}>
              SYNC {new Date(stats.last_refresh).toLocaleTimeString()}
            </span>
          )}
          <button onClick={handleRefresh} disabled={refreshing}
            style={{ padding: '3px 12px', background: '#001a0a', border: '1px solid #00ff8855', color: '#00ff88', borderRadius: 3, cursor: 'pointer', fontSize: 10, letterSpacing: 1 }}>
            {refreshing ? '⟳ SCANNING...' : '↻ REFRESH'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left — Alerts */}
        <div style={{ width: 230, borderRight: '1px solid #0a2a1a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SectionTitle>⚠ ALERTS ({alerts.length})</SectionTitle>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {alerts.length === 0
              ? <Empty>No active alerts</Empty>
              : alerts.map(a => (
                <div key={a.id} style={{ padding: '8px 10px', borderBottom: '1px solid #0a1520', borderLeft: `3px solid ${SEV_COLOR[a.severity] || '#333'}` }}>
                  <div style={{ fontSize: 9, color: SEV_COLOR[a.severity], marginBottom: 3, letterSpacing: 1 }}>
                    {a.severity} · {a.event_type}
                  </div>
                  <div style={{ fontSize: 10.5, lineHeight: 1.45 }}>{a.title_clean || a.title}</div>
                  <div style={{ fontSize: 9, color: '#3a5a60', marginTop: 3 }}>{(a.countries || []).slice(0, 4).join(' · ')}</div>
                </div>
              ))}
          </div>

          <SectionTitle>FILTERS</SectionTitle>
          <div style={{ padding: '6px 10px', borderBottom: '1px solid #0a2a1a' }}>
            <div style={{ fontSize: 9, color: '#3a5a60', marginBottom: 4, letterSpacing: 1 }}>SEVERITY</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sv => (
                <Chip key={sv} active={filterSev === sv} color={SEV_COLOR[sv]}
                  onClick={() => setFilterSev(filterSev === sv ? null : sv)}>{sv}</Chip>
              ))}
            </div>
          </div>
          <div style={{ padding: '6px 10px', borderBottom: '1px solid #0a2a1a' }}>
            <div style={{ fontSize: 9, color: '#3a5a60', marginBottom: 4, letterSpacing: 1 }}>TYPE</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {Object.entries(TYPE_ICON).map(([type, icon]) => (
                <Chip key={type} active={filterType === type}
                  onClick={() => setFilterType(filterType === type ? null : type)}>{icon}</Chip>
              ))}
            </div>
          </div>

          <SectionTitle>BY TYPE</SectionTitle>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {stats && Object.entries(stats.by_type || {}).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <div key={type} style={{ padding: '3px 10px', display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                <span style={{ color: '#8aaab0' }}>{TYPE_ICON[type] || '·'} {type}</span>
                <span style={{ color: '#00cc66' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Center — Radar */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <RadarCanvas countryStats={radar?.country_stats} />
        </div>

        {/* Right — Events */}
        <div style={{ width: 310, borderLeft: '1px solid #0a2a1a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SectionTitle>EVENTS ({filtered.length})</SectionTitle>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0
              ? <Empty>No events — click REFRESH to load</Empty>
              : filtered.map(e => (
                <div key={e.id} style={{ padding: '8px 10px', borderBottom: '1px solid #0a1520' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: SEV_COLOR[e.severity] || '#444', flexShrink: 0 }} />
                    <span style={{ fontSize: 9, color: '#4a6a70', letterSpacing: 1 }}>{e.event_type}</span>
                    <span style={{ fontSize: 9, color: '#3a5060', marginLeft: 'auto' }}>
                      {(e.countries || []).slice(0, 3).join(' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, lineHeight: 1.45, marginBottom: 4 }}>{e.title_clean || e.title}</div>
                  {e.summary_it && (
                    <div style={{ fontSize: 10, color: '#4a6a70', lineHeight: 1.4, marginBottom: 4 }}>{e.summary_it}</div>
                  )}
                  <div style={{ display: 'flex', gap: 8, fontSize: 9, color: '#2a4a50' }}>
                    <span>{e.source}</span>
                    {e.url && <a href={e.url} target="_blank" rel="noreferrer" style={{ color: '#006688', textDecoration: 'none' }}>→ source</a>}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Pill({ color, children }) {
  return (
    <span style={{ background: color + '18', border: `1px solid ${color}40`, color, borderRadius: 3, padding: '2px 8px', fontSize: 10, letterSpacing: 1 }}>
      {children}
    </span>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ padding: '6px 10px', fontSize: 9, letterSpacing: 2, color: '#00cc66', borderBottom: '1px solid #0a2a1a', flexShrink: 0 }}>
      {children}
    </div>
  )
}

function Chip({ active, color, onClick, children }) {
  return (
    <span onClick={onClick} style={{
      padding: '2px 7px', borderRadius: 10, fontSize: 9, cursor: 'pointer', letterSpacing: 0.5,
      border: `1px solid ${active ? (color || '#00ff88') : '#0a3020'}`,
      background: active ? (color || '#00ff88') + '22' : 'transparent',
      color: active ? (color || '#00ff88') : '#4a6a60',
    }}>{children}</span>
  )
}

function Empty({ children }) {
  return <div style={{ padding: 12, fontSize: 10, color: '#3a5a60' }}>{children}</div>
}

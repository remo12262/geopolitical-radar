import { useState, useEffect, useRef, useCallback } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8001'

function LoginGate({ children }) {
  const [authenticated, setAuthenticated] = useState(false)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`${API}/api/events?limit=1`, { credentials: 'include' })
      .then(r => {
        if (r.ok) setAuthenticated(true)
      })
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        const data = await res.json()
        localStorage.setItem('radar_token', data.token)
        setAuthenticated(true)
      } else {
        setError('Password errata')
      }
    } catch {
      setError('Errore di connessione')
    }
    setLoading(false)
  }

  if (checking) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0a1f3d' }}>
      <div style={{ color: '#4db8ff', fontSize: 16, fontWeight: 700, letterSpacing: 2 }}>VERIFICA ACCESSO...</div>
    </div>
  )

  if (authenticated) return children

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0a1f3d', fontFamily: 'system-ui, sans-serif' }}>
      <form onSubmit={handleLogin} style={{ background: '#0d2a4a', padding: '40px 36px', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.5)', minWidth: 320, textAlign: 'center', border: '1px solid #1e3a5f' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#4db8ff', marginBottom: 6, letterSpacing: 2 }}>⬡ GEOPOLITICAL RADAR</div>
        <div style={{ fontSize: 13, color: '#6688aa', marginBottom: 12 }}>Accesso riservato</div>
        <div style={{ fontSize: 12, color: '#88aacc', marginBottom: 28, lineHeight: 1.5 }}>Chiedere a <a href="mailto:info@quantumhorizon.it" style={{ color: '#4db8ff', textDecoration: 'none' }}>info@quantumhorizon.it</a> la pw di accesso gratuita</div>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          style={{ width: '100%', padding: '12px 16px', fontSize: 15, border: '2px solid #1e3a5f', borderRadius: 8, background: '#081828', color: '#ffffff', outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
        />
        {error && <div style={{ color: '#ff5555', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', fontSize: 15, fontWeight: 700, background: loading ? '#334' : '#1a6abf', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          {loading ? 'Accesso...' : 'Entra'}
        </button>
      </form>
    </div>
  )
}

const POSITIONS = {
  US: [268, 0.62], CA: [278, 0.52], BR: [295, 0.74], VE: [302, 0.72],
  UK: [348, 0.40], FR: [355, 0.38], DE: [8, 0.36], IT: [14, 0.44],
  ES: [350, 0.46], PL: [15, 0.40], UA: [22, 0.46], TR: [28, 0.52],
  RU: [42, 0.52], BY: [20, 0.44],
  IL: [32, 0.62], SA: [50, 0.68], IR: [58, 0.64], SY: [36, 0.62],
  YE: [55, 0.74], IQ: [45, 0.64], EG: [26, 0.66], LY: [18, 0.68],
  PK: [72, 0.68], IN: [82, 0.68], AF: [65, 0.72],
  CN: [95, 0.62], KP: [112, 0.56], KR: [116, 0.58], JP: [120, 0.60],
  TW: [118, 0.62], AU: [130, 0.82],
  NATO: [358, 0.22], EU: [6, 0.28], UN: [0, 0.14], MULTI: [0, 0.10],
}

const SEV = {
  CRITICAL: { color: '#cc0000', bg: '#fff0f0', border: '#cc000033', label: 'CRITICO' },
  HIGH:     { color: '#cc5500', bg: '#fff4ee', border: '#cc550033', label: 'ALTO' },
  MEDIUM:   { color: '#997700', bg: '#fffaee', border: '#99770033', label: 'MEDIO' },
  LOW:      { color: '#006633', bg: '#eefff6', border: '#00663333', label: 'BASSO' },
}

const TYPE_ICON = {
  PROCUREMENT: '🛡', EXERCISE: '⚔', POLICY: '📋', THREAT: '⚠',
  ALLIANCE: '🤝', SANCTIONS: '🚫', INCIDENT: '💥', INTELLIGENCE: '👁', DEPLOYMENT: '🚀',
}

function maxSev(cs) {
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
    const maxR = W / 2 - 20

    const toXY = (angleDeg, radius) => {
      const r = (angleDeg - 90) * Math.PI / 180
      return { x: cx + maxR * radius * Math.cos(r), y: cy + maxR * radius * Math.sin(r) }
    }

    const draw = () => {
      // Dark radar screen background
      ctx.fillStyle = '#0b1a2e'
      ctx.fillRect(0, 0, W, H)

      // Rings
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath()
        ctx.arc(cx, cy, maxR * i / 4, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(0,160,255,${0.08 + i * 0.04})`
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Spokes
      ctx.strokeStyle = 'rgba(0,160,255,0.08)'
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
      ctx.strokeStyle = 'rgba(0,180,255,0.35)'
      ctx.lineWidth = 2
      ctx.stroke()

      // Sweep
      const sweep = sweepRef.current
      const sweepRad = (sweep - 90) * Math.PI / 180
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, maxR, sweepRad - Math.PI / 5, sweepRad)
      ctx.closePath()
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR)
      grad.addColorStop(0, 'rgba(0,200,255,0.0)')
      grad.addColorStop(0.7, 'rgba(0,200,255,0.05)')
      grad.addColorStop(1, 'rgba(0,200,255,0.18)')
      ctx.fillStyle = grad
      ctx.fill()
      ctx.restore()

      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + maxR * Math.cos(sweepRad), cy + maxR * Math.sin(sweepRad))
      ctx.strokeStyle = 'rgba(0,220,255,0.9)'
      ctx.lineWidth = 2
      ctx.stroke()

      // Country blips
      const stats = countryStats || {}
      Object.entries(POSITIONS).forEach(([code, [angle, radius]]) => {
        const { x, y } = toXY(angle, radius)
        const cs = stats[code]
        const sev = maxSev(cs)
        const cfg = sev ? SEV[sev] : null
        const dotColor = cfg ? cfg.color : '#336699'
        const size = cs ? Math.min(4 + cs.count * 1.5, 13) : 3.5

        if (sev && sev !== 'LOW') {
          const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 5)
          glow.addColorStop(0, dotColor + 'aa')
          glow.addColorStop(1, dotColor + '00')
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(x, y, size * 5, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(x, y, size, 0, Math.PI * 2)
        ctx.fillStyle = dotColor
        ctx.fill()

        ctx.fillStyle = sev ? '#ffffff' : 'rgba(180,210,255,0.7)'
        ctx.font = `bold ${sev ? '10' : '9'}px monospace`
        ctx.fillText(code, x + size + 3, y + 4)
      })

      // Center
      ctx.beginPath()
      ctx.arc(cx, cy, 4, 0, Math.PI * 2)
      ctx.fillStyle = '#00ccff'
      ctx.fill()

      sweepRef.current = (sweep + 0.4) % 360
      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [countryStats])

  return (
    <canvas ref={canvasRef} width={460} height={460}
      style={{ borderRadius: '50%', boxShadow: '0 0 0 6px #1e3a5f, 0 8px 40px rgba(0,100,200,0.4)' }} />
  )
}

export default function AppWithAuth() {
  return <LoginGate><App /></LoginGate>
}

function App() {
  const [radar, setRadar] = useState(null)
  const [events, setEvents] = useState([])
  const [alerts, setAlerts] = useState([])
  const [stats, setStats] = useState(null)
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filterSev, setFilterSev] = useState(null)
  const [filterType, setFilterType] = useState(null)

  const authFetch = useCallback((url) => {
    const token = localStorage.getItem('radar_token')
    const opts = { credentials: 'include' }
    if (token) opts.headers = { Authorization: `Bearer ${token}` }
    return fetch(url, opts).then(r => {
      if (r.status === 401) window.location.reload()
      return r.json()
    })
  }, [])

  const fetchAll = useCallback(async () => {
    try {
      const [r, e, a, s, p] = await Promise.all([
        authFetch(`${API}/api/radar`),
        authFetch(`${API}/api/events?limit=40`),
        authFetch(`${API}/api/alerts`),
        authFetch(`${API}/api/stats`),
        authFetch(`${API}/api/predictions`),
      ])
      setRadar(r)
      setEvents(Array.isArray(e) ? e : [])
      setAlerts(Array.isArray(a) ? a : [])
      setStats(s)
      setPredictions(Array.isArray(p) ? p : [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [authFetch])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleRefresh = async () => {
    setRefreshing(true)
    const token = localStorage.getItem('radar_token')
    const opts = { method: 'POST', credentials: 'include' }
    if (token) opts.headers = { Authorization: `Bearer ${token}` }
    await fetch(`${API}/api/refresh`, opts).catch(() => {})
    setTimeout(() => { fetchAll(); setRefreshing(false) }, 4000)
  }

  const filtered = events.filter(e =>
    (!filterSev || e.severity === filterSev) &&
    (!filterType || e.event_type === filterType)
  )

  if (loading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f0f4f8', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 48, height: 48, border: '4px solid #0066cc', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <div style={{ color: '#0a2a5a', fontSize: 18, fontWeight: 700, letterSpacing: 2 }}>CARICAMENTO RADAR...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#eef2f8', fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: '#0a1f3d', color: '#ffffff', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.3)', flexShrink: 0 }}>
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, color: '#4db8ff' }}>⬡</span>
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1 }}>GEOPOLITICAL RADAR</span>
        <div style={{ width: 1, height: 28, background: '#ffffff22', margin: '0 4px' }} />
        {stats && <>
          <StatBadge bg="#cc0000" label="CRITICO" value={stats.by_severity?.CRITICAL || 0} />
          <StatBadge bg="#cc5500" label="ALTO" value={stats.by_severity?.HIGH || 0} />
          <StatBadge bg="#0055aa" label="EVENTI" value={stats.total || 0} />
        </>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          {stats?.last_refresh && (
            <span style={{ fontSize: 12, color: '#aaccee' }}>
              Aggiornato: {new Date(stats.last_refresh).toLocaleTimeString('it-IT')}
            </span>
          )}
          <button onClick={handleRefresh} disabled={refreshing} style={{
            padding: '7px 18px', background: refreshing ? '#334' : '#1a6abf', color: '#fff',
            border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
          }}>
            {refreshing ? '⟳ Scansione...' : '↻ Aggiorna'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: 0 }}>

        {/* Left panel */}
        <div style={{ width: 250, background: '#ffffff', borderRight: '2px solid #d0dce8', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '2px 0 8px rgba(0,0,0,0.06)' }}>

          <PanelTitle icon="⚠️" title={`ALERT ATTIVI (${alerts.length})`} bg="#cc0000" />
          <div style={{ flex: '0 0 auto', maxHeight: '38%', overflowY: 'auto' }}>
            {alerts.length === 0
              ? <EmptyMsg>Nessun alert attivo</EmptyMsg>
              : alerts.map(a => {
                const sc = SEV[a.severity] || SEV.LOW
                return (
                  <div key={a.id} style={{ padding: '10px 12px', borderBottom: '1px solid #e8eef4', borderLeft: `4px solid ${sc.color}`, background: sc.bg }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: sc.color, background: sc.border, padding: '1px 6px', borderRadius: 3 }}>{sc.label}</span>
                      <span style={{ fontSize: 11, color: '#556', fontWeight: 500 }}>{a.event_type}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0a1628', lineHeight: 1.4 }}>{a.title_clean || a.title}</div>
                    <div style={{ fontSize: 11, color: '#667788', marginTop: 3 }}>{(a.countries || []).slice(0, 4).join(' · ')}</div>
                  </div>
                )
              })}
          </div>

          <PanelTitle icon="🔍" title="FILTRI" bg="#334466" />
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #d0dce8' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#445566', marginBottom: 6, letterSpacing: 1 }}>GRAVITÀ</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {Object.entries(SEV).map(([key, cfg]) => (
                <button key={key} onClick={() => setFilterSev(filterSev === key ? null : key)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
                  background: filterSev === key ? cfg.bg : 'transparent',
                  border: `2px solid ${filterSev === key ? cfg.color : '#d0dce8'}`,
                  borderRadius: 6, cursor: 'pointer', textAlign: 'left'
                }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: filterSev === key ? 700 : 500, color: filterSev === key ? cfg.color : '#334' }}>{cfg.label}</span>
                </button>
              ))}
            </div>
          </div>

          <PanelTitle icon="📊" title="PER TIPO" bg="#334466" />
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {stats && Object.entries(stats.by_type || {}).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <button key={type} onClick={() => setFilterType(filterType === type ? null : type)} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', padding: '7px 14px', border: 'none', textAlign: 'left',
                background: filterType === type ? '#e8f0ff' : 'transparent',
                borderLeft: filterType === type ? '3px solid #0066cc' : '3px solid transparent',
                cursor: 'pointer'
              }}>
                <span style={{ fontSize: 13, color: '#223', fontWeight: 500 }}>{TYPE_ICON[type] || '·'} {type}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0066cc', background: '#e0ecff', padding: '1px 8px', borderRadius: 10 }}>{count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Center — Radar + Predictions */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#dde6f0', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <RadarCanvas countryStats={radar?.country_stats} />
              <div style={{ display: 'flex', gap: 20 }}>
                {Object.entries(SEV).map(([key, cfg]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#334455' }}>{cfg.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <PredictionsPanel predictions={predictions} />
        </div>

        {/* Right panel — Events */}
        <div style={{ width: 360, background: '#ffffff', borderLeft: '2px solid #d0dce8', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '-2px 0 8px rgba(0,0,0,0.06)' }}>
          <PanelTitle icon="📡" title={`EVENTI RILEVATI (${filtered.length})`} bg="#0055aa" />
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0
              ? <EmptyMsg>Nessun evento — clicca Aggiorna per caricare</EmptyMsg>
              : filtered.map(e => {
                const sc = SEV[e.severity] || SEV.LOW
                return (
                  <div key={e.id} style={{ padding: '12px 14px', borderBottom: '1px solid #e8eef4', borderLeft: `4px solid ${sc.color}`, background: '#ffffff' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: sc.color, background: sc.bg, border: `1px solid ${sc.border}`, padding: '1px 7px', borderRadius: 3 }}>
                        {sc.label}
                      </span>
                      <span style={{ fontSize: 11, color: '#667', fontWeight: 600 }}>{TYPE_ICON[e.event_type]} {e.event_type}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: '#445566', fontWeight: 600 }}>
                        {(e.countries || []).slice(0, 3).join(' · ')}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0a1628', lineHeight: 1.45, marginBottom: 6 }}>
                      {e.title_clean || e.title}
                    </div>
                    {e.summary_it && (
                      <div style={{ fontSize: 12, color: '#445', lineHeight: 1.55, marginBottom: 6 }}>{e.summary_it}</div>
                    )}
                    <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#889' }}>
                      <span>{e.source}</span>
                      {e.url && <a href={e.url} target="_blank" rel="noreferrer" style={{ color: '#0066cc', fontWeight: 600, textDecoration: 'none' }}>→ Fonte</a>}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    </div>
  )
}

function probColor(val) {
  if (val >= 75) return '#cc0000'
  if (val >= 50) return '#cc5500'
  if (val >= 30) return '#997700'
  return '#226644'
}

function trendIcon(trend) {
  if (trend === 'escalating') return '▲'
  if (trend === 'declining') return '▼'
  return '●'
}

function trendColor(trend) {
  if (trend === 'escalating') return '#ff4444'
  if (trend === 'declining') return '#44cc66'
  return '#6688aa'
}

function PredictionsPanel({ predictions }) {
  if (!predictions || predictions.length === 0) return null

  const bars = [
    { key: 'prob_72h', label: '72H' },
    { key: 'prob_7d',  label: ' 7G' },
    { key: 'prob_30d', label: '30G' },
  ]

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#0b1a2e', borderTop: '2px solid #1e3a5f' }}>
      <div style={{
        padding: '8px 16px', background: '#0d2240', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid #1e3a5f', flexShrink: 0
      }}>
        <span style={{ color: '#ff6644', fontSize: 14 }}>🎯</span>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: '#4db8ff' }}>PREVISIONI ESCALATION</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#4a6a8a' }}>{predictions.length} hotspot</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {predictions.map((h, i) => (
          <div key={h.country} style={{
            padding: '10px 16px', borderBottom: '1px solid #152a45',
            background: i % 2 === 0 ? '#0c1e36' : '#0b1a2e'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', fontFamily: 'monospace' }}>{h.country}</span>
              <span style={{ fontSize: 11, color: '#5588aa' }}>{h.region}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: trendColor(h.trend), fontWeight: 700 }}>
                {trendIcon(h.trend)} {h.trend === 'escalating' ? 'IN SALITA' : h.trend === 'declining' ? 'IN CALO' : 'STABILE'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#8899aa', marginBottom: 8, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {h.top_event}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {bars.map(({ key, label }) => {
                const val = h[key] || 0
                const col = probColor(val)
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#5588aa', fontFamily: 'monospace', width: 28, flexShrink: 0 }}>{label}</span>
                    <div style={{ flex: 1, height: 14, background: '#152a45', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        width: `${val}%`, height: '100%', borderRadius: 3,
                        background: `linear-gradient(90deg, ${col}88, ${col})`,
                        boxShadow: val >= 60 ? `0 0 8px ${col}66` : 'none',
                        transition: 'width 0.6s ease'
                      }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: col, fontFamily: 'monospace', width: 32, textAlign: 'right', flexShrink: 0 }}>{val}%</span>
                  </div>
                )
              })}
            </div>
            {h.factors && h.factors.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {h.factors.map((f, fi) => (
                  <span key={fi} style={{ fontSize: 10, color: '#6688aa', background: '#152a45', padding: '2px 8px', borderRadius: 10, border: '1px solid #1e3a5f' }}>{f}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StatBadge({ bg, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: bg + 'cc', padding: '4px 12px', borderRadius: 6 }}>
      <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 10, color: '#ffdddd', fontWeight: 700, letterSpacing: 1 }}>{label}</span>
    </div>
  )
}

function PanelTitle({ icon, title, bg }) {
  return (
    <div style={{ padding: '8px 12px', background: bg, color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      {icon} {title}
    </div>
  )
}

function EmptyMsg({ children }) {
  return <div style={{ padding: 16, fontSize: 13, color: '#778899', textAlign: 'center' }}>{children}</div>
}

export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>🔥 tokenburn dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0d1117;
      color: #c9d1d9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
      min-height: 100vh;
      padding: 24px;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 12px;
    }
    h1 { font-size: 1.5rem; color: #f0883e; }
    .refresh-info { font-size: 0.75rem; color: #8b949e; }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }
    @media (max-width: 700px) {
      .grid { grid-template-columns: 1fr; }
    }
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 10px;
      padding: 20px;
    }
    .card h2 {
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #8b949e;
      margin-bottom: 16px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
    }
    .stat { display: flex; flex-direction: column; gap: 4px; }
    .stat-value { font-size: 1.6rem; font-weight: 700; color: #f0883e; }
    .stat-label { font-size: 0.75rem; color: #8b949e; }
    .chart-wrap { position: relative; height: 220px; }
    .waste-list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
    .waste-item {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 10px 14px;
    }
    .waste-item .rule-name { font-size: 0.8rem; font-weight: 600; margin-bottom: 2px; }
    .waste-item .rule-msg { font-size: 0.75rem; color: #8b949e; }
    .severity-high { border-left: 3px solid #f85149; }
    .severity-medium { border-left: 3px solid #d29922; }
    .severity-low { border-left: 3px solid #3fb950; }
    .severity-info { border-left: 3px solid #58a6ff; }
    .empty { color: #8b949e; font-size: 0.85rem; }
    .error { color: #f85149; font-size: 0.8rem; }
  </style>
</head>
<body>
  <header>
    <h1>🔥 tokenburn</h1>
    <span class="refresh-info" id="refresh-info">Loading...</span>
  </header>
  <div class="grid">
    <div class="card" id="card-overview">
      <h2>Overview (7d)</h2>
      <div class="stats-grid" id="overview-stats">
        <div class="stat"><span class="stat-value" id="stat-cost">—</span><span class="stat-label">Total Cost</span></div>
        <div class="stat"><span class="stat-value" id="stat-requests">—</span><span class="stat-label">Requests</span></div>
        <div class="stat"><span class="stat-value" id="stat-input">—</span><span class="stat-label">Input Tokens</span></div>
        <div class="stat"><span class="stat-value" id="stat-output">—</span><span class="stat-label">Output Tokens</span></div>
      </div>
    </div>
    <div class="card">
      <h2>Cost by Model (7d)</h2>
      <div class="chart-wrap"><canvas id="chart-models"></canvas></div>
    </div>
    <div class="card">
      <h2>Daily Spending (30d)</h2>
      <div class="chart-wrap"><canvas id="chart-daily"></canvas></div>
    </div>
    <div class="card">
      <h2>Waste Detection (7d)</h2>
      <ul class="waste-list" id="waste-list"><li class="empty">Loading...</li></ul>
    </div>
  </div>

  <script>
    const PALETTE = ['#f0883e','#58a6ff','#3fb950','#d29922','#f85149','#bc8cff','#39d353','#ffa657']

    let modelChart = null
    let dailyChart = null

    function fmt(n) {
      if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
      if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
      return String(n)
    }

    async function fetchJSON(url) {
      const r = await fetch(url)
      if (!r.ok) throw new Error(r.statusText)
      return r.json()
    }

    async function loadAll() {
      try {
        const [summary, models, daily, waste] = await Promise.all([
          fetchJSON('/api/summary?period=7d'),
          fetchJSON('/api/models?period=7d'),
          fetchJSON('/api/daily?period=30d'),
          fetchJSON('/api/waste?period=7d'),
        ])

        // Overview
        document.getElementById('stat-cost').textContent = '$' + (summary.totalCost ?? 0).toFixed(2)
        document.getElementById('stat-requests').textContent = fmt(summary.totalRequests ?? 0)
        document.getElementById('stat-input').textContent = fmt(summary.totalInputTokens ?? 0)
        document.getElementById('stat-output').textContent = fmt(summary.totalOutputTokens ?? 0)

        // Model chart
        const modelLabels = models.map(m => m.model)
        const modelData = models.map(m => parseFloat((m.totalCost ?? 0).toFixed(4)))
        if (modelChart) modelChart.destroy()
        const mCtx = document.getElementById('chart-models').getContext('2d')
        modelChart = new Chart(mCtx, {
          type: 'doughnut',
          data: {
            labels: modelLabels,
            datasets: [{ data: modelData, backgroundColor: PALETTE, borderColor: '#161b22', borderWidth: 2 }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { position: 'right', labels: { color: '#c9d1d9', font: { size: 11 }, boxWidth: 14 } },
              tooltip: { callbacks: { label: ctx => ' $' + ctx.parsed.toFixed(4) } }
            }
          }
        })

        // Daily chart
        const dayLabels = daily.map(d => d.day)
        const dayData = daily.map(d => parseFloat((d.totalCost ?? 0).toFixed(4)))
        if (dailyChart) dailyChart.destroy()
        const dCtx = document.getElementById('chart-daily').getContext('2d')
        dailyChart = new Chart(dCtx, {
          type: 'bar',
          data: {
            labels: dayLabels,
            datasets: [{ label: 'Cost (USD)', data: dayData, backgroundColor: '#f0883e99', borderColor: '#f0883e', borderWidth: 1 }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
              x: { ticks: { color: '#8b949e', maxRotation: 45, font: { size: 10 } }, grid: { color: '#21262d' } },
              y: { ticks: { color: '#8b949e', callback: v => '$' + v.toFixed(2) }, grid: { color: '#21262d' } }
            },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' $' + ctx.parsed.y.toFixed(4) } } }
          }
        })

        // Waste list
        const wl = document.getElementById('waste-list')
        if (!waste || waste.length === 0) {
          wl.innerHTML = '<li class="empty">No waste patterns detected.</li>'
        } else {
          wl.innerHTML = waste.map(w => \`
            <li class="waste-item severity-\${w.severity}">
              <div class="rule-name">\${w.rule} — <strong>$\${(w.wastedUSD ?? 0).toFixed(2)}</strong> wasted</div>
              <div class="rule-msg">\${w.message}</div>
            </li>
          \`).join('')
        }

        document.getElementById('refresh-info').textContent = 'Last updated: ' + new Date().toLocaleTimeString() + ' (auto-refresh 30s)'
      } catch (err) {
        document.getElementById('refresh-info').textContent = 'Error: ' + err.message
      }
    }

    loadAll()
    setInterval(loadAll, 30000)
  </script>
</body>
</html>`

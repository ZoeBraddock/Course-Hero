'use client'

import { useState, useEffect } from 'react'

type Band = { min: number; max: number | null; reference: number }

const DEFAULT_BANDS: Band[] = [
  { min: 0, max: 100, reference: 50 },
  { min: 100, max: 400, reference: 349 },
  { min: 400, max: 800, reference: 698 },
  { min: 800, max: 1200, reference: 1050 },
]

export default function TariffShippingPage() {
  const [shop, setShop] = useState('')
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tariffRate, setTariffRate] = useState(0.19)
  const [baseCost, setBaseCost] = useState(15)
  const [bands, setBands] = useState<Band[]>(DEFAULT_BANDS)
  const [dhlRate, setDhlRate] = useState(20)
  const [dhlNote, setDhlNote] = useState('Customs duties may be charged on delivery')
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shopParam = params.get('shop')
    if (shopParam) {
      setShop(shopParam)
      loadSettings(shopParam)
    }
  }, [])

  async function loadSettings(shopDomain: string) {
    setLoading(true)
    const res = await fetch(`/api/shopify/settings?shop=${shopDomain}`)
    const data = await res.json()
    setLoading(false)

    if (data.connected) {
      setConnected(true)
      const s = data.settings
      if (s.tariff_rate) setTariffRate(s.tariff_rate)
      if (s.base_cost) setBaseCost(s.base_cost)
      if (s.bands && s.bands.length > 0) setBands(s.bands)
      if (s.dhl_flat_rate) setDhlRate(s.dhl_flat_rate)
      if (s.dhl_note) setDhlNote(s.dhl_note)
      setLastSynced(s.last_synced_at)
    } else {
      setConnected(false)
    }
  }

  function handleConnect() {
    if (!shop) return
    window.location.href = `/api/shopify/auth?shop=${shop}`
  }

  function calculateBandRates() {
    return bands.map((b) => {
      const raw = baseCost + tariffRate * b.reference
      const rate = Math.ceil(raw)
      return { ...b, rate }
    })
  }

  async function handleSave() {
    setLoading(true)
    setMessage('')
    const res = await fetch('/api/shopify/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop,
        tariff_rate: tariffRate,
        base_cost: baseCost,
        bands,
        dhl_flat_rate: dhlRate,
        dhl_note: dhlNote,
      }),
    })
    const data = await res.json()
    setLoading(false)
    setMessage(data.success ? 'Saved.' : `Error: ${data.error}`)
  }

  async function handleSync() {
    setLoading(true)
    setMessage('')
    const res = await fetch('/api/shopify/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.success) {
      setMessage('Synced to Shopify.')
      setLastSynced(new Date().toISOString())
    } else {
      setMessage(`Sync error: ${data.error}`)
    }
  }

  const calculated = calculateBandRates()

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Tariff Shipping Sync</h1>

      {!shop && (
        <div>
          <p>Enter your shop domain to connect or load settings:</p>
          <input
            type="text"
            placeholder="yourstore.myshopify.com"
            value={shop}
            onChange={(e) => setShop(e.target.value)}
            style={{ width: '100%', padding: 8 }}
          />
          <button onClick={handleConnect} style={{ marginTop: 8 }}>
            Connect store
          </button>
        </div>
      )}

      {shop && !connected && !loading && (
        <div>
          <p>Shop: {shop}</p>
          <p>Not connected yet.</p>
          <button onClick={handleConnect}>Connect store</button>
        </div>
      )}

      {connected && (
        <div>
          <p>Connected: <strong>{shop}</strong></p>
          {lastSynced && <p>Last synced: {new Date(lastSynced).toLocaleString()}</p>}

          <h2>Tariff settings</h2>
          <label>
            Tariff rate (%):{' '}
            <input
              type="number"
              step="0.01"
              value={tariffRate * 100}
              onChange={(e) => setTariffRate(Number(e.target.value) / 100)}
            />
          </label>
          <br />
          <label>
            Base Aramex shipping cost ($):{' '}
            <input
              type="number"
              step="0.01"
              value={baseCost}
              onChange={(e) => setBaseCost(Number(e.target.value))}
            />
          </label>

          <h2>Price bands (Aramex)</h2>
          {bands.map((b, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <input
                type="number"
                value={b.min}
                onChange={(e) => {
                  const newBands = [...bands]
                  newBands[i].min = Number(e.target.value)
                  setBands(newBands)
                }}
                style={{ width: 80 }}
              />
              {' to '}
              <input
                type="number"
                value={b.max ?? ''}
                placeholder="unbounded"
                onChange={(e) => {
                  const newBands = [...bands]
                  newBands[i].max = e.target.value ? Number(e.target.value) : null
                  setBands(newBands)
                }}
                style={{ width: 80 }}
              />
              {' | duty calculated on $'}
              <input
                type="number"
                value={b.reference}
                onChange={(e) => {
                  const newBands = [...bands]
                  newBands[i].reference = Number(e.target.value)
                  setBands(newBands)
                }}
                style={{ width: 80 }}
              />
            </div>
          ))}

          <h2>DHL</h2>
          <label>
            Flat rate ($):{' '}
            <input
              type="number"
              step="0.01"
              value={dhlRate}
              onChange={(e) => setDhlRate(Number(e.target.value))}
            />
          </label>
          <br />
          <label>
            Note:{' '}
            <input
              type="text"
              value={dhlNote}
              onChange={(e) => setDhlNote(e.target.value)}
              style={{ width: '100%' }}
            />
          </label>

          <h2>Preview</h2>
          <table border={1} cellPadding={6}>
            <thead>
              <tr>
                <th>Band</th>
                <th>Reference price</th>
                <th>Aramex rate</th>
              </tr>
            </thead>
            <tbody>
              {calculated.map((b, i) => (
                <tr key={i}>
                  <td>${b.min} - {b.max ?? 'and up'}</td>
                  <td>${b.reference}</td>
                  <td>${b.rate}</td>
                </tr>
              ))}
              <tr>
                <td>DHL (flat)</td>
                <td>-</td>
                <td>${dhlRate}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 16 }}>
            <button onClick={handleSave} disabled={loading}>Save</button>{' '}
            <button onClick={handleSync} disabled={loading}>Sync to Shopify</button>
          </div>

          {message && <p>{message}</p>}
        </div>
      )}
    </div>
  )
}
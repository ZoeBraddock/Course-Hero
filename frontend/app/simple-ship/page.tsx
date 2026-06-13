'use client'

import { useState, useEffect } from 'react'

type Band = { min: number; max: number | null; reference: number }

const DEFAULT_BANDS: Band[] = [
  { min: 0, max: 100, reference: 50 },
  { min: 100, max: 400, reference: 349 },
  { min: 400, max: 800, reference: 698 },
  { min: 800, max: 1200, reference: 1050 },
]

const inputClass =
  'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

export default function SimpleShipPage() {
  const [shop, setShop] = useState('')
  const [connected, setConnected] = useState(false)
  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tariffRate, setTariffRate] = useState(0.19)
  const [baseCost, setBaseCost] = useState(15)
  const [bands, setBands] = useState<Band[]>(DEFAULT_BANDS)
  const [dhlRate, setDhlRate] = useState(20)
  const [dhlNote, setDhlNote] = useState('Customs duties may be charged on delivery')
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const shopParam = new URLSearchParams(window.location.search).get('shop')
    if (shopParam) {
      setShop(shopParam)
      loadSettings(shopParam)
    } else {
      setChecked(true)
    }
  }, [])

  async function loadSettings(shopDomain: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/shopify/settings?shop=${shopDomain}`)
      const data = await res.json()
      if (data.connected) {
        setConnected(true)
        const s = data.settings
        if (s.tariff_rate) setTariffRate(s.tariff_rate)
        if (s.base_cost) setBaseCost(s.base_cost)
        if (s.bands?.length) setBands(s.bands)
        if (s.dhl_flat_rate) setDhlRate(s.dhl_flat_rate)
        if (s.dhl_note) setDhlNote(s.dhl_note)
        setLastSynced(s.last_synced_at)
      }
    } finally {
      setLoading(false)
      setChecked(true)
    }
  }

  function handleConnect() {
    if (shop) window.location.href = `/api/shopify/auth?shop=${shop}`
  }

  function updateBand(i: number, field: keyof Band, value: number | null) {
    const next = [...bands]
    next[i] = { ...next[i], [field]: value }
    setBands(next)
  }

  const calculated = bands.map((b) => ({
    ...b,
    rate: Math.ceil(baseCost + tariffRate * b.reference),
  }))

  async function handleSave() {
    setLoading(true)
    setMessage('')
    try {
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
      setMessage(data.success ? 'Settings saved.' : `Couldn't save: ${data.error}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleSync() {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/shopify/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage('Shipping rates updated in your store.')
        setLastSynced(new Date().toISOString())
      } else {
        setMessage(`Sync failed: ${data.error}`)
      }
    } finally {
      setLoading(false)
    }
  }

  if (!checked) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </main>
    )
  }

  if (!connected) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-8">
        <div className="w-full max-w-md bg-gray-900 rounded-2xl p-8 border border-gray-800">
          <h1 className="text-2xl font-bold mb-1">Simple Ship</h1>
          <p className="text-gray-400 text-sm mb-6">
            Connect your Shopify store to set up duty-inclusive shipping rates.
          </p>

          <label className="block text-sm text-gray-300 mb-1">Store domain</label>
          <input
            type="text"
            placeholder="yourstore.myshopify.com"
            value={shop}
            onChange={(e) => setShop(e.target.value)}
            className={inputClass}
          />

          <button
            onClick={handleConnect}
            disabled={!shop}
            className="mt-4 w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 transition"
          >
            Connect store
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white px-8 py-16">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Simple Ship</h1>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="inline-flex items-center gap-1.5 text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Connected
            </span>
            <span>·</span>
            <span>{shop}</span>
          </div>
          {lastSynced && (
            <p className="text-xs text-gray-500 mt-1">
              Last synced: {new Date(lastSynced).toLocaleString()}
            </p>
          )}
        </div>

        <section className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-1">Tariff settings</h2>
          <p className="text-gray-400 text-sm mb-4">
            Update these whenever the tariff rate or shipping cost changes.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Tariff rate (%)</label>
              <input
                type="number"
                step="0.01"
                value={tariffRate * 100}
                onChange={(e) => setTariffRate(Number(e.target.value) / 100)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Base Aramex cost ($)</label>
              <input
                type="number"
                step="0.01"
                value={baseCost}
                onChange={(e) => setBaseCost(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>
        </section>

        <section className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-1">Aramex price bands</h2>
          <p className="text-gray-400 text-sm mb-4">
            Each band gets a flat rate with the tariff already included, based on the reference order value.
          </p>

          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1 mb-2">
            <div className="col-span-3">From ($)</div>
            <div className="col-span-3">To ($)</div>
            <div className="col-span-3">Duty calculated on ($)</div>
            <div className="col-span-3 text-right">Rate</div>
          </div>

          <div className="space-y-2">
            {calculated.map((b, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input
                  type="number"
                  value={b.min}
                  onChange={(e) => updateBand(i, 'min', Number(e.target.value))}
                  className={`${inputClass} col-span-3`}
                />
                <input
                  type="number"
                  value={b.max ?? ''}
                  placeholder="no limit"
                  onChange={(e) =>
                    updateBand(i, 'max', e.target.value ? Number(e.target.value) : null)
                  }
                  className={`${inputClass} col-span-3`}
                />
                <input
                  type="number"
                  value={b.reference}
                  onChange={(e) => updateBand(i, 'reference', Number(e.target.value))}
                  className={`${inputClass} col-span-3`}
                />
                <div className="col-span-3 text-right">
                  <span className="inline-block bg-indigo-950 text-indigo-300 rounded-lg px-3 py-2 text-sm font-semibold tabular-nums w-full">
                    ${b.rate}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-1">DHL Express</h2>
          <p className="text-gray-400 text-sm mb-4">
            Flat rate, duties not included — customers pay customs on delivery.
          </p>
          <div className="space-y-4">
            <div className="max-w-[160px]">
              <label className="block text-sm text-gray-300 mb-1">Flat rate ($)</label>
              <input
                type="number"
                step="0.01"
                value={dhlRate}
                onChange={(e) => setDhlRate(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Note shown at checkout</label>
              <input
                type="text"
                value={dhlNote}
                onChange={(e) => setDhlNote(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={loading}
            className="rounded-lg border border-gray-700 bg-gray-900 hover:bg-gray-800 px-4 py-2 text-sm font-medium disabled:opacity-50 transition"
          >
            Save settings
          </button>
          <button
            onClick={handleSync}
            disabled={loading}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold disabled:opacity-50 transition"
          >
            Sync to Shopify
          </button>
          {loading && <span className="text-sm text-gray-500">Working…</span>}
        </div>

        {message && (
          <div className="rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-sm text-gray-200">
            {message}
          </div>
        )}
      </div>
    </main>
  )
}
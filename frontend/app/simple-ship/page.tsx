'use client'

import { useState, useEffect } from 'react'

type Band = { min: number; max: number | null; reference: number }

type ShippingOption = {
  id: string
  type: 'tariff' | 'flat'
  name: string
  sort_order: number
  // tariff fields
  tariff_rate?: number | null
  base_cost?: number | null
  bands?: Band[] | null
  // flat fields
  flat_rate?: number | null
  note?: string | null
}

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
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [options, setOptions] = useState<ShippingOption[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    const shopParam = new URLSearchParams(window.location.search).get('shop')
    if (shopParam) {
      setShop(shopParam)
      init(shopParam)
    } else {
      setChecked(true)
    }
  }, [])

  async function init(shopDomain: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/shopify/settings?shop=${shopDomain}`)
      const data = await res.json()
      if (data.connected) {
        setConnected(true)
        setLastSynced(data.last_synced_at)
        await loadOptions(shopDomain)
      }
    } finally {
      setLoading(false)
      setChecked(true)
    }
  }

  async function loadOptions(shopDomain: string) {
    const res = await fetch(`/api/shopify/options?shop=${shopDomain}`)
    const data = await res.json()
    setOptions(data.options ?? [])
  }

  function handleConnect() {
    if (shop) window.location.href = `/api/shopify/auth?shop=${shop}`
  }

  async function addOption(type: 'tariff' | 'flat') {
    setLoading(true)
    setMessage('')
    try {
      const body =
        type === 'tariff'
          ? {
              shop,
              type,
              name: 'Aramex',
              tariff_rate: 0.19,
              base_cost: 15,
              bands: DEFAULT_BANDS,
            }
          : {
              shop,
              type,
              name: 'DHL Express',
              flat_rate: 20,
              note: 'Customs duties may be charged on delivery',
            }

      const res = await fetch('/api/shopify/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.option) {
        setOptions([...options, data.option])
      } else {
        setMessage(`Couldn't add option: ${data.error}`)
      }
    } finally {
      setLoading(false)
    }
  }

  async function saveOption(option: ShippingOption) {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/shopify/options', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(option),
      })
      const data = await res.json()
      setMessage(data.option ? `Saved "${option.name}".` : `Couldn't save: ${data.error}`)
    } finally {
      setLoading(false)
    }
  }

  async function deleteOption(id: string) {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch(`/api/shopify/options?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setOptions(options.filter((o) => o.id !== id))
      } else {
        setMessage(`Couldn't delete: ${data.error}`)
      }
    } finally {
      setLoading(false)
    }
  }

  function updateLocal(id: string, fields: Partial<ShippingOption>) {
    setOptions(options.map((o) => (o.id === id ? { ...o, ...fields } : o)))
  }

  function updateBand(optionId: string, i: number, field: keyof Band, value: number | null) {
    const option = options.find((o) => o.id === optionId)
    if (!option || !option.bands) return
    const newBands = [...option.bands]
    newBands[i] = { ...newBands[i], [field]: value }
    updateLocal(optionId, { bands: newBands })
  }

  function addBand(optionId: string) {
    const option = options.find((o) => o.id === optionId)
    if (!option) return
    const bands = option.bands ?? []
    const lastMax = bands.length > 0 ? bands[bands.length - 1].max ?? 0 : 0
    updateLocal(optionId, {
      bands: [...bands, { min: lastMax, max: null, reference: lastMax }],
    })
  }

  function removeBand(optionId: string, i: number) {
    const option = options.find((o) => o.id === optionId)
    if (!option || !option.bands) return
    updateLocal(optionId, { bands: option.bands.filter((_, idx) => idx !== i) })
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
        setMessage('Shipping rates updated in your store (US zone).')
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
            Connect your Shopify store to set up your US shipping options.
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

        <p className="text-sm text-gray-400">
          These options apply to your US shipping zone. Add as many as you need —
          a <span className="text-gray-200 font-medium">tariff-inclusive</span> option calculates a duty-included
          flat rate based on order value bands; a <span className="text-gray-200 font-medium">flat rate</span> option
          is a simple price with an optional note shown at checkout.
        </p>

        {options.map((option) => (
          <section key={option.id} className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 mr-4">
                <span
                  className={`inline-block text-xs font-medium px-2 py-0.5 rounded mb-2 ${
                    option.type === 'tariff'
                      ? 'bg-indigo-950 text-indigo-300'
                      : 'bg-gray-800 text-gray-300'
                  }`}
                >
                  {option.type === 'tariff' ? 'Tariff-inclusive' : 'Flat rate'}
                </span>
                <input
                  type="text"
                  value={option.name}
                  onChange={(e) => updateLocal(option.id, { name: e.target.value })}
                  className={`${inputClass} font-semibold text-base`}
                  placeholder="Option name (shown at checkout)"
                />
              </div>
              <button
                onClick={() => deleteOption(option.id)}
                className="text-gray-500 hover:text-red-400 text-sm transition mt-1"
              >
                Remove
              </button>
            </div>

            {option.type === 'tariff' && (
              <>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Tariff rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={(option.tariff_rate ?? 0) * 100}
                      onChange={(e) =>
                        updateLocal(option.id, { tariff_rate: Number(e.target.value) / 100 })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Base shipping cost ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={option.base_cost ?? 0}
                      onChange={(e) => updateLocal(option.id, { base_cost: Number(e.target.value) })}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1 mb-2">
                  <div className="col-span-3">From ($)</div>
                  <div className="col-span-3">To ($)</div>
                  <div className="col-span-3">Duty calculated on ($)</div>
                  <div className="col-span-2 text-right">Rate</div>
                  <div className="col-span-1"></div>
                </div>

                <div className="space-y-2 mb-3">
                  {(option.bands ?? []).map((b, i) => {
                    const rate = Math.ceil((option.base_cost ?? 0) + (option.tariff_rate ?? 0) * b.reference)
                    return (
                      <div key={i} className="grid grid-cols-12 gap-2 items-center">
                        <input
                          type="number"
                          value={b.min}
                          onChange={(e) => updateBand(option.id, i, 'min', Number(e.target.value))}
                          className={`${inputClass} col-span-3`}
                        />
                        <input
                          type="number"
                          value={b.max ?? ''}
                          placeholder="no limit"
                          onChange={(e) =>
                            updateBand(option.id, i, 'max', e.target.value ? Number(e.target.value) : null)
                          }
                          className={`${inputClass} col-span-3`}
                        />
                        <input
                          type="number"
                          value={b.reference}
                          onChange={(e) => updateBand(option.id, i, 'reference', Number(e.target.value))}
                          className={`${inputClass} col-span-3`}
                        />
                        <div className="col-span-2 text-right">
                          <span className="inline-block bg-indigo-950 text-indigo-300 rounded-lg px-3 py-2 text-sm font-semibold tabular-nums w-full">
                            ${rate}
                          </span>
                        </div>
                        <div className="col-span-1 text-right">
                          <button
                            onClick={() => removeBand(option.id, i)}
                            className="text-gray-500 hover:text-red-400 text-sm transition"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <button
                  onClick={() => addBand(option.id)}
                  className="text-sm text-indigo-400 hover:text-indigo-300 transition"
                >
                  + Add band
                </button>
              </>
            )}

            {option.type === 'flat' && (
              <div className="space-y-4">
                <div className="max-w-[160px]">
                  <label className="block text-sm text-gray-300 mb-1">Flat rate ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={option.flat_rate ?? 0}
                    onChange={(e) => updateLocal(option.id, { flat_rate: Number(e.target.value) })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Note shown at checkout</label>
                  <input
                    type="text"
                    value={option.note ?? ''}
                    onChange={(e) => updateLocal(option.id, { note: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            <div className="mt-4">
              <button
                onClick={() => saveOption(option)}
                disabled={loading}
                className="rounded-lg border border-gray-700 bg-gray-900 hover:bg-gray-800 px-4 py-2 text-sm font-medium disabled:opacity-50 transition"
              >
                Save changes
              </button>
            </div>
          </section>
        ))}

        <div className="flex items-center gap-3">
          <button
            onClick={() => addOption('tariff')}
            disabled={loading}
            className="rounded-lg border border-gray-700 bg-gray-900 hover:bg-gray-800 px-4 py-2 text-sm font-medium disabled:opacity-50 transition"
          >
            + Add tariff-inclusive option
          </button>
          <button
            onClick={() => addOption('flat')}
            disabled={loading}
            className="rounded-lg border border-gray-700 bg-gray-900 hover:bg-gray-800 px-4 py-2 text-sm font-medium disabled:opacity-50 transition"
          >
            + Add flat-rate option
          </button>
        </div>

        <div className="pt-4 border-t border-gray-800 flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={loading || options.length === 0}
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
"use client"

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { DevicesAPI } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function EditDevicePage() {
  const router = useRouter()
  const pathname = usePathname()
  const id = pathname.split('/').slice(-2)[0]

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ deviceId: '', name: '', location: '', firmwareVersion: '', status: '' as any, battery: 100, signal: 0 })

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const d = await DevicesAPI.get(id)
        if (!active) return
        setForm({ deviceId: d.deviceId, name: d.name, location: d.location || '', firmwareVersion: d.firmwareVersion || '', status: d.status, battery: d.battery ?? 100, signal: d.signal ?? 0 })
      } catch (e: any) {
        setError(e?.message || 'Failed to load device')
      } finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [id])

  const onChange = (e: any) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async (e: any) => {
    e.preventDefault()
    setError('')
    try {
      setSaving(true)
      await DevicesAPI.update(id, { name: form.name, location: form.location, status: form.status, firmwareVersion: form.firmwareVersion, battery: Number(form.battery), signal: Number(form.signal) })
      router.push('/devices')
    } catch (err: any) {
      setError(err?.message || 'Failed to update device')
    } finally { setSaving(false) }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 space-y-6">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Edit Device</CardTitle>
            <CardDescription>Modify device metadata and settings.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium mb-1 block">Device ID</label>
                  <Input name="deviceId" value={form.deviceId} readOnly />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Name</label>
                  <Input name="name" value={form.name} onChange={onChange} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Location</label>
                  <Input name="location" value={form.location} onChange={onChange} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Firmware</label>
                  <Input name="firmwareVersion" value={form.firmwareVersion} onChange={onChange} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Status</label>
                  <select name="status" value={form.status} onChange={onChange} className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm">
                    <option value="ONLINE">ONLINE</option>
                    <option value="OFFLINE">OFFLINE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Battery (%)</label>
                    <Input name="battery" value={String(form.battery)} onChange={onChange} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Signal (%)</label>
                    <Input name="signal" value={String(form.signal)} onChange={onChange} />
                  </div>
                </div>
                {error && <div className="text-xs text-destructive">{error}</div>}
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving} className="bg-primary">{saving ? 'Saving...' : 'Save'}</Button>
                  <Button type="button" variant="outline" className="bg-transparent" onClick={() => router.push('/devices')}>Cancel</Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

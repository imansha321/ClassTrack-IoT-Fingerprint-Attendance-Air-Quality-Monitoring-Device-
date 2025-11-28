"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { DevicesAPI } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function AddDevicePage() {
  const router = useRouter()
  const [form, setForm] = useState({ deviceId: '', name: '', type: 'FINGERPRINT_SCANNER', location: '', firmwareVersion: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onChange = (e: any) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async (e: any) => {
    e.preventDefault()
    setError('')
    if (!form.deviceId || !form.name || !form.type || !form.location) {
      setError('All required fields must be filled')
      return
    }
    try {
      setLoading(true)
      await DevicesAPI.create({ deviceId: form.deviceId, name: form.name, type: form.type as any, location: form.location, firmwareVersion: form.firmwareVersion || undefined })
      router.push('/devices')
    } catch (err: any) {
      setError(err?.message || 'Failed to create device')
    } finally { setLoading(false) }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 space-y-6">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Add Device</CardTitle>
            <CardDescription>Register a new IoT device.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-xs font-medium mb-1 block">Device ID</label>
                <Input name="deviceId" value={form.deviceId} onChange={onChange} placeholder="ESP32-001" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Name</label>
                <Input name="name" value={form.name} onChange={onChange} placeholder="Room 101 Sensor" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Type</label>
                <select name="type" value={form.type} onChange={onChange} className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm">
                  <option value="FINGERPRINT_SCANNER">Fingerprint Scanner</option>
                  <option value="MULTI_SENSOR">Multi Sensor</option>
                  <option value="AIR_QUALITY_SENSOR">Air Quality Sensor</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Location</label>
                <Input name="location" value={form.location} onChange={onChange} placeholder="Room 101" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Firmware Version (optional)</label>
                <Input name="firmwareVersion" value={form.firmwareVersion} onChange={onChange} placeholder="v2.1.3" />
              </div>
              {error && <div className="text-xs text-destructive">{error}</div>}
              <div className="flex gap-2">
                <Button type="submit" disabled={loading} className="bg-primary">{loading ? 'Saving...' : 'Save'}</Button>
                <Button type="button" variant="outline" className="bg-transparent" onClick={() => router.push('/devices')}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

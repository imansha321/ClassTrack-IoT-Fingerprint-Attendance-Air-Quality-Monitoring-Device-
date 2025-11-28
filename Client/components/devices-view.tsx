"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { DevicesAPI } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Cpu, Signal, Battery, AlertCircle, CheckCircle2, Clock } from "lucide-react"

export function DevicesView() {
  const [devices, setDevices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const list = await DevicesAPI.list()
        if (!active) return
        setDevices(list)
      } catch (e: any) {
        if (!active) return
        setError(e?.message || "Failed to load devices")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const onlineCount = devices.filter(d => d.status === 'ONLINE').length
  const offlineCount = devices.filter(d => d.status === 'OFFLINE').length
  // For battery and signal we may not yet have telemetry; show 0 as placeholder until integrated.
  const lowBattery = devices.filter(d => (d.battery ?? 100) < 25).length

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Device Management</h1>
          <p className="text-muted-foreground mt-2">Monitor all IoT devices and their connectivity</p>
        </div>
        <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/devices/add">+ Add Device</Link>
        </Button>
      </div>

      {/* Device Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Devices" value={devices.length} color="primary" />
        <StatCard label="Online" value={onlineCount} color="secondary" />
        <StatCard label="Offline" value={offlineCount} color="destructive" />
        <StatCard label="Low Battery" value={lowBattery} color="accent" />
      </div>

      {/* Device List */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Connected Devices</CardTitle>
          <CardDescription>Status and diagnostics of all registered devices</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">Loading devices...</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && devices.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">No devices found. Add your first device.</p>
          )}
          <div className="space-y-3">
            {devices.map((device) => {
              const battery = device.battery ?? 100
              const signal = device.signal ?? 0
              return (
                <div key={device.id} className="p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Cpu className="w-5 h-5 text-primary" />
                        <div>
                          <h3 className="font-semibold text-foreground">{device.name}</h3>
                          <p className="text-xs text-muted-foreground">{device.deviceId}</p>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          {device.status === "ONLINE" ? (
                            <span className="flex items-center gap-1 text-xs font-medium text-secondary bg-secondary/10 px-2 py-1 rounded">
                              <CheckCircle2 className="w-3 h-3" />
                              Online
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 px-2 py-1 rounded">
                              <AlertCircle className="w-3 h-3" />
                              Offline
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-3 text-xs">
                        <div>
                          <p className="text-muted-foreground">Type</p>
                          <p className="font-medium text-foreground capitalize mt-1">{device.type.toLowerCase().replace(/_/g, ' ')}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Last Seen</p>
                          <p className="font-medium text-foreground mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {device.lastSeen ? new Date(device.lastSeen).toLocaleTimeString() : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Battery</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Battery
                              className={`w-3 h-3 ${battery > 50 ? "text-secondary" : battery > 25 ? "text-accent" : "text-destructive"}`}
                            />
                            <span className="font-medium">{battery}%</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Signal</p>
                          <p className="font-medium text-foreground mt-1 flex items-center gap-1">
                            <Signal className="w-3 h-3" />
                            {signal}%
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Firmware</p>
                          <p className="font-medium text-foreground mt-1">{device.firmwareVersion || '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Location</p>
                          <p className="font-medium text-foreground mt-1">{device.location}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="outline" onClick={() => window.location.href = `/devices/${device.id}/edit`}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={async () => {
                        if (!confirm('Delete device "' + device.name + '"?')) return;
                        try {
                          await DevicesAPI.delete(device.id)
                          setDevices(prev => prev.filter(d => d.id !== device.id))
                        } catch (e: any) { alert(e?.message || 'Failed to delete') }
                      }}>Delete</Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Device Health (placeholder; awaiting telemetry integration) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Battery Status</CardTitle>
            <CardDescription>Real-time battery data pending integration</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Telemetry not yet integrated.</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Signal Strength</CardTitle>
            <CardDescription>Real-time signal data pending integration</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Telemetry not yet integrated.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: any) {
  const colorClass =
    {
      primary: "text-primary",
      secondary: "text-secondary",
      destructive: "text-destructive",
      accent: "text-accent",
    }[color] || "text-primary"

  return (
    <Card className="border-border">
      <CardContent className="p-6">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <p className={`text-3xl font-bold mt-2 ${colorClass}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

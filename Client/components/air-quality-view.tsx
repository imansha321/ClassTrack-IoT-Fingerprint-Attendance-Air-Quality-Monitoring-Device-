"use client"

import { useEffect, useState } from "react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { AlertTriangle, Wind, Droplets, Thermometer } from "lucide-react"
import { AirQualityAPI, AlertsAPI } from "@/lib/api"

export function AirQualityView() {
  const [hourlyData, setHourlyData] = useState<any[]>([])
  const [roomsData, setRoomsData] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setLoading(true)
        setError("")
        const [list, rooms, alertList] = await Promise.all([
          AirQualityAPI.list({ limit: 64 }),
          AirQualityAPI.rooms(),
          AlertsAPI.list()
        ])
        if (!active) return
        // Transform list into hourly buckets (group by hour)
        const byHour: Record<string, any[]> = {}
        list.forEach((reading: any) => {
          const d = new Date(reading.timestamp)
          const hourLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
          byHour[hourLabel] = byHour[hourLabel] || []
          byHour[hourLabel].push(reading)
        })
        const hourly = Object.keys(byHour).sort().map(h => {
          const arr = byHour[h]
          const avg = (key: string) => (arr.reduce((sum, r) => sum + (r[key] ?? 0), 0) / arr.length)
          return { time: h, pm25: Math.round(avg('pm25')), co2: Math.round(avg('co2')), temp: parseFloat(avg('temperature').toFixed(1)), humidity: Math.round(avg('humidity')) }
        })
        setHourlyData(hourly)
        setRoomsData(rooms.map((r: any) => ({
          name: r.name,
            pm25: r.latest?.pm25 ?? 0,
            co2: r.latest?.co2 ?? 0,
            temp: r.latest?.temperature ?? 0,
            humidity: r.latest?.humidity ?? 0,
            quality: qualityFromMetrics(r.latest)
        })))
        setAlerts(alertList.slice(0,5))
      } catch (e: any) {
        if (!active) return
        setError(e?.message || 'Failed to load air quality data')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  function qualityFromMetrics(reading: any) {
    if (!reading) return 'Unknown'
    if (reading.co2 > 800 || reading.pm25 > 55) return 'Poor'
    if (reading.co2 > 700 || reading.pm25 > 35) return 'Moderate'
    return 'Good'
  }
  const currentAvg = hourlyData.slice(-1)[0]
  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Air Quality Monitoring</h1>
        <p className="text-muted-foreground mt-2">Real-time environmental conditions across all classrooms</p>
      </div>

      {/* Current Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <QualityMetric label="PM2.5" value={currentAvg ? `${currentAvg.pm25} µg/m³` : '—'} unit="" icon={Wind} warning={currentAvg ? currentAvg.pm25 > 35 : false} />
        <QualityMetric label="CO₂" value={currentAvg ? `${currentAvg.co2} ppm` : '—'} unit="" icon={AlertTriangle} warning={currentAvg ? currentAvg.co2 > 700 : false} />
        <QualityMetric label="Temperature" value={currentAvg ? `${currentAvg.temp}°C` : '—'} unit="" icon={Thermometer} />
        <QualityMetric label="Humidity" value={currentAvg ? `${currentAvg.humidity}%` : '—'} unit="" icon={Droplets} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly PM2.5 Trend */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>PM2.5 Levels (Hourly)</CardTitle>
            <CardDescription>Particulate matter concentration</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                pm25: { label: "PM2.5 (µg/m³)", color: "hsl(var(--chart-1))" },
              }}
              className="h-64"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyData}>
                  <defs>
                    <linearGradient id="colorPm25" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="pm25"
                    stroke="var(--color-chart-1)"
                    fillOpacity={1}
                    fill="url(#colorPm25)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Hourly CO2 Trend */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>CO₂ Levels (Hourly)</CardTitle>
            <CardDescription>Carbon dioxide concentration</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                co2: { label: "CO₂ (ppm)", color: "hsl(var(--chart-2))" },
              }}
              className="h-64"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyData}>
                  <defs>
                    <linearGradient id="colorCo2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="co2"
                    stroke="var(--color-chart-2)"
                    fillOpacity={1}
                    fill="url(#colorCo2)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Classroom Comparison */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Air Quality by Classroom</CardTitle>
          <CardDescription>Comparison of current readings across all rooms</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading && <p className="text-sm text-muted-foreground">Loading rooms...</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {!loading && !error && roomsData.length === 0 && <p className="text-sm text-muted-foreground">No room data.</p>}
            {roomsData.map((room) => (
              <div
                key={room.name}
                className={`p-4 rounded-lg border ${
                  room.quality === "Good"
                    ? "bg-secondary/10 border-secondary/30"
                    : room.quality === "Moderate"
                      ? "bg-accent/10 border-accent/30"
                      : "bg-destructive/10 border-destructive/30"
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-foreground">{room.name}</h3>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded ${
                      room.quality === "Good"
                        ? "bg-secondary/20 text-secondary"
                        : room.quality === "Moderate"
                          ? "bg-accent/20 text-accent"
                          : "bg-destructive/20 text-destructive"
                    }`}
                  >
                    {room.quality}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">PM2.5</p>
                    <p className="font-semibold">{room.pm25} µg/m³</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">CO₂</p>
                    <p className="font-semibold">{room.co2} ppm</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Temp</p>
                    <p className="font-semibold">{room.temp}°C</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Humidity</p>
                    <p className="font-semibold">{room.humidity}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Air Quality Alerts */}
      <Card className="border-border border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Active Alerts</CardTitle>
          <CardDescription>Thresholds exceeded</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {loading && <p className="text-sm text-muted-foreground">Loading alerts...</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {!loading && alerts.length === 0 && !error && <p className="text-sm text-muted-foreground">No active alerts.</p>}
            {alerts.map((alert, idx) => (
              <div key={idx} className="flex items-center gap-4 p-3 rounded-lg bg-card/50 border border-border">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${alert.severity === 'CRITICAL' ? 'bg-destructive' : 'bg-accent'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{alert.roomName || alert.device?.location || 'Room'}: {alert.metric || alert.type} exceeds threshold</p>
                  <p className="text-xs text-muted-foreground">Recorded: {alert.value ?? '—'} {alert.unit ?? ''}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Health Recommendations */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
          <CardDescription>Actions to improve air quality</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {(roomsData.slice(0,4) || []).map((room, idx) => {
              const rec = room.quality === 'Poor'
                ? `Improve ventilation in ${room.name} - high levels detected`
                : room.quality === 'Moderate'
                  ? `Monitor ${room.name}; consider airing out`
                  : `Maintain current conditions in ${room.name}`
              return (
                <li key={idx} className="flex items-start gap-3 text-foreground">
                  <span className="text-secondary mt-1">✓</span>
                  <span>{rec}</span>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function QualityMetric({ label, value, unit, icon: Icon, warning }: any) {
  return (
    <Card className={`border-border ${warning ? "bg-accent/5" : ""}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-2">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{unit}</p>
          </div>
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              warning ? "bg-accent/20 text-accent" : "bg-primary/20 text-primary"
            }`}
          >
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Filter } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, LineChart, Line } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { ReportsAPI } from "@/lib/api"

export function ReportsView() {
  const [monthlyAttendance, setMonthlyAttendance] = useState<any[]>([])
  const [airQualityTrend, setAirQualityTrend] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [range, setRange] = useState('month')
  const [type, setType] = useState('Attendance')
  const [summary, setSummary] = useState<any | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setLoading(true)
        setError("")
        const [attendanceData, airQualityData, devicesSummary] = await Promise.all([
          ReportsAPI.attendance(),
          ReportsAPI.airquality(),
          ReportsAPI.devices()
        ])
        if (!active) return
        // Aggregate attendance by month
        const byMonth: Record<string, { present: number; absent: number; late: number; total: number }> = {}
        attendanceData.forEach((rec: any) => {
          const d = new Date(rec.date)
          const key = d.toLocaleDateString(undefined, { month: 'short' })
          byMonth[key] = byMonth[key] || { present: 0, absent: 0, late: 0, total: 0 }
          byMonth[key].present += rec.present || 0
          byMonth[key].absent += rec.absent || 0
          byMonth[key].late += rec.late || 0
          byMonth[key].total += (rec.present || 0) + (rec.absent || 0) + (rec.late || 0)
        })
        const monthArr = Object.keys(byMonth).map(m => {
          const v = byMonth[m]
          const presentPct = v.total ? (v.present / v.total) * 100 : 0
          const absentPct = v.total ? (v.absent / v.total) * 100 : 0
          return { month: m, present: parseFloat(presentPct.toFixed(1)), absent: parseFloat(absentPct.toFixed(1)) }
        })
        setMonthlyAttendance(monthArr)

        // Weekly air quality averages
        const byWeek: Record<string, any[]> = {}
        airQualityData.forEach((r: any) => {
          const d = new Date(r.date)
          const weekNum = getWeekOfMonth(d)
          const key = `W${weekNum}`
          byWeek[key] = byWeek[key] || []
          byWeek[key].push(r)
        })
        const weekArr = Object.keys(byWeek).map(w => {
          const arr = byWeek[w]
            const avg = (k: string) => arr.reduce((s, r) => s + (r[k] || 0), 0) / arr.length || 0
          return { week: w, pm25_avg: Math.round(avg('pm25')), co2_avg: Math.round(avg('co2')), temp_avg: parseFloat(avg('temperature').toFixed(1)) }
        })
        setAirQualityTrend(weekArr)
        setSummary({ devices: devicesSummary.totalDevices, uptime: devicesSummary.avgUptime, lowBattery: devicesSummary.lowBattery })
      } catch (e: any) {
        if (!active) return
        setError(e?.message || 'Failed to load reports')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  function getWeekOfMonth(date: Date) {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
    const dayOfMonth = date.getDate()
    const adjustedDate = dayOfMonth + firstDay.getDay()
    return Math.ceil(adjustedDate / 7)
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-2">Comprehensive data analysis and export capabilities</p>
        </div>
      </div>

      {/* Report Filters */}
      <div className="flex gap-4 flex-wrap items-end">
        <div className="min-w-40">
          <label className="text-sm font-medium text-foreground mb-2 block">Date Range</label>
          <select value={range} onChange={e => setRange(e.target.value)} className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm">
            <option value="month">This Month</option>
            <option value="quarter">Last 3 Months</option>
            <option value="year">This Year</option>
          </select>
        </div>

        <div className="min-w-40">
          <label className="text-sm font-medium text-foreground mb-2 block">Report Type</label>
          <select value={type} onChange={e => setType(e.target.value)} className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm">
            <option value="Attendance">Attendance</option>
            <option value="Air Quality">Air Quality</option>
            <option value="Device Status">Device Status</option>
            <option value="Comprehensive">Comprehensive</option>
          </select>
        </div>

        <Button variant="outline" className="gap-2 bg-transparent">
          <Filter className="w-4 h-4" />
          Filter
        </Button>

        <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Download className="w-4 h-4" />
          Export as CSV
        </Button>

        <Button variant="outline" className="gap-2 bg-transparent">
          <Download className="w-4 h-4" />
          Export as PDF
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard label="Avg Attendance" value={monthlyAttendance.length ? `${(
          monthlyAttendance.reduce((s, m) => s + m.present, 0) / monthlyAttendance.length
        ).toFixed(1)}%` : '—'} color="secondary" />
        <SummaryCard label="Avg PM2.5" value={airQualityTrend.length ? `${(
          airQualityTrend.reduce((s, w) => s + w.pm25_avg, 0) / airQualityTrend.length
        ).toFixed(1)} µg/m³` : '—'} color="accent" />
        <SummaryCard label="Avg CO₂" value={airQualityTrend.length ? `${(
          airQualityTrend.reduce((s, w) => s + w.co2_avg, 0) / airQualityTrend.length
        ).toFixed(0)} ppm` : '—'} color="primary" />
        <SummaryCard label="Device Uptime" value={summary ? `${summary.uptime || '—'}%` : '—'} color="secondary" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Attendance */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Attendance Trend</CardTitle>
            <CardDescription>Monthly attendance rates</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                present: { label: "Present (%)", color: "hsl(var(--chart-2))" },
                absent: { label: "Absent (%)", color: "hsl(var(--chart-4))" },
              }}
              className="h-64"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyAttendance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="present" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Air Quality Trend */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Air Quality Average</CardTitle>
            <CardDescription>Weekly environmental trends</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                pm25_avg: { label: "PM2.5 (µg/m³)", color: "hsl(var(--chart-1))" },
                co2_avg: { label: "CO₂ (ppm)", color: "hsl(var(--chart-2))" },
              }}
              className="h-64"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={airQualityTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="week" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="pm25_avg"
                    stroke="var(--color-chart-1)"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="co2_avg"
                    stroke="var(--color-chart-2)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Reports */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
          <CardDescription>Generated reports available for download</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
            {error && !loading && <p className="text-sm text-destructive">{error}</p>}
            {!loading && !error && monthlyAttendance.length === 0 && <p className="text-sm text-muted-foreground">No report data.</p>}
            {monthlyAttendance.slice(-4).map((m, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors">
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">{m.month} Attendance Summary</h3>
                  <p className="text-xs text-muted-foreground mt-1">Present: {m.present}% • Absent: {m.absent}%</p>
                </div>
                <Button variant="outline" size="sm" className="gap-2 bg-transparent"><Download className="w-4 h-4" />Download</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Export Options */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Generate Custom Report</CardTitle>
          <CardDescription>Create and download a custom report with selected metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Select Metrics to Include</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  "Daily Attendance",
                  "Hourly Air Quality",
                  "Device Status",
                  "Room Comparisons",
                  "Trend Analysis",
                  "Alerts & Incidents",
                ].map((metric) => (
                  <label key={metric} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-input" />
                    <span className="text-sm text-foreground">{metric}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Report Format</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="format" defaultChecked />
                  <span className="text-sm text-foreground">PDF</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="format" />
                  <span className="text-sm text-foreground">CSV</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="format" />
                  <span className="text-sm text-foreground">Excel</span>
                </label>
              </div>
            </div>

            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              Generate & Download Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ label, value, color }: any) {
  const colorClass =
    {
      primary: "text-primary",
      secondary: "text-secondary",
      accent: "text-accent",
    }[color] || "text-primary"

  return (
    <Card className="border-border">
      <CardContent className="p-6">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <p className={`text-2xl font-bold mt-2 ${colorClass}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

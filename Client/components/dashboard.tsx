"use client"

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  AlertCircle,
  TrendingUp,
  Users,
  Wind,
  Download,
  RefreshCw,
  Battery,
  Wifi,
  CheckCircle,
  AlertTriangle,
} from "lucide-react"
import { Sidebar } from "./sidebar"
import { useEffect, useState } from "react"
import { DashboardAPI, AlertsAPI, DevicesAPI } from "@/lib/api"

const emptyWeek = ["Mon","Tue","Wed","Thu","Fri"].map(d => ({ date: d, present: 0, absent: 0, late: 0 }))

export function Dashboard({ isMobileMenuOpen, setIsMobileMenuOpen }: any) {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [weekly, setWeekly] = useState<any[]>([])
  const [classrooms, setClassrooms] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [devices, setDevices] = useState<any[]>([])

  const load = async () => {
    try {
      setLoading(true)
      const [s, w, c, a, d] = await Promise.all([
        DashboardAPI.stats(),
        DashboardAPI.weeklyAttendance(),
        DashboardAPI.classrooms(),
        AlertsAPI.list({ resolved: false }),
        DevicesAPI.list({ status: 'all' }),
      ])
      setStats(s)
      setWeekly(w)
      setClassrooms(c)
      setAlerts(a)
      setDevices(d)
    } catch (e) {
      // leave fallbacks
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    if (autoRefresh) {
      const t = setInterval(load, 30000)
      return () => clearInterval(t)
    }
  }, [autoRefresh])

  return (
    <div className="pt-20 lg:pt-0">
      <div className="lg:hidden">
        <Sidebar />
      </div>

      <div className="p-4 md:p-8 space-y-6 md:space-y-8">
        <div className="flex justify-between items-start flex-col md:flex-row gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-2">
              Welcome back! Here's your school's attendance and air quality overview.
            </p>
          </div>
          <div className="flex flex-col md:flex-row gap-2 items-start md:items-center">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`p-2 rounded-lg border transition-colors ${
                autoRefresh
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-muted border-border text-muted-foreground"
              }`}
              title="Toggle auto-refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Students"
            value={stats?.attendance?.total?.toString() ?? "0"}
            subtitle={`Present today: ${stats?.attendance?.present ?? 0}`}
            icon={Users}
            trend="+12%"
            color="primary"
            isSelected={selectedMetric === "students"}
            onClick={() => setSelectedMetric("students")}
          />
          <MetricCard
            title="Present Rate"
            value={`${stats?.attendance?.presentRate ?? '0.0'}%`}
            subtitle="School average"
            icon={TrendingUp}
            trend="+2.3%"
            color="secondary"
            isSelected={selectedMetric === "rate"}
            onClick={() => setSelectedMetric("rate")}
          />
          <MetricCard
            title="Air Quality"
            value={stats?.airQuality ? (stats.airQuality.pm25 < 35 && stats.airQuality.co2 < 750 ? 'Good' : 'Moderate') : 'Unknown'}
            subtitle={stats?.airQuality ? `PM2.5: ${stats.airQuality.pm25.toFixed(1)} µg/m³` : '—'}
            icon={Wind}
            trend="⚠️"
            color="accent"
            isSelected={selectedMetric === "air"}
            onClick={() => setSelectedMetric("air")}
          />
          <MetricCard
            title="Active Devices"
            value={(stats?.devices?.total ?? 0).toString()}
            subtitle={`${stats?.devices?.online ?? 0} online`}
            icon={AlertCircle}
            trend="✓"
            color="primary"
            isSelected={selectedMetric === "devices"}
            onClick={() => setSelectedMetric("devices")}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <Card className="border-border lg:col-span-2">
            <CardHeader className="pb-3 md:pb-6">
              <CardTitle className="text-lg md:text-base">Weekly Attendance</CardTitle>
              <CardDescription className="text-xs md:text-sm">Student check-ins by day</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  present: { label: "Present", color: "#000000" },
                  absent: { label: "Absent", color: "#000000" },
                  late: { label: "Late", color: "#000000" },
                }}
                className="h-48 md:h-64"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(weekly && weekly.length ? weekly.map((d: any) => ({ date: d.day, present: d.present, absent: d.absent, late: d.late })) : emptyWeek)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend wrapperStyle={{ paddingTop: "16px" }} />
                    <Bar dataKey="present" stackId="a" fill="#000000" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="absent" stackId="a" fill="#404040" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="late" stackId="a" fill="#666666" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3 md:pb-6">
              <CardTitle className="text-lg md:text-base">Attendance Breakdown</CardTitle>
              <CardDescription className="text-xs md:text-sm">Today's distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-48 md:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats ? [
                        { name: 'Present', value: stats.attendance.present, color: 'hsl(var(--chart-2))' },
                        { name: 'Absent', value: stats.attendance.absent, color: 'hsl(var(--chart-4))' },
                        { name: 'Late', value: stats.attendance.late, color: 'hsl(var(--chart-3))' },
                      ] : []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {(stats ? [
                        { name: 'Present', value: stats.attendance.present, color: 'hsl(var(--chart-2))' },
                        { name: 'Absent', value: stats.attendance.absent, color: 'hsl(var(--chart-4))' },
                        { name: 'Late', value: stats.attendance.late, color: 'hsl(var(--chart-3))' },
                      ] : []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
              <div className="mt-4 space-y-2">
                {(stats ? [
                  { name: 'Present', value: stats.attendance.present },
                  { name: 'Absent', value: stats.attendance.absent },
                  { name: 'Late', value: stats.attendance.late },
                ] : []).map((item) => (
                  <div key={item.name} className="flex justify-between text-xs md:text-sm">
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border">
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="text-lg md:text-base">Air Quality Trend</CardTitle>
            <CardDescription className="text-xs md:text-sm">PM2.5 and CO₂ levels throughout the day</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                pm25: { label: "PM2.5 (µg/m³)", color: "hsl(var(--chart-1))" },
                co2: { label: "CO₂ (ppm)", color: "hsl(var(--chart-2))" },
              }}
              className="h-48 md:h-80"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={(stats?.airQuality ? [{ time: 'Now', pm25: stats.airQuality.pm25, co2: stats.airQuality.co2 }] : [])}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="time" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend wrapperStyle={{ paddingTop: "16px" }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="pm25"
                    stroke="var(--color-chart-1)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="co2"
                    stroke="var(--color-chart-2)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="text-lg md:text-base">Classroom Status</CardTitle>
            <CardDescription className="text-xs md:text-sm">Current air quality and occupancy</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {classrooms.length === 0 && (
                <div className="text-xs md:text-sm text-muted-foreground">No classroom data available.</div>
              )}
              {(classrooms || []).map((room) => (
                <div
                  key={room.room}
                  className="p-3 md:p-4 border border-border rounded-lg bg-card/50 hover:bg-card/70 transition-colors cursor-pointer"
                >
                  <h3 className="font-semibold text-sm md:text-base text-card-foreground">{room.room}</h3>
                  <div className="mt-3 space-y-2 text-xs md:text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Occupancy:</span>
                      <span className="font-medium">{room.occupancy ?? '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Air Quality:</span>
                      <span className={`font-medium ${room.airQuality === "Good" ? "text-secondary" : room.airQuality === 'Moderate' ? 'text-accent' : 'text-destructive'}`}>
                        {room.airQuality ?? '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Temp/Humidity:</span>
                      <span className="font-medium">{room.temp ?? '—'} / {room.humidity ?? '—'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3 md:pb-6 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg md:text-base">IoT Device Status</CardTitle>
              <CardDescription className="text-xs md:text-sm">Fingerprint scanner and sensor health</CardDescription>
            </div>
            <button className="p-2 hover:bg-muted rounded-lg transition-colors" title="Download alerts">
              <Download className="w-4 h-4 text-muted-foreground" />
            </button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-2 md:p-3 font-semibold text-muted-foreground">Device ID</th>
                    <th className="text-left p-2 md:p-3 font-semibold text-muted-foreground">Location</th>
                    <th className="text-center p-2 md:p-3 font-semibold text-muted-foreground">Battery</th>
                    <th className="text-center p-2 md:p-3 font-semibold text-muted-foreground">Signal</th>
                    <th className="text-left p-2 md:p-3 font-semibold text-muted-foreground">Status</th>
                    <th className="text-left p-2 md:p-3 font-semibold text-muted-foreground">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.length === 0 && (
                    <tr><td colSpan={6} className="p-4 text-center text-xs text-muted-foreground">No devices found.</td></tr>
                  )}
                  {devices.map((device: any) => (
                    <tr key={device.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-2 md:p-3 font-medium text-foreground">{device.deviceId}</td>
                      <td className="p-2 md:p-3 text-muted-foreground">{device.location}</td>
                      <td className="p-2 md:p-3">
                        <div className="flex items-center justify-center gap-1">
                          <Battery className="w-4 h-4 text-muted-foreground" />
                          <span className={device.battery > 60 ? "text-secondary" : device.battery > 30 ? "text-accent" : "text-destructive"}>{device.battery}%</span>
                        </div>
                      </td>
                      <td className="p-2 md:p-3">
                        <div className="flex items-center justify-center gap-1">
                          <Wifi className="w-4 h-4 text-secondary" />
                          <span>{Math.round((device.signal/20))}/5</span>
                        </div>
                      </td>
                      <td className="p-2 md:p-3">
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-secondary" />
                          <span className="text-secondary font-medium">{device.status}</span>
                        </div>
                      </td>
                      <td className="p-2 md:p-3 text-muted-foreground text-xs">{new Date(device.lastSeen).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3 md:pb-6 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg md:text-base">Recent Alerts</CardTitle>
              <CardDescription className="text-xs md:text-sm">System notifications and warnings</CardDescription>
            </div>
            <button className="p-2 hover:bg-muted rounded-lg transition-colors" title="Download alerts">
              <Download className="w-4 h-4 text-muted-foreground" />
            </button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 md:space-y-3">
              {(alerts || []).length === 0 && (
                <div className="text-xs md:text-sm text-muted-foreground">No active alerts.</div>
              )}
              {(alerts || []).map((alert: any, idx: number) => (
                <div
                  key={idx}
                  className="flex gap-3 p-2 md:p-3 rounded-lg bg-muted/30 border border-border/50 hover:border-border transition-colors"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {alert.severity === "CRITICAL" || alert.severity === "WARNING" ? (
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                    ) : alert.severity === "INFO" ? (
                      <AlertCircle className="w-4 h-4 text-primary" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-secondary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-medium text-card-foreground">{alert.message}</p>
                    <p className="text-xs text-muted-foreground">{new Date(alert.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({ title, value, subtitle, icon: Icon, trend, color, isSelected, onClick }: any) {
  const colorClass = {
    primary: "bg-primary/10 text-primary border-primary/20",
    secondary: "bg-secondary/10 text-secondary border-secondary/20",
    accent: "bg-accent/10 text-accent border-accent/20",
  }[color]

  return (
    <Card
      className={`border-border cursor-pointer transition-all ${
        isSelected ? "ring-2 ring-primary shadow-lg" : "hover:shadow-md"
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs md:text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-xl md:text-3xl font-bold mt-2">{value}</p>
            <p className="text-xs md:text-sm text-muted-foreground mt-2">{subtitle}</p>
          </div>
          <div
            className={`w-10 md:w-12 h-10 md:h-12 rounded-lg flex items-center justify-center border flex-shrink-0 ${colorClass}`}
          >
            <Icon className="w-5 md:w-6 h-5 md:h-6" />
          </div>
        </div>
        <div className="mt-3 md:mt-4 text-xs md:text-sm font-medium text-secondary">{trend}</div>
      </CardContent>
    </Card>
  )
}

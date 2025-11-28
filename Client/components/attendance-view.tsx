"use client"

import { useEffect, useState, useMemo } from "react"
import { AttendanceAPI, StudentsAPI } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Download, Filter, Clock, Calendar, TrendingUp, CheckCircle, XCircle } from "lucide-react"
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"

export function AttendanceView() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedClass, setSelectedClass] = useState("all")
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [attendance, setAttendance] = useState<any[]>([])
  const [stats, setStats] = useState<any | null>(null)
  const [weeklyTrend, setWeeklyTrend] = useState<any[]>([])
  const [studentHistory, setStudentHistory] = useState<Record<string, any[]>>({})
  const [studentsMap, setStudentsMap] = useState<Record<string, any>>({})

  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    ;(async () => {
      try {
        // fetch attendance for selected date
        const dayAttendance = await AttendanceAPI.list({ date: selectedDate, class: selectedClass })
        if (!active) return
        setAttendance(dayAttendance)

        // build students map for quick lookup
        const uniqueStudentIds = Array.from(new Set(dayAttendance.map((a: any) => a.student.studentId)))
        const studentsDetails = await StudentsAPI.list()
        if (!active) return
        const map: Record<string, any> = {}
        studentsDetails.forEach(s => { map[s.studentId] = s })
        setStudentsMap(map)

        // stats for week (simple approach: last 5 days)
        const trendDays: any[] = []
        for (let i = 4; i >= 0; i--) {
          const d = new Date(selectedDate)
          d.setDate(d.getDate() - i)
          const ds = d.toISOString().split('T')[0]
          const dayData = await AttendanceAPI.list({ date: ds, class: selectedClass })
          const present = dayData.filter((r: any) => r.status === 'PRESENT').length
          const late = dayData.filter((r: any) => r.status === 'LATE').length
          // Absent calculation: total expected - recorded (requires roster); fallback 0
          const absent = 0
          trendDays.push({ day: d.toLocaleDateString(undefined, { weekday: 'short' }), present, late, absent })
        }
        setWeeklyTrend(trendDays)

        // overall stats (today only for now)
        const present = dayAttendance.filter(a => a.status === 'PRESENT').length
        const late = dayAttendance.filter(a => a.status === 'LATE').length
        const absent = 0
        const total = present + late + absent
        setStats({ total, present, absent, late })

        // per-student recent history (limit 5 per student)
        const historyMap: Record<string, any[]> = {}
        for (const sid of uniqueStudentIds.slice(0, 20)) { // limit to avoid many requests
          try {
            const hist = await AttendanceAPI.studentHistory(sid, 5)
            historyMap[sid] = hist
          } catch {}
        }
        setStudentHistory(historyMap)
      } catch (e: any) {
        if (!active) return
        setError(e?.message || 'Failed to load attendance')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [selectedDate, selectedClass])

  const filteredStudents = attendance.filter((record) => {
    const student = record.student
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) || student.studentId.includes(searchTerm)
    const matchesClass = selectedClass === 'all' || student.class === selectedClass
    return matchesSearch && matchesClass
  })

  // Derived: peak check-in slots (example morning window) and late arrivals
  const peakSlots = useMemo(() => {
    if (!attendance.length) return [] as { time: string; count: number; percentage: number }[]
    const dateObj = new Date(selectedDate)
    // Define slot boundaries (adjust as needed)
    const slotDefs: { label: string; start: string; end: string }[] = [
      { label: '08:00 - 08:15', start: '08:00', end: '08:15' },
      { label: '08:15 - 08:30', start: '08:15', end: '08:30' },
      { label: '08:30 - 09:00', start: '08:30', end: '09:00' },
    ]
    const parseHM = (hm: string) => {
      const [h,m] = hm.split(':').map(Number)
      const d = new Date(dateObj)
      d.setHours(h, m, 0, 0)
      return d
    }
    const totalRecordsInWindow = attendance.filter(r => {
      const t = new Date(r.checkInTime)
      return t >= parseHM('08:00') && t < parseHM('09:00')
    }).length || 1 // avoid divide by zero
    return slotDefs.map(def => {
      const start = parseHM(def.start)
      const end = parseHM(def.end)
      const count = attendance.filter(r => {
        const t = new Date(r.checkInTime)
        return t >= start && t < end
      }).length
      const percentage = Math.round((count / totalRecordsInWindow) * 100)
      return { time: def.label, count, percentage }
    })
  }, [attendance, selectedDate])

  const lateArrivals = useMemo(() => {
    if (!attendance.length) return [] as { name: string; time: string }[]
    const threshold = new Date(selectedDate)
    threshold.setHours(8,30,0,0)
    return attendance
      .filter(r => new Date(r.checkInTime) > threshold)
      .sort((a,b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime())
      .map(r => ({ name: r.student.name, time: new Date(r.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }))
  }, [attendance, selectedDate])
  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 pt-20 md:pt-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Attendance Management</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2">
          View and manage student attendance records with fingerprint verification
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-start md:items-end">
        <div className="flex-1 w-full md:min-w-64">
          <label className="text-xs md:text-sm font-medium text-foreground mb-2 block">Search Student</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 md:w-5 h-4 md:h-5 text-muted-foreground" />
            <Input
              placeholder="Search by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-xs md:text-sm"
            />
          </div>
        </div>

        <div className="w-full md:w-auto md:min-w-40">
          <label className="text-xs md:text-sm font-medium text-foreground mb-2 block">Class</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-xs md:text-sm"
          >
            <option value="all">All Classes</option>
            <option value="10-A">Class 10-A</option>
            <option value="10-B">Class 10-B</option>
            <option value="10-C">Class 10-C</option>
          </select>
        </div>

        <div className="w-full md:w-auto md:min-w-40">
          <label className="text-xs md:text-sm font-medium text-foreground mb-2 block">Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-3 w-4 md:w-5 h-4 md:h-5 text-muted-foreground pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-md border border-input bg-background text-foreground text-xs md:text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" className="flex-1 md:flex-none gap-2 bg-transparent text-xs md:text-sm">
            <Filter className="w-3 md:w-4 h-3 md:h-4" />
            <span className="hidden md:inline">Filter</span>
          </Button>

          <Button className="flex-1 md:flex-none gap-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs md:text-sm">
            <Download className="w-3 md:w-4 h-3 md:h-4" />
            <span className="hidden md:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Attendance Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Total Records" value={stats ? stats.total : '—'} icon={<CheckCircle className="w-4 md:w-5 h-4 md:h-5" />} />
        <StatCard label="Present" value={stats ? stats.present : '—'} highlight="secondary" icon={<CheckCircle className="w-4 md:w-5 h-4 md:h-5" />} />
        <StatCard label="Absent" value={stats ? stats.absent : '—'} highlight="destructive" icon={<XCircle className="w-4 md:w-5 h-4 md:h-5" />} />
        <StatCard label="Late" value={stats ? stats.late : '—'} highlight="accent" icon={<Clock className="w-4 md:w-5 h-4 md:h-5" />} />
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="flex items-center gap-2 text-lg md:text-base">
            <TrendingUp className="w-4 md:w-5 h-4 md:h-5" />
            Weekly Attendance Trend
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">Attendance statistics for the past 5 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                />
                <Bar dataKey="present" fill="hsl(var(--secondary))" name="Present" />
                <Bar dataKey="late" fill="hsl(var(--accent))" name="Late" />
                <Bar dataKey="absent" fill="hsl(var(--destructive))" name="Absent" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <Card className="border-border">
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="text-lg md:text-base">Attendance Records - {selectedDate}</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Real-time attendance records via fingerprint authentication
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-2 md:px-4 py-3 font-medium text-foreground">Student ID</th>
                  <th className="text-left px-2 md:px-4 py-3 font-medium text-foreground">Name</th>
                  <th className="text-left px-2 md:px-4 py-3 font-medium text-foreground hidden md:table-cell">
                    Class
                  </th>
                  <th className="text-left px-2 md:px-4 py-3 font-medium text-foreground">Check-in</th>
                  <th className="text-left px-2 md:px-4 py-3 font-medium text-foreground hidden lg:table-cell">
                    Fingerprint
                  </th>
                  <th className="text-left px-2 md:px-4 py-3 font-medium text-foreground">Status</th>
                  <th className="text-left px-2 md:px-4 py-3 font-medium text-foreground"></th>
                </tr>
              </thead>
              <tbody>
              {loading && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">Loading...</td></tr>
              )}
              {error && !loading && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-destructive">{error}</td></tr>
              )}
              {!loading && !error && filteredStudents.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">No records.</td></tr>
              )}
              {filteredStudents.map((record) => {
                const student = record.student
                const fingerprintStatus = record.fingerprintMatch ? 'Matched' : 'Not Scanned'
                return (
                  <>
                    <tr
                      key={record.id}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setExpandedStudent(expandedStudent === record.id ? null : record.id)}
                    >
                      <td className="px-2 md:px-4 py-3 text-muted-foreground text-xs md:text-sm">{student.studentId}</td>
                      <td className="px-2 md:px-4 py-3 font-medium text-foreground text-xs md:text-sm">{student.name}</td>
                      <td className="px-2 md:px-4 py-3 hidden md:table-cell text-xs md:text-sm">{student.class}</td>
                      <td className="px-2 md:px-4 py-3 text-muted-foreground text-xs md:text-sm">{new Date(record.checkInTime).toLocaleTimeString()}</td>
                      <td className="px-2 md:px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">{fingerprintStatus}</span>
                      </td>
                      <td className="px-2 md:px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 md:px-3 py-1 rounded-full text-xs font-medium ${
                            record.status === 'PRESENT'
                              ? 'bg-secondary/20 text-secondary'
                              : record.status === 'LATE'
                                ? 'bg-accent/20 text-accent'
                                : 'bg-destructive/20 text-destructive'
                          }`}
                        >
                          {record.status.charAt(0) + record.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-2 md:px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" className="text-xs">{expandedStudent === record.id ? '−' : '+'}</Button>
                      </td>
                    </tr>
                    {expandedStudent === record.id && (
                      <tr className="bg-muted/30 border-b border-border/50">
                        <td colSpan={7} className="px-2 md:px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                            <div>
                              <h4 className="font-semibold text-sm md:text-base text-foreground mb-3">Fingerprint Details</h4>
                              <div className="space-y-2 text-xs md:text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Match Quality:</span>
                                  <span className="font-medium">{record.reliability ?? '—'}%</span>
                                </div>
                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-secondary" style={{ width: `${record.reliability || 0}%` }} />
                                </div>
                                <div className="flex justify-between mt-2">
                                  <span className="text-muted-foreground">Status:</span>
                                  <span className="text-secondary font-medium">{fingerprintStatus}</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm md:text-base text-foreground mb-3">Today's Summary</h4>
                              <div className="space-y-2 text-xs md:text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">Check-in:</span><span className="font-medium">{new Date(record.checkInTime).toLocaleTimeString()}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Duration:</span><span className="font-medium">—</span></div>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm md:text-base text-foreground mb-3">Recent History</h4>
                              <div className="space-y-2 text-xs">
                                {(studentHistory[student.studentId] || []).slice(0,4).map((record, idx) => (
                                  <div key={idx} className="flex justify-between items-center">
                                    <span className="text-muted-foreground">{new Date(record.checkInTime).toLocaleDateString()}</span>
                                    <span className={`px-2 py-1 rounded text-xs ${record.status === 'PRESENT' ? 'bg-secondary/20 text-secondary' : record.status === 'LATE' ? 'bg-accent/20 text-accent' : 'bg-destructive/20 text-destructive'}`}>{record.status.toLowerCase()}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Daily Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <Card className="border-border">
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="text-lg md:text-base">Peak Check-in Times</CardTitle>
            <CardDescription className="text-xs md:text-sm">When students checked in today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {peakSlots.length === 0 && (
                <div className="text-xs md:text-sm text-muted-foreground">No check-ins in defined morning window.</div>
              )}
              {peakSlots.map((slot, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs md:text-sm">
                    <span className="text-foreground">{slot.time}</span>
                    <span className="font-medium">{slot.count} {slot.count === 1 ? 'student' : 'students'}</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${slot.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="text-lg md:text-base">Late Arrivals</CardTitle>
            <CardDescription className="text-xs md:text-sm">Students who arrived after 8:30 AM</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lateArrivals.length === 0 && (
                <div className="text-xs md:text-sm text-muted-foreground">No late arrivals after 08:30.</div>
              )}
              {lateArrivals.map((student, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-muted/30 border border-border/50"
                >
                  <span className="text-xs md:text-sm font-medium text-foreground">{student.name}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {student.time}
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

function StatCard({ label, value, highlight, icon }: any) {
  const colorClass =
    {
      secondary: "text-secondary",
      destructive: "text-destructive",
      accent: "text-accent",
    }[highlight || "primary"] || "text-primary"

  return (
    <Card className="border-border">
      <CardContent className="p-3 md:p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs md:text-sm text-muted-foreground font-medium">{label}</p>
            <p className={`text-lg md:text-3xl font-bold mt-2 ${colorClass}`}>{value}</p>
          </div>
          <div className={`${colorClass} opacity-60`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

"use client"

import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { StudentsAPI } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useRouter } from 'next/navigation'

export default function StudentsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [error, setError] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      const data = await StudentsAPI.list({ class: classFilter === 'all' ? undefined : classFilter, search: search || undefined })
      setStudents(data as any[])
    } catch (e: any) {
      setError(e?.message || 'Failed to load students')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t) }, [search, classFilter])

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">Students</h1>
            <p className="text-sm text-muted-foreground">Manage enrolled students and fingerprint data.</p>
          </div>
          <Button className="bg-primary" onClick={() => router.push('/students/add')}>Add Student</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Search and narrow down results</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium mb-1 block">Search</label>
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or ID" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Class</label>
                <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm">
                  <option value="all">All</option>
                  <option value="10-A">10-A</option>
                  <option value="10-B">10-B</option>
                  <option value="10-C">10-C</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" className="bg-transparent w-full" onClick={() => {setSearch(''); setClassFilter('all')}}>Reset</Button>
              </div>
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Student List</CardTitle>
            <CardDescription>{loading ? 'Loading...' : `${students.length} students found`}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-2">Student ID</th>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Class</th>
                    <th className="text-left p-2">Fingerprint</th>
                    <th className="text-left p-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && students.map(s => (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="p-2 text-muted-foreground">{s.studentId}</td>
                          <td className="p-2 font-medium">{s.name}</td>
                          <td className="p-2">{s.class}</td>
                          <td className="p-2 text-xs">{s.fingerprintData ? 'Enrolled' : '—'}</td>
                          <td className="p-2 text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</td>
                          <td className="p-2 text-right">
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="outline" onClick={() => router.push(`/students/${s.id}/edit`)}>Edit</Button>
                              <Button size="sm" variant="destructive" onClick={async () => {
                                if (!confirm('Delete this student?')) return;
                                try {
                                  await StudentsAPI.delete(s.id)
                                  load()
                                } catch (e: any) { alert(e?.message || 'Failed to delete') }
                              }}>Delete</Button>
                            </div>
                          </td>
                        </tr>
                  ))}
                  {loading && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Loading...</td></tr>}
                  {!loading && students.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No students found.</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

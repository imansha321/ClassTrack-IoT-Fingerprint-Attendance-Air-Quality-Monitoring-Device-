"use client"

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { StudentsAPI } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function EditStudentPage() {
  const router = useRouter()
  const pathname = usePathname()
  const id = pathname.split('/').slice(-2)[0]

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ studentId: '', name: '', class: '', fingerprintData: '' })

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const s = await StudentsAPI.get(id)
        if (!active) return
        setForm({ studentId: s.studentId, name: s.name, class: s.class || '', fingerprintData: s.fingerprintData || '' })
      } catch (e: any) {
        setError(e?.message || 'Failed to load student')
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
      await StudentsAPI.update(id, { name: form.name, class: form.class, fingerprintData: form.fingerprintData || undefined })
      router.push('/students')
    } catch (err: any) {
      setError(err?.message || 'Failed to update student')
    } finally { setSaving(false) }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 space-y-6">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Edit Student</CardTitle>
            <CardDescription>Modify student details and fingerprint data.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium mb-1 block">Student ID</label>
                  <Input name="studentId" value={form.studentId} readOnly />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Name</label>
                  <Input name="name" value={form.name} onChange={onChange} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Class</label>
                  <Input name="class" value={form.class} onChange={onChange} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Fingerprint Data (optional)</label>
                  <Input name="fingerprintData" value={form.fingerprintData} onChange={onChange} />
                </div>
                {error && <div className="text-xs text-destructive">{error}</div>}
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving} className="bg-primary">{saving ? 'Saving...' : 'Save'}</Button>
                  <Button type="button" variant="outline" className="bg-transparent" onClick={() => router.push('/students')}>Cancel</Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

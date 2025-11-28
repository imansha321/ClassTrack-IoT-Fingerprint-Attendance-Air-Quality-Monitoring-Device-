"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { StudentsAPI } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function AddStudentPage() {
  const router = useRouter()
  const [form, setForm] = useState({ studentId: '', name: '', class: '', fingerprintData: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onChange = (e: any) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async (e: any) => {
    e.preventDefault()
    setError('')
    if (!form.studentId || !form.name || !form.class) {
      setError('Student ID, name and class are required')
      return
    }
    try {
      setLoading(true)
      await StudentsAPI.create({ studentId: form.studentId, name: form.name, class: form.class, fingerprintData: form.fingerprintData || undefined })
      router.push('/students')
    } catch (err: any) {
      setError(err?.message || 'Failed to create student')
    } finally { setLoading(false) }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 space-y-6">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Add Student</CardTitle>
            <CardDescription>Register a new student entry.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-xs font-medium mb-1 block">Student ID</label>
                <Input name="studentId" value={form.studentId} onChange={onChange} placeholder="STU0001" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Name</label>
                <Input name="name" value={form.name} onChange={onChange} placeholder="Student Name" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Class</label>
                <Input name="class" value={form.class} onChange={onChange} placeholder="10-A" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Fingerprint Data (optional)</label>
                <Input name="fingerprintData" value={form.fingerprintData} onChange={onChange} placeholder="FP template" />
              </div>
              {error && <div className="text-xs text-destructive">{error}</div>}
              <div className="flex gap-2">
                <Button type="submit" disabled={loading} className="bg-primary">{loading ? 'Saving...' : 'Save'}</Button>
                <Button type="button" variant="outline" className="bg-transparent" onClick={() => router.push('/students')}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

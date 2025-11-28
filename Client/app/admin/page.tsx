"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-context"
import { AdminAPI } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Sidebar } from "@/components/sidebar"

interface UserRow {
  id: string
  email: string
  fullName: string
  schoolName: string
  role: "ADMIN" | "TEACHER" | "STAFF"
  createdAt: string
}

export default function AdminPage() {
  const { isAuthenticated, user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserRow[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
      return
    }
    if (user?.role !== "ADMIN") {
      router.push("/")
      return
    }
    (async () => {
      try {
        setLoading(true)
        const data = await AdminAPI.listUsers()
        setUsers(data as UserRow[])
      } catch (e: any) {
        setError(e?.message || "Failed to load users")
      } finally {
        setLoading(false)
      }
    })()
  }, [isAuthenticated, user, router])

  const onChangeRole = async (id: string, role: UserRow["role"]) => {
    const prev = users
    try {
      setUsers((curr) => curr.map((u) => (u.id === id ? { ...u, role } : u)))
      await AdminAPI.updateUserRole(id, role)
    } catch (e) {
      setUsers(prev)
      setError("Failed to update role")
    }
  }

  const onDelete = async (id: string) => {
    const prev = users
    try {
      setUsers((curr) => curr.filter((u) => u.id !== id))
      await AdminAPI.deleteUser(id)
    } catch (e) {
      setUsers(prev)
      setError("Failed to delete user")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background flex-col lg:flex-row">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Admin - User Management</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm border border-red-200">{error}</div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3">Name</th>
                    <th className="text-left p-3">Email</th>
                    <th className="text-left p-3">School</th>
                    <th className="text-left p-3">Role</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border/50">
                      <td className="p-3 font-medium">{u.fullName}</td>
                      <td className="p-3 text-muted-foreground">{u.email}</td>
                      <td className="p-3 text-muted-foreground">{u.schoolName}</td>
                      <td className="p-3">
                        <select
                          className="border border-border rounded px-2 py-1 bg-background"
                          value={u.role}
                          onChange={(e) => onChangeRole(u.id, e.target.value as any)}
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="TEACHER">TEACHER</option>
                          <option value="STAFF">STAFF</option>
                        </select>
                      </td>
                      <td className="p-3 text-right">
                        <Button variant="outline" className="bg-transparent" onClick={() => onDelete(u.id)}>
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

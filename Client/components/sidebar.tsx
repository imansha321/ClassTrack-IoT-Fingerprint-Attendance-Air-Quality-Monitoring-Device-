"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { BarChart3, Users, Wind, Cpu, FileText, Home, LogOut, Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-context"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const links = [
    { href: "/", label: "Dashboard", icon: Home },
    { href: "/attendance", label: "Attendance", icon: Users },
    { href: "/students", label: "Students", icon: Users },
    { href: "/air-quality", label: "Air Quality", icon: Wind },
    { href: "/devices", label: "Devices", icon: Cpu },
    { href: "/reports", label: "Reports", icon: FileText },
      ...(user?.role === 'ADMIN' ? [{ href: "/admin", label: "Admin", icon: BarChart3 }] : []),
    ]

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sidebar-primary rounded-lg flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-sidebar-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold">ClassTrack</h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {links.map((link) => {
          const Icon = link.icon
          const isActive = pathname === link.href

          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50",
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{link.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-sidebar-border space-y-3">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-sidebar-accent/20">
          <div className="w-8 h-8 bg-sidebar-primary rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-sidebar-primary-foreground">
              {user?.fullName?.charAt(0)?.toUpperCase() || "U"}
            </span>
          </div>
          <div className="text-sm min-w-0">
            <p className="font-medium truncate">{user?.fullName || "User"}</p>
            <p className="text-xs opacity-70 truncate">{user?.role || "STAFF"}</p>
          </div>
        </div>

        <Button onClick={handleLogout} variant="outline" className="w-full justify-start bg-transparent">
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-border bg-sidebar text-sidebar-foreground flex-col h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile Menu Button and Drawer */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <h1 className="text-lg font-bold">ClassTrack</h1>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsMobileOpen(!isMobileOpen)} className="lg:hidden">
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 bg-black/50 lg:hidden z-40" onClick={() => setIsMobileOpen(false)} />
      )}

      {/* Mobile Drawer */}
      <aside
        className={cn(
          "fixed top-16 left-0 bottom-0 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border transform transition-transform lg:hidden z-40",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarContent />
      </aside>
    </>
  )
}

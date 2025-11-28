"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { AuthAPI } from "@/lib/api"

interface User {
  id: string
  email: string
  fullName: string
  schoolName: string
  role: "ADMIN" | "TEACHER" | "STAFF"
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (fullName: string, email: string, schoolName: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedUser = typeof window !== "undefined" ? localStorage.getItem("classtrack:user") : null
      if (storedUser) {
        setUser(JSON.parse(storedUser))
      }
    } catch {}
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const { user, token } = await AuthAPI.login(email, password)
      if (typeof window !== "undefined") {
        localStorage.setItem("classtrack:token", token)
        localStorage.setItem("classtrack:user", JSON.stringify(user))
      }
      setUser(user)
    } finally {
      setIsLoading(false)
    }
  }

  const signup = async (fullName: string, email: string, schoolName: string, password: string) => {
    setIsLoading(true)
    try {
      const { user, token } = await AuthAPI.signup(fullName, email, schoolName, password)
      if (typeof window !== "undefined") {
        localStorage.setItem("classtrack:token", token)
        localStorage.setItem("classtrack:user", JSON.stringify(user))
      }
      setUser(user)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("classtrack:token")
      localStorage.removeItem("classtrack:user")
    }
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}

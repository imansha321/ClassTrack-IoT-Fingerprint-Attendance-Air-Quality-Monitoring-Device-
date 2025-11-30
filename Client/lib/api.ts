export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("classtrack:token");
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const token = getAuthToken();

  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    // Unauthorized: clear token
    if (typeof window !== "undefined") {
      localStorage.removeItem("classtrack:token");
      localStorage.removeItem("classtrack:user");
    }
  }

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const err = await res.json();
      message = err.error || err.message || message;
    } catch {}
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export const AuthAPI = {
  async login(email: string, password: string) {
    return apiFetch<{ user: any; token: string }>(`/api/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  async signup(fullName: string, email: string, schoolName: string, password: string) {
    return apiFetch<{ user: any; token: string }>(`/api/auth/signup`, {
      method: "POST",
      body: JSON.stringify({ fullName, email, schoolName, password }),
    });
  },
};

export const DashboardAPI = {
  stats() {
    return apiFetch(`/api/dashboard/stats`);
  },
  weeklyAttendance() {
    return apiFetch(`/api/dashboard/attendance/weekly`);
  },
  classrooms() {
    return apiFetch(`/api/dashboard/classrooms`);
  },
};

export const AlertsAPI = {
  list(params?: { resolved?: boolean; severity?: string; type?: string }) {
    const qs = new URLSearchParams();
    if (params?.resolved !== undefined) qs.set("resolved", String(params.resolved));
    if (params?.severity) qs.set("severity", params.severity);
    if (params?.type) qs.set("type", params.type);
    const query = qs.toString();
    return apiFetch(`/api/alerts${query ? `?${query}` : ""}`);
  },
};

export const DevicesAPI = {
  list(params?: { status?: string }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    const query = qs.toString();
    return apiFetch(`/api/devices${query ? `?${query}` : ""}`);
  },
  create(data: { deviceId: string; name: string; type: 'FINGERPRINT_SCANNER' | 'MULTI_SENSOR' | 'AIR_QUALITY_SENSOR'; location: string; firmwareVersion?: string }) {
    return apiFetch(`/api/devices`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  get(id: string) {
    return apiFetch(`/api/devices/${encodeURIComponent(id)}`);
  },
  update(id: string, data: { name?: string; location?: string; status?: string; battery?: number; signal?: number; firmwareVersion?: string }) {
    return apiFetch(`/api/devices/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  delete(id: string) {
    return apiFetch(`/api/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  provision(data: { deviceId: string }) {
    return apiFetch<{ deviceToken: string }>(`/api/devices/provision`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export const AdminAPI = {
  listUsers() {
    return apiFetch(`/api/admin/users`);
  },
  updateUserRole(id: string, role: 'ADMIN' | 'TEACHER' | 'STAFF') {
    return apiFetch(`/api/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },
  deleteUser(id: string) {
    return apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
  },
};

export const StudentsAPI = {
  list(params?: { class?: string; search?: string }) {
    const qs = new URLSearchParams();
    if (params?.class) qs.set('class', params.class);
    if (params?.search) qs.set('search', params.search);
    const query = qs.toString();
    return apiFetch(`/api/students${query ? `?${query}` : ''}`);
  },
  create(data: { studentId: string; name: string; class: string; fingerprintData?: string }) {
    return apiFetch(`/api/students`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  get(id: string) {
    return apiFetch(`/api/students/${encodeURIComponent(id)}`);
  },
  update(id: string, data: { name?: string; class?: string; fingerprintData?: string }) {
    return apiFetch(`/api/students/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  delete(id: string) {
    return apiFetch(`/api/students/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};

export const AttendanceAPI = {
  list(params?: { date?: string; class?: string }) {
    const qs = new URLSearchParams();
    if (params?.date) qs.set('date', params.date);
    if (params?.class) qs.set('class', params.class);
    const query = qs.toString();
    return apiFetch(`/api/attendance${query ? `?${query}` : ''}`);
  },
  stats(params?: { startDate?: string; endDate?: string }) {
    const qs = new URLSearchParams();
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    const query = qs.toString();
    return apiFetch(`/api/attendance/stats${query ? `?${query}` : ''}`);
  },
  studentHistory(studentId: string, limit = 10) {
    const qs = new URLSearchParams();
    if (limit) qs.set('limit', String(limit));
    return apiFetch(`/api/attendance/student/${encodeURIComponent(studentId)}${qs.toString() ? `?${qs.toString()}` : ''}`);
  }
};

export const AirQualityAPI = {
  list(params?: { room?: string; startDate?: string; endDate?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.room) qs.set('room', params.room);
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return apiFetch(`/api/airquality${query ? `?${query}` : ''}`);
  },
  rooms() {
    return apiFetch(`/api/airquality/rooms`);
  },
  stats(params?: { startDate?: string; endDate?: string }) {
    const qs = new URLSearchParams();
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    const query = qs.toString();
    return apiFetch(`/api/airquality/stats${query ? `?${query}` : ''}`);
  }
};

export const ReportsAPI = {
  attendance(params?: { startDate?: string; endDate?: string; class?: string }) {
    const qs = new URLSearchParams();
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    if (params?.class) qs.set('class', params.class);
    const query = qs.toString();
    return apiFetch(`/api/reports/attendance${query ? `?${query}` : ''}`);
  },
  airquality(params?: { startDate?: string; endDate?: string; room?: string }) {
    const qs = new URLSearchParams();
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    if (params?.room) qs.set('room', params.room);
    const query = qs.toString();
    return apiFetch(`/api/reports/airquality${query ? `?${query}` : ''}`);
  },
  devices() {
    return apiFetch(`/api/reports/devices`);
  }
};

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://167.71.235.91:5000";

const SCHOOL_CONTEXT_KEY = "classtrack:schoolId";

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("classtrack:token");
}

function getStoredSchoolId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SCHOOL_CONTEXT_KEY);
}

type ApiOptions = RequestInit & { skipSchoolContext?: boolean };

export type SignupPayload = {
  fullName: string
  email: string
  password: string
  schoolName?: string
  schoolId?: string
  role?: "PLATFORM_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "STAFF"
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const token = getAuthToken();
  const { skipSchoolContext, ...requestInit } = options;

  const headers = new Headers(requestInit.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const method = (requestInit.method || "GET").toUpperCase();
  const attachSchool = !skipSchoolContext;
  let requestUrl = url;

  if (attachSchool && method === "GET") {
    const schoolId = getStoredSchoolId();
    if (schoolId) {
      try {
        const parsed = new URL(url);
        if (!parsed.searchParams.has("schoolId")) {
          parsed.searchParams.set("schoolId", schoolId);
        }
        requestUrl = parsed.toString();
      } catch {
        requestUrl = url;
      }
    }
  }

  let body = requestInit.body;
  if (
    attachSchool &&
    body &&
    typeof body === "string" &&
    headers.get("Content-Type")?.includes("application/json")
  ) {
    try {
      const parsedBody = JSON.parse(body);
      if (parsedBody && parsedBody.schoolId === undefined) {
        const schoolId = getStoredSchoolId();
        if (schoolId) {
          parsedBody.schoolId = schoolId;
          body = JSON.stringify(parsedBody);
        }
      }
    } catch {
      // ignore malformed JSON bodies
    }
  }

  const res = await fetch(requestUrl, {
    ...requestInit,
    headers,
    body,
  });

  if (res.status === 401) {
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
  async signup(payload: SignupPayload) {
    return apiFetch<{ user: any; token: string }>(`/api/auth/signup`, {
      method: "POST",
      body: JSON.stringify(payload),
      skipSchoolContext: true,
    });
  },
  async schools() {
    return apiFetch<Array<{ id: string; name: string }>>(`/api/auth/schools`, { skipSchoolContext: true });
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
  list(params?: { status?: string; classroomId?: string }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.classroomId) qs.set('classroomId', params.classroomId);
    const query = qs.toString();
    return apiFetch(`/api/devices${query ? `?${query}` : ''}`);
  },
  create(data: { deviceId: string; name: string; type: 'FINGERPRINT_SCANNER' | 'MULTI_SENSOR' | 'AIR_QUALITY_SENSOR'; location: string; firmwareVersion?: string; classroomId?: string | null }) {
    return apiFetch(`/api/devices`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  get(id: string) {
    return apiFetch(`/api/devices/${encodeURIComponent(id)}`);
  },
  update(id: string, data: { name?: string; location?: string; status?: string; battery?: number; signal?: number; firmwareVersion?: string; classroomId?: string | null }) {
    return apiFetch(`/api/devices/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  delete(id: string) {
    return apiFetch(`/api/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  connect(data: { deviceId: string; name: string; type: 'FINGERPRINT_SCANNER' | 'MULTI_SENSOR' | 'AIR_QUALITY_SENSOR'; location: string; firmwareVersion?: string; classroomId?: string | null }) {
    return apiFetch(`/api/devices/connect`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export const AdminAPI = {
  listUsers() {
    return apiFetch(`/api/admin/users`);
  },
  updateUserRole(id: string, data: { role: 'PLATFORM_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'STAFF'; schoolId?: string | null }) {
    return apiFetch(`/api/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  deleteUser(id: string) {
    return apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
  },
  listSchools() {
    return apiFetch(`/api/admin/schools`);
  },
};

export const StudentsAPI = {
  list(params?: { class?: string; search?: string; classroomId?: string }) {
    const qs = new URLSearchParams();
    if (params?.class) qs.set('class', params.class);
    if (params?.search) qs.set('search', params.search);
    if (params?.classroomId) qs.set('classroomId', params.classroomId);
    const query = qs.toString();
    return apiFetch(`/api/students${query ? `?${query}` : ''}`);
  },
  create(data: { studentId: string; name: string; class: string; fingerprintData?: string; classroomId?: string | null }) {
    return apiFetch(`/api/students`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  get(id: string) {
    return apiFetch(`/api/students/${encodeURIComponent(id)}`);
  },
  update(id: string, data: { name?: string; class?: string; fingerprintData?: string; classroomId?: string | null }) {
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
  list(params?: { date?: string; class?: string; classroomId?: string }) {
    const qs = new URLSearchParams();
    if (params?.date) qs.set('date', params.date);
    if (params?.class) qs.set('class', params.class);
    if (params?.classroomId) qs.set('classroomId', params.classroomId);
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

export const ClassroomsAPI = {
  list() {
    return apiFetch(`/api/classrooms`);
  },
  create(data: { name: string; grade?: string; section?: string; capacity?: number }) {
    return apiFetch(`/api/classrooms`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  teachers() {
    return apiFetch<Array<{ id: string; fullName: string | null; email: string | null }>>(`/api/classrooms/teachers`);
  },
  assignTeacher(id: string, teacherId: string) {
    return apiFetch(`/api/classrooms/${encodeURIComponent(id)}/teachers`, {
      method: 'POST',
      body: JSON.stringify({ teacherId }),
    });
  },
  removeTeacher(id: string, teacherId: string) {
    return apiFetch(`/api/classrooms/${encodeURIComponent(id)}/teachers/${encodeURIComponent(teacherId)}`, {
      method: 'DELETE',
    });
  },
  delete(id: string) {
    return apiFetch(`/api/classrooms/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
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

export const FingerprintAPI = {
  requestEnrollment(data: { studentId: string; classroomId?: string; deviceId: string }) {
    return apiFetch(`/api/fingerprint/enrollments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  getEnrollment(id: string) {
    return apiFetch(`/api/fingerprint/enrollments/${encodeURIComponent(id)}`);
  },
  listEnrollments(params?: { status?: string; classroomId?: string; studentId?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.classroomId) qs.set('classroomId', params.classroomId);
    if (params?.studentId) qs.set('studentId', params.studentId);
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return apiFetch(`/api/fingerprint/enrollments${query ? `?${query}` : ''}`);
  },
};

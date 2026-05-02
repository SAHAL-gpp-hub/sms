// frontend/src/services/api.js — Updated with complete adminAPI
import axios from 'axios'
import { getToken, clearToken } from './auth'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(config => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response && err.response.status === 401) {
      clearToken()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (email, password) => {
    const form = new URLSearchParams()
    form.append('username', email)
    form.append('password', password)
    return api.post('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  },
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
}

// ── Students ──────────────────────────────────────────────────────────────────
export const studentAPI = {
  list:   (params) => api.get('/students/', { params }),
  get:    (id)     => api.get(`/students/${id}`),
  create: (data)   => api.post('/students/', data),
  update: (id, data) => api.put(`/students/${id}`, data),
  delete: (id)     => api.delete(`/students/${id}`),
}

// ── Fees ──────────────────────────────────────────────────────────────────────
export const feeAPI = {
  getFeeHeads:       ()     => api.get('/fees/heads'),
  createFeeHead:     (data) => api.post('/fees/heads', data),
  seedFeeHeads:      ()     => api.post('/fees/heads/seed'),
  getFeeStructures:  (params) => api.get('/fees/structure', { params }),
  getFeeStructure:   (id)   => api.get(`/fees/structure/${id}`),
  createFeeStructure:(data) => api.post('/fees/structure', data),
  deleteFeeStructure:(id)   => api.delete(`/fees/structure/${id}`),
  assignFees: (classId, academicYearId) =>
    api.post(`/fees/assign/${classId}?academic_year_id=${academicYearId}`),
  getLedger:  (studentId) => api.get(`/fees/ledger/${studentId}`),
  recordPayment: (data)   => api.post('/fees/payment', data),
  getPayments:   (studentId) => api.get(`/fees/payments/${studentId}`),
  getDefaulters: (params) => api.get('/fees/defaulters', { params }),
}

// ── Marks ─────────────────────────────────────────────────────────────────────
export const marksAPI = {
  getSubjects: (classId, includeInactive = false) =>
    api.get('/marks/subjects', {
      params: { class_id: classId, include_inactive: includeInactive ? 'true' : 'false' },
    }),
  createSubject: (data) => api.post('/marks/subjects', {
    ...data,
    class_id:      parseInt(data.class_id),
    max_theory:    parseInt(data.max_theory) || 100,
    max_practical: parseInt(data.max_practical) || 0,
  }),
  updateSubject: (id, data) => {
    const payload = { ...data }
    if (payload.max_theory    != null) payload.max_theory    = parseInt(payload.max_theory)
    if (payload.max_practical != null) payload.max_practical = parseInt(payload.max_practical)
    return api.patch(`/marks/subjects/${id}`, payload)
  },
  deleteSubject:  (id)      => api.delete(`/marks/subjects/${id}`),
  seedSubjects:   (classId) => api.post(`/marks/subjects/seed/${classId}`),

  getExams: (params) => api.get('/marks/exams', { params }),
  createExam: (data) => api.post('/marks/exams', {
    ...data,
    class_id:         parseInt(data.class_id),
    academic_year_id: parseInt(data.academic_year_id),
  }),
  deleteExam: (id) => api.delete(`/marks/exams/${id}`),

  getExamConfigs:  (examId)          => api.get(`/marks/exams/${examId}/configs`),
  setExamConfigs:  (examId, configs) => api.put(`/marks/exams/${examId}/configs`, { configs }),
  clearExamConfigs:(examId)          => api.delete(`/marks/exams/${examId}/configs`),

  getMarksEntry: (examId, classId) =>
    api.get('/marks/entry', { params: { exam_id: examId, class_id: classId } }),
  bulkSaveMarks: (entries) => api.post('/marks/bulk', entries),
  getResults: (examId, classId) =>
    api.get('/marks/results', { params: { exam_id: examId, class_id: classId } }),
}

// ── Attendance ────────────────────────────────────────────────────────────────
export const attendanceAPI = {
  getDaily: (classId, date) =>
    api.get('/attendance/daily', { params: { class_id: classId, date } }),
  markBulk: (entries) =>
    api.post('/attendance/bulk', { entries }),
  getMonthlySummary: (classId, year, month) =>
    api.get('/attendance/monthly', { params: { class_id: classId, year, month } }),
  getDashboardStats: () => api.get('/attendance/dashboard-stats'),
}

// ── Year-End ──────────────────────────────────────────────────────────────────
export const yearendAPI = {
  previewPromotion: (classId, newYearId) =>
    api.get(`/yearend/promote/${classId}/preview?new_academic_year_id=${newYearId}`),
  promoteClass: (classId, newYearId) =>
    api.post(`/yearend/promote/${classId}?new_academic_year_id=${newYearId}`),
  createNewYear: (data)   => api.post('/yearend/new-year', data),
  issueTC:       (studentId) => api.post(`/yearend/issue-tc/${studentId}`),
  getCurrentYear:()       => api.get('/yearend/current-year'),
  getYears:      ()       => api.get('/yearend/years'),
  getAllYears:    ()       => api.get('/yearend/years'),
  tcPdfUrl: (studentId, reason = "Parent's Request", conduct = 'Good') =>
    `/api/v1/yearend/tc-pdf/${studentId}?reason=${encodeURIComponent(reason)}&conduct=${encodeURIComponent(conduct)}`,
}

// ── Admin / Users ─────────────────────────────────────────────────────────────
export const adminAPI = {
  // User CRUD
  listUsers:     (params) => api.get('/admin/users', { params }),
  getUser:       (id)     => api.get(`/admin/users/${id}`),
  createUser:    (data)   => api.post('/admin/users', data),
  updateUser:    (id, data) => api.put(`/admin/users/${id}`, data),
  resetPassword: (id, newPassword) =>
    api.post(`/admin/users/${id}/reset-password`, { new_password: newPassword }),
  deleteUser:    (id)     => api.delete(`/admin/users/${id}`),

  // Teacher class assignments
  listTeacherAssignments: (teacherId) =>
    api.get(`/admin/teachers/${teacherId}/assignments`),
  assignTeacherClass: (teacherId, data) =>
    api.post(`/admin/teachers/${teacherId}/assign-class`, data),
  removeTeacherClass: (teacherId, classId, params = {}) =>
    api.delete(`/admin/teachers/${teacherId}/assign-class/${classId}`, { params }),

  // Portal linking
  linkStudent:       (data) => api.post('/admin/portal/link-student', data),
  listPortalAccounts:()     => api.get('/admin/portal/accounts'),
}

// ── Setup ─────────────────────────────────────────────────────────────────────
export const setupAPI = {
  seed:             ()               => api.post('/setup/seed'),
  getClasses:       (academicYearId) => api.get('/setup/classes', {
    params: academicYearId ? { academic_year_id: academicYearId } : {},
  }),
  getAcademicYears: () => api.get('/setup/academic-years'),
}

// ── Classes ───────────────────────────────────────────────────────────────────
export const classAPI = {
  create: (data) => api.post('/setup/classes', data),
  delete: (id)   => api.delete(`/setup/classes/${id}`),
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export const formatINR = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0)

export const extractError = (err) => {
  if (!err || !err.response) return 'Network error — is the backend running?'
  const detail = err.response?.data?.detail
  if (!detail) {
    if (err.response?.data?.message) return err.response.data.message
    if (err.response?.statusText)    return `${err.response.status}: ${err.response.statusText}`
    return 'Something went wrong. Please try again.'
  }
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map(d => {
        if (!d) return null
        if (d.msg) {
          const loc = d.loc?.length ? `${d.loc[d.loc.length - 1]}: ` : ''
          return `${loc}${d.msg}`
        }
        if (d.message) return d.message
        return JSON.stringify(d)
      })
      .filter(Boolean)
      .join('; ')
  }
  if (typeof detail === 'object' && detail.msg) return detail.msg
  return JSON.stringify(detail)
}

export default api
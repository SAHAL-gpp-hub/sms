// frontend/src/services/api.js
import axios from 'axios'
import { getToken, clearToken } from './auth'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

export async function openSignedPdf(tokenPath, pdfPath, params = {}) {
  const { data } = await api.get(tokenPath, { params })
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })
  query.set('token', data.token)
  window.open(`/api/v1${pdfPath}?${query.toString()}`, '_blank', 'noopener,noreferrer')
}

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
  me:       ()     => api.get('/auth/me'),
  logout:   ()     => api.post('/auth/logout'),
}

// ── Students ──────────────────────────────────────────────────────────────────
export const studentAPI = {
  list:   (params)     => api.get('/students/', { params }),
  get:    (id)         => api.get(`/students/${id}`),
  create: (data)       => api.post('/students/', data),
  update: (id, data)   => api.put(`/students/${id}`, data),
  delete: (id)         => api.delete(`/students/${id}`),
}

// ── Fees ──────────────────────────────────────────────────────────────────────
export const feeAPI = {
  getFeeHeads:        ()       => api.get('/fees/heads'),
  createFeeHead:      (data)   => api.post('/fees/heads', data),
  seedFeeHeads:       ()       => api.post('/fees/heads/seed'),
  getFeeStructures:   (params) => api.get('/fees/structure', { params }),
  getFeeStructure:    (id)     => api.get(`/fees/structure/${id}`),
  createFeeStructure: (data)   => api.post('/fees/structure', data),
  deleteFeeStructure: (id)     => api.delete(`/fees/structure/${id}`),
  assignFees: (classId, academicYearId) =>
    api.post(`/fees/assign/${classId}?academic_year_id=${academicYearId}`),
  getLedger:     (studentId) => api.get(`/fees/ledger/${studentId}`),
  recordPayment: (data)      => api.post('/fees/payment', data),
  getPayments:   (studentId) => api.get(`/fees/payments/${studentId}`),
  getDefaulters: (params)    => api.get('/fees/defaulters', { params }),
}

// ── Marks ─────────────────────────────────────────────────────────────────────
export const marksAPI = {
  getSubjects: (classId, includeInactive = false) =>
    api.get('/marks/subjects', {
      params: { class_id: classId, include_inactive: includeInactive ? 'true' : 'false' },
    }),
  createSubject:  (data) => api.post('/marks/subjects', {
    ...data,
    class_id:      parseInt(data.class_id),
    max_theory:    parseInt(data.max_theory) || 100,
    max_practical: parseInt(data.max_practical) || 0,
  }),
  updateSubject:  (id, data) => api.patch(`/marks/subjects/${id}`, data),
  deleteSubject:  (id)       => api.delete(`/marks/subjects/${id}`),
  seedSubjects:   (classId)  => api.post(`/marks/subjects/seed/${classId}`),

  getExams:   (params) => api.get('/marks/exams', { params }),
  createExam: (data)   => api.post('/marks/exams', {
    ...data,
    class_id:         parseInt(data.class_id),
    academic_year_id: parseInt(data.academic_year_id),
  }),
  deleteExam: (id) => api.delete(`/marks/exams/${id}`),

  getExamConfigs:   (examId)          => api.get(`/marks/exams/${examId}/configs`),
  setExamConfigs:   (examId, configs) => api.put(`/marks/exams/${examId}/configs`, { configs }),
  clearExamConfigs: (examId)          => api.delete(`/marks/exams/${examId}/configs`),

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

// ── Year-End (full rebuild) ────────────────────────────────────────────────────
export const yearendAPI = {
  // Academic year lifecycle
  createNewYear:  (data)    => api.post('/yearend/new-year', data),
  activateYear:   (yearId, skipValidation = false) =>
    api.post(`/yearend/activate/${yearId}`, { skip_validation: skipValidation }),
  getCurrentYear: ()        => api.get('/yearend/current-year'),
  getYears:       ()        => api.get('/yearend/years'),
  getAllYears:     ()        => api.get('/yearend/years'),

  // Promotion workflow
  validatePromotion: (classId, newYearId) =>
    api.get(`/yearend/promote/${classId}/validate`, {
      params: { new_academic_year_id: newYearId },
    }),
  getCandidates: (classId) =>
    api.get(`/yearend/promote/${classId}/candidates`),
  previewPromotion: (classId, newYearId) =>
    api.get(`/yearend/promote/${classId}/preview`, {
      params: { new_academic_year_id: newYearId },
    }),
  promoteClass: (classId, payload) =>
    api.post(`/yearend/promote/${classId}`, payload),
  // payload: { new_academic_year_id, student_actions, roll_strategy, force }
  undoPromotion: (classId, newYearId) =>
    api.post(`/yearend/promote/${classId}/undo`, { new_academic_year_id: newYearId }),

  // Year-end operations
  lockMarks:     (academicYearId) =>
    api.post('/yearend/lock-marks', { academic_year_id: academicYearId }),
  cloneFees:     (fromYearId, toYearId) =>
    api.post('/yearend/clone-fees', { from_year_id: fromYearId, to_year_id: toYearId }),
  cloneSubjects: (fromYearId, toYearId) =>
    api.post('/yearend/clone-subjects', { from_year_id: fromYearId, to_year_id: toYearId }),
  issueTC:       (studentId)   => api.post(`/yearend/issue-tc/${studentId}`),
  backfillEnrollments: ()      => api.post('/yearend/backfill-enrollments'),

  // Calendar
  getCalendar:       (yearId, eventType) =>
    api.get(`/yearend/calendar/${yearId}`, { params: eventType ? { event_type: eventType } : {} }),
  addCalendarEvent:  (yearId, data) => api.post(`/yearend/calendar/${yearId}`, data),
  updateCalendarEvent: (eventId, data) => api.put(`/yearend/calendar/event/${eventId}`, data),
  deleteCalendarEvent: (eventId)      => api.delete(`/yearend/calendar/event/${eventId}`),
  seedHolidays:      (yearId)         => api.post(`/yearend/calendar/${yearId}/seed-holidays`),

  // Audit
  getAuditLog: (params) => api.get('/yearend/audit-log', { params }),
  // params: { operation, academic_year_id, limit, offset }

  openTcPdf: (studentId, reason = "Parent's Request", conduct = 'Good') =>
    openSignedPdf(`/yearend/tc-pdf-token/${studentId}`, `/yearend/tc-pdf/${studentId}`, { reason, conduct }),
}

// ── Enrollments (new) ─────────────────────────────────────────────────────────
export const enrollmentsAPI = {
  list: (params) => api.get('/enrollments/', { params }),
  // params: { academic_year_id, class_id, status, student_id }

  getById:       (enrollmentId)         => api.get(`/enrollments/${enrollmentId}`),
  getHistory:    (studentId)            => api.get(`/enrollments/student/${studentId}`),
  getRollList:   (classId, academicYearId) =>
    api.get(`/enrollments/class/${classId}/roll-list`, {
      params: { academic_year_id: academicYearId },
    }),
  reassignRolls: (classId, academicYearId, strategy = 'alphabetical') =>
    api.post('/enrollments/reassign-rolls', {
      class_id: classId, academic_year_id: academicYearId, strategy,
    }),
}

// ── Admin / Users ─────────────────────────────────────────────────────────────
export const adminAPI = {
  listUsers:     (params) => api.get('/admin/users', { params }),
  getUser:       (id)     => api.get(`/admin/users/${id}`),
  createUser:    (data)   => api.post('/admin/users', data),
  updateUser:    (id, data) => api.put(`/admin/users/${id}`, data),
  resetPassword: (id, newPassword) =>
    api.post(`/admin/users/${id}/reset-password`, { new_password: newPassword }),
  deleteUser:    (id)     => api.delete(`/admin/users/${id}`),

  listTeacherAssignments: (teacherId) =>
    api.get(`/admin/teachers/${teacherId}/assignments`),
  assignTeacherClass: (teacherId, data) =>
    api.post(`/admin/teachers/${teacherId}/assign-class`, data),
  removeTeacherClass: (teacherId, classId, params = {}) =>
    api.delete(`/admin/teachers/${teacherId}/assign-class/${classId}`, { params }),

  linkStudent:        (data) => api.post('/admin/portal/link-student', data),
  listPortalAccounts: ()     => api.get('/admin/portal/accounts'),
}

// ── Portal ────────────────────────────────────────────────────────────────────
export const portalAPI = {
  getProfile:           (studentId) => api.get('/portal/me/profile',           { params: studentId ? { student_id: studentId } : {} }),
  getResults:           (studentId) => api.get('/portal/me/results',            { params: studentId ? { student_id: studentId } : {} }),
  getAttendance:        (studentId) => api.get('/portal/me/attendance',         { params: studentId ? { student_id: studentId } : {} }),
  getAttendanceSummary: (studentId) => api.get('/portal/me/attendance/summary', { params: studentId ? { student_id: studentId } : {} }),
  getFees:              (studentId) => api.get('/portal/me/fees',               { params: studentId ? { student_id: studentId } : {} }),
  getMarksheet: (examId, studentId) =>
    `/api/v1/portal/me/marksheet/${examId}${studentId ? `?student_id=${studentId}` : ''}`,

  // Parent multi-child
  getChildren:        ()    => api.get('/portal/me/children'),
  getChildProfile:    (sid) => api.get(`/portal/me/children/${sid}/profile`),
  getChildResults:    (sid) => api.get(`/portal/me/children/${sid}/results`),
  getChildFees:       (sid) => api.get(`/portal/me/children/${sid}/fees`),
  getChildAttendance: (sid) => api.get(`/portal/me/children/${sid}/attendance`),
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
    style: 'currency', currency: 'INR',
    minimumFractionDigits: 0, maximumFractionDigits: 2,
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

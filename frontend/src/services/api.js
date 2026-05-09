import axios from 'axios'
import { getToken, clearToken } from './auth'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

function createPdfLoadingWindow(title = 'Preparing PDF') {
  const popup = window.open('', '_blank')
  if (!popup) return null
  popup.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            font-family: system-ui, sans-serif;
            background: #f8fafc;
            color: #0f172a;
          }
          .wrap {
            text-align: center;
            padding: 24px;
          }
          .spinner {
            width: 40px;
            height: 40px;
            margin: 0 auto 16px;
            border: 3px solid #cbd5e1;
            border-top-color: #2563eb;
            border-radius: 999px;
            animation: spin 0.9s linear infinite;
          }
          .sub {
            margin-top: 8px;
            color: #64748b;
            font-size: 14px;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="spinner"></div>
          <div>${title}</div>
          <div class="sub">This may take a few seconds for larger files.</div>
        </div>
      </body>
    </html>
  `)
  popup.document.close()
  return popup
}

export async function openSignedPdf(tokenPath, pdfPath, params = {}) {
  const popup = createPdfLoadingWindow()
  try {
    const { data } = await api.get(tokenPath, { params })
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') query.set(key, value)
    })
    query.set('token', data.token)
    const url = `/api/v1${pdfPath}?${query.toString()}`
    if (popup) {
      popup.location.replace(url)
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  } catch (err) {
    if (popup && !popup.closed) popup.close()
    throw err
  }
}

export async function openProtectedPdf(path, params = {}, fallbackFileName = 'document.pdf') {
  const popup = createPdfLoadingWindow()
  try {
    const res = await api.get(path, { params, responseType: 'blob' })
    const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
    if (popup) {
      popup.location.replace(blobUrl)
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000)
    } else {
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = fallbackFileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(blobUrl)
    }
  } catch (err) {
    if (popup && !popup.closed) popup.close()
    throw err
  }
}

api.interceptors.request.use(config => {
  config.metadata = { startTime: performance.now() }
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

function logSlowRequest(config, prefix = 'request') {
  const started = config?.metadata?.startTime
  if (!started) return
  const duration = performance.now() - started
  if (duration > 500) {
    console.warn(`[perf] Slow ${prefix} (${duration.toFixed(1)}ms): ${config?.method?.toUpperCase()} ${config?.url}`)
  }
}

api.interceptors.response.use(
  res => {
    logSlowRequest(res.config, 'API request')
    return res
  },
  err => {
    logSlowRequest(err.config, 'failed API request')
    const url = err.config?.url || ''
    if (err.response && err.response.status === 401 && !url.startsWith('/student-auth')) {
      clearToken()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Current year cache ────────────────────────────────────────────────────────
// Fetched once per session so every getClasses() call can scope to the active
// year without each page needing to fetch the year list separately.
let _currentYearId = null
let _currentYearPromise = null

async function getCurrentYearId() {
  if (_currentYearId !== null && _currentYearId !== undefined) return _currentYearId
  // Deduplicate concurrent calls — only one request in flight at a time
  if (!_currentYearPromise) {
    _currentYearPromise = api.get('/yearend/current-year')
      .then(r => {
        _currentYearId = r.data?.id || null
        return _currentYearId
      })
      .catch(() => {
        // If the endpoint fails (e.g. no year set up yet), fall back to unfiltered
        return null
      })
  }
  return _currentYearPromise
}

// Call this after login / year activation to bust the cache
export function clearYearCache() {
  _currentYearId = null
  _currentYearPromise = null
}

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
  registerStatus: () => api.get('/auth/register-status'),
  me:       ()     => api.get('/auth/me'),
  logout:   ()     => api.post('/auth/logout'),
}

export const studentAuthAPI = {
  startActivation: (data) => api.post('/student-auth/start-activation', data),
  resendOtp:      (activationId) => api.post('/student-auth/resend-otp', { activation_id: activationId }),
  verifyOtp:      (activationId, otp) => api.post('/student-auth/verify-otp', { activation_id: activationId, otp }),
  completeRegistration: (activationToken, password) =>
    api.post('/student-auth/complete-registration', { activation_token: activationToken, password }),
}

// ── Students ──────────────────────────────────────────────────────────────────
export const studentAPI = {
  list:   (params)     => api.get('/students/', { params }),
  get:    (id)         => api.get(`/students/${id}`),
  create: (data)       => api.post('/students/', data),
  update: (id, data)   => api.put(`/students/${id}`, data),
  delete: (id)         => api.delete(`/students/${id}`),
  getTc: (id, params)  => openProtectedPdf(`/students/${id}/tc`, params, `TC_${id}.pdf`),
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
    api.post(`/fees/assign/${classId}`, null, {
      params: academicYearId != null && academicYearId !== ''
        ? { academic_year_id: academicYearId }
        : {},
    }),
  getLedger:     (studentId) => api.get(`/fees/ledger/${studentId}`),
  recordPayment: (data)      => api.post('/fees/payment', data),
  getPayments:   (studentId) => api.get(`/fees/payments/${studentId}`),
  getDefaulters: (params)    => api.get('/fees/defaulters', { params }),
}

// ── Marks ─────────────────────────────────────────────────────────────────────
export const marksAPI = {
  getSubjects: (classId, includeInactive = false) =>
    api.get('/marks/subjects', {
      params: { class_id: classId, include_inactive: Boolean(includeInactive) },
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
    api.get('/marks/entry', { params: { exam_id: parseInt(examId), class_id: parseInt(classId) } }),
  bulkSaveMarks: (entries) => api.post('/marks/bulk', entries),
  unlockMarks: (academicYearId) =>
    api.post('/marks/unlock', { academic_year_id: parseInt(academicYearId) }),
  getResults: (examId, classId) =>
    api.get('/marks/results', { params: { exam_id: parseInt(examId), class_id: parseInt(classId) } }),
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
  createNewYear:  (data)    => api.post('/yearend/new-year', data),
  activateYear:   (yearId, skipValidation = false) =>
    api.post(`/yearend/activate/${yearId}`, { skip_validation: skipValidation }),
  getCurrentYear: ()        => api.get('/yearend/current-year'),
  getYears:       ()        => api.get('/yearend/years'),
  getAllYears:     ()        => api.get('/yearend/years'),

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
  undoPromotion: (classId, newYearId) =>
    api.post(`/yearend/promote/${classId}/undo`, { new_academic_year_id: newYearId }),

  lockMarks:     (academicYearId) =>
    api.post('/yearend/lock-marks', { academic_year_id: academicYearId }),
  cloneFees:     (fromYearId, toYearId) =>
    api.post('/yearend/clone-fees', { from_year_id: fromYearId, to_year_id: toYearId }),
  cloneSubjects: (fromYearId, toYearId) =>
    api.post('/yearend/clone-subjects', { from_year_id: fromYearId, to_year_id: toYearId }),
  issueTC:       (studentId)   => api.post(`/yearend/issue-tc/${studentId}`),
  backfillEnrollments: ()      => api.post('/yearend/backfill-enrollments'),

  getCalendar:       (yearId, eventType) =>
    api.get(`/yearend/calendar/${yearId}`, { params: eventType ? { event_type: eventType } : {} }),
  addCalendarEvent:  (yearId, data) => api.post(`/yearend/calendar/${yearId}`, data),
  updateCalendarEvent: (eventId, data) => api.put(`/yearend/calendar/event/${eventId}`, data),
  deleteCalendarEvent: (eventId)      => api.delete(`/yearend/calendar/event/${eventId}`),
  seedHolidays:      (yearId)         => api.post(`/yearend/calendar/${yearId}/seed-holidays`),

  getAuditLog: (params) => api.get('/yearend/audit-log', { params }),

  openTcPdf: (studentId, reason = "Parent's Request", conduct = 'Good') =>
    openSignedPdf(`/yearend/tc-pdf-token/${studentId}`, `/yearend/tc-pdf/${studentId}`, { reason, conduct }),
}

// ── Enrollments ───────────────────────────────────────────────────────────────
export const enrollmentsAPI = {
  list: (params) => api.get('/enrollments/', { params }),
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

// ── Report Cards ─────────────────────────────────────────────────────────────
export const reportCardsAPI = {
  list: (params) => api.get('/report-cards', { params }),
  setLocked: (id, isLocked) => api.patch(`/report-cards/${id}`, { is_locked: isLocked }),
}

const validIdParam = (studentId) => (
  studentId !== undefined && studentId !== null && studentId !== ''
    ? { student_id: studentId }
    : {}
)

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

  // Auto-generation endpoints
  getLinkStatus:    (params) => api.get('/admin/portal/link-status', { params }),
  bulkGenerate:     (data)   => api.post('/admin/portal/bulk-generate', data),
  generateForStudent: (studentId, params) =>
    api.post(`/admin/portal/generate/${studentId}`, null, { params }),
  resendActivation: (studentId, accountType) =>
    api.post(`/admin/portal/resend-activation/${studentId}`, { account_type: accountType }),

  getOtpFailures: (params = {}) =>
    api.get('/admin/notifications/otp-failures', { params }),
}

// ── Portal ────────────────────────────────────────────────────────────────────
export const portalAPI = {
  getProfile:           (studentId) => api.get('/portal/me/profile',           { params: validIdParam(studentId) }),
  getResults:           (studentId) => api.get('/portal/me/results',            { params: validIdParam(studentId) }),
  getAttendance:        (studentId) => api.get('/portal/me/attendance',         { params: validIdParam(studentId) }),
  getAttendanceSummary: (studentId) => api.get('/portal/me/attendance/summary', { params: validIdParam(studentId) }),
  getFees:              (studentId) => api.get('/portal/me/fees',               { params: validIdParam(studentId) }),
  getMarksheet: (examId, studentId) =>
    api.get(`/portal/me/marksheet/${examId}`, {
      params: validIdParam(studentId),
      responseType: 'blob',
    }),

  getChildren:        ()    => api.get('/portal/me/children'),
  getChildProfile:    (sid) => api.get(`/portal/me/children/${sid}/profile`),
  getChildResults:    (sid) => api.get(`/portal/me/children/${sid}/results`),
  getChildFees:       (sid) => api.get(`/portal/me/children/${sid}/fees`),
  getChildAttendance: (sid) => api.get(`/portal/me/children/${sid}/attendance`),
}

// ── Online Payments ──────────────────────────────────────────────────────────
export const paymentAPI = {
  createOrder: (data) => api.post('/payments/create-order', data),
  verify:      (data) => api.post('/payments/verify', data),
  history:     (studentId) => api.get(`/payments/history/${studentId}`),
}

// ── Notifications ────────────────────────────────────────────────────────────
export const notificationAPI = {
  list: (params = {}) => api.get('/notifications', { params }),
  triggerFeeReminders: (academicYearId) =>
    api.post('/notifications/trigger/fee-reminders', null, {
      params: academicYearId ? { academic_year_id: academicYearId } : {},
    }),
  triggerLowAttendance: (data = {}) => api.post('/notifications/trigger/low-attendance', data),
  sendTest: (data) => api.post('/notifications/test', data),
}

// ── Setup ─────────────────────────────────────────────────────────────────────
export const setupAPI = {
  seed: () => api.post('/setup/seed'),

  /**
   * getClasses — always scopes to the current active academic year unless
   * an explicit academicYearId is passed. This prevents duplicate class
   * entries when multiple years exist (each year auto-creates 13 classes).
   *
   * Pass academicYearId explicitly when you intentionally want a different
   * year's classes (e.g. YearEnd clone operations, FeeStructure cross-year).
   */
  getClasses: async (academicYearId) => {
    // If caller specified a year, use it directly
    if (academicYearId !== undefined && academicYearId !== null && academicYearId !== '') {
      return api.get('/setup/classes', { params: { academic_year_id: academicYearId } })
    }
    // Otherwise scope to current year automatically
    const yearId = await getCurrentYearId()
    if (yearId) {
      return api.get('/setup/classes', { params: { academic_year_id: yearId } })
    }
    // No current year found — fall back to unfiltered (first-run / no year set up)
    return api.get('/setup/classes')
  },

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
          const loc = d.loc?.length ? `${d.loc.join('.')}: ` : ''
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

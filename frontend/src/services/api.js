import axios from 'axios'
import { getToken } from './auth'

const api = axios.create({
    baseURL: '/api/v1',
    headers: { 'Content-Type': 'application/json' }
})

// C-01 FIX: Attach Bearer token to every outgoing request
api.interceptors.request.use(config => {
    const token = getToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

export const authAPI = {
    login: (email, password) => {
        const form = new URLSearchParams()
        form.append('username', email)
        form.append('password', password)
        return api.post('/auth/login', form, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
    },
    register: (data) => api.post('/auth/register', data),
    me: () => api.get('/auth/me'),
}

export const studentAPI = {
    // M-01 FIX: list() now accepts limit/offset for pagination
    list: (params) => api.get('/students/', { params }),
    get: (id) => api.get(`/students/${id}`),
    create: (data) => api.post('/students/', data),
    update: (id, data) => api.put(`/students/${id}`, data),
    delete: (id) => api.delete(`/students/${id}`)
}

export const feeAPI = {
    // Fee Heads
    getFeeHeads: () => api.get('/fees/heads'),
    createFeeHead: (data) => api.post('/fees/heads', data),
    seedFeeHeads: () => api.post('/fees/heads/seed'),

    // Fee Structure
    getFeeStructures: (params) => api.get('/fees/structure', { params }),
    createFeeStructure: (data) => api.post('/fees/structure', data),
    deleteFeeStructure: (id) => api.delete(`/fees/structure/${id}`),

    // Assign fees to class
    assignFees: (classId, academicYearId) =>
        api.post(`/fees/assign/${classId}?academic_year_id=${academicYearId}`),

    // Ledger & Payments
    getLedger: (studentId) => api.get(`/fees/ledger/${studentId}`),
    recordPayment: (data) => api.post('/fees/payment', data),
    getPayments: (studentId) => api.get(`/fees/payments/${studentId}`),

    // Defaulters
    getDefaulters: (params) => api.get('/fees/defaulters', { params }),
}

export const marksAPI = {
    // Subjects
    getSubjects: (classId) => api.get('/marks/subjects', { params: { class_id: classId } }),
    createSubject: (data) => api.post('/marks/subjects', data),
    seedSubjects: (classId) => api.post(`/marks/subjects/seed/${classId}`),
    deleteSubject: (id) => api.delete(`/marks/subjects/${id}`),

    // Exams
    getExams: (params) => api.get('/marks/exams', { params }),
    createExam: (data) => api.post('/marks/exams', data),
    deleteExam: (id) => api.delete(`/marks/exams/${id}`),

    // Marks
    getMarksEntry: (examId, classId) => api.get('/marks/entry', { params: { exam_id: examId, class_id: classId } }),
    bulkSaveMarks: (entries) => api.post('/marks/bulk', entries),

    // Results
    getResults: (examId, classId) => api.get('/marks/results', { params: { exam_id: examId, class_id: classId } }),
}

export const pdfAPI = {
    studentMarksheet: (studentId, examId, classId) =>
        `/api/v1/pdf/marksheet/student/${studentId}?exam_id=${examId}&class_id=${classId}`,
    classMarksheet: (classId, examId) =>
        `/api/v1/pdf/marksheet/class/${classId}?exam_id=${examId}`,
}

export const attendanceAPI = {
    getDaily: (classId, date) =>
        api.get('/attendance/daily', { params: { class_id: classId, date } }),
    markBulk: (entries) =>
        api.post('/attendance/bulk', { entries }),
    getMonthlySummary: (classId, year, month) =>
        api.get('/attendance/monthly', { params: { class_id: classId, year, month } }),
    getDashboardStats: () =>
        api.get('/attendance/dashboard-stats'),
}

export const yearendAPI = {
    // C-02 FIX: preview endpoint for dry-run before promotion
    previewPromotion: (classId, newYearId) =>
        api.get(`/yearend/promote/${classId}/preview?new_academic_year_id=${newYearId}`),
    promoteClass: (classId, newYearId) =>
        api.post(`/yearend/promote/${classId}?new_academic_year_id=${newYearId}`),
    createNewYear: (data) => api.post('/yearend/new-year', data),
    issueTC: (studentId) => api.post(`/yearend/issue-tc/${studentId}`),
    tcPdfUrl: (studentId, reason, conduct) =>
        `/api/v1/yearend/tc-pdf/${studentId}?reason=${encodeURIComponent(reason)}&conduct=${encodeURIComponent(conduct)}`,
}

export const classAPI = {
    create: (data) => api.post('/setup/classes', data),
    delete: (id) => api.delete(`/setup/classes/${id}`),
}

export const setupAPI = {
    seed: () => api.post('/setup/seed'),
    getClasses: (academicYearId) => api.get('/setup/classes', {
        params: academicYearId ? { academic_year_id: academicYearId } : {}
    }),
    getAcademicYears: () => api.get('/setup/academic-years')
}

// M-02 FIX: Shared Indian currency formatter — use this everywhere instead of raw .toLocaleString()
export const formatINR = (amount) =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(Number(amount))

export default api
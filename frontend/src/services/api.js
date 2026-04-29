// api.js — Updated with subject CRUD and exam config endpoints
import axios from 'axios'
import { getToken, clearToken } from './auth'

const api = axios.create({
    baseURL: '/api/v1',
    headers: { 'Content-Type': 'application/json' }
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
    list: (params) => api.get('/students/', { params }),
    get: (id) => api.get(`/students/${id}`),
    create: (data) => api.post('/students/', data),
    update: (id, data) => api.put(`/students/${id}`, data),
    delete: (id) => api.delete(`/students/${id}`)
}

export const feeAPI = {
    getFeeHeads: () => api.get('/fees/heads'),
    createFeeHead: (data) => api.post('/fees/heads', data),
    seedFeeHeads: () => api.post('/fees/heads/seed'),
    getFeeStructures: (params) => api.get('/fees/structure', { params }),
    getFeeStructure: (id) => api.get(`/fees/structure/${id}`),
    createFeeStructure: (data) => api.post('/fees/structure', data),
    deleteFeeStructure: (id) => api.delete(`/fees/structure/${id}`),
    assignFees: (classId, academicYearId) =>
        api.post(`/fees/assign/${classId}?academic_year_id=${academicYearId}`),
    getLedger: (studentId) => api.get(`/fees/ledger/${studentId}`),
    recordPayment: (data) => api.post('/fees/payment', data),
    getPayments: (studentId) => api.get(`/fees/payments/${studentId}`),
    getDefaulters: (params) => api.get('/fees/defaulters', { params }),
}

export const marksAPI = {
    // Subjects
    getSubjects: (classId, includeInactive = false) =>
        api.get('/marks/subjects', { params: { class_id: classId, include_inactive: includeInactive } }),
    createSubject: (data) => api.post('/marks/subjects', data),
    updateSubject: (id, data) => api.patch(`/marks/subjects/${id}`, data),
    deleteSubject: (id) => api.delete(`/marks/subjects/${id}`),
    seedSubjects: (classId) => api.post(`/marks/subjects/seed/${classId}`),

    // Exams
    getExams: (params) => api.get('/marks/exams', { params }),
    createExam: (data) => api.post('/marks/exams', data),
    deleteExam: (id) => api.delete(`/marks/exams/${id}`),

    // Exam subject configs (per-exam max marks)
    getExamConfigs: (examId) => api.get(`/marks/exams/${examId}/configs`),
    setExamConfigs: (examId, configs) =>
        api.put(`/marks/exams/${examId}/configs`, { configs }),
    clearExamConfigs: (examId) => api.delete(`/marks/exams/${examId}/configs`),

    // Marks entry / results
    getMarksEntry: (examId, classId) =>
        api.get('/marks/entry', { params: { exam_id: examId, class_id: classId } }),
    bulkSaveMarks: (entries) => api.post('/marks/bulk', entries),
    getResults: (examId, classId) =>
        api.get('/marks/results', { params: { exam_id: examId, class_id: classId } }),
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
    previewPromotion: (classId, newYearId) =>
        api.get(`/yearend/promote/${classId}/preview?new_academic_year_id=${newYearId}`),
    promoteClass: (classId, newYearId) =>
        api.post(`/yearend/promote/${classId}?new_academic_year_id=${newYearId}`),
    createNewYear: (data) => api.post('/yearend/new-year', data),
    issueTC: (studentId) => api.post(`/yearend/issue-tc/${studentId}`),
    getCurrentYear: () => api.get('/yearend/current-year'),
    getYears: () => api.get('/yearend/years'),
    getAllYears: () => api.get('/yearend/years'),
    tcPdfUrl: (studentId, reason = "Parent's Request", conduct = 'Good') =>
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

export const formatINR = (amount) =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(Number(amount) || 0)

export const extractError = (err) => {
    const detail =
        err &&
        err.response &&
        err.response.data &&
        err.response.data.detail

    if (!detail) return 'Something went wrong. Please try again.'

    if (typeof detail === 'string') return detail

    if (Array.isArray(detail)) {
        return detail
            .map(d => (d && (d.msg || d.message)) || JSON.stringify(d))
            .join('; ')
    }

    return JSON.stringify(detail)
}
export default api
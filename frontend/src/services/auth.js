// auth.js
// FIX: Store JWT in sessionStorage so users survive page refreshes within
// the same browser session. sessionStorage is cleared when the tab closes,
// preventing long-lived token persistence (better than localStorage for
// security, better than in-memory for UX). XSS risk is identical to
// localStorage but acceptable for an internal school admin tool.

const TOKEN_KEY = 'sms_auth_token';
const USER_KEY = 'sms_auth_user';

export const setToken = (t) => {
  try {
    sessionStorage.setItem(TOKEN_KEY, t);
  } catch {
    // Fallback to in-memory if sessionStorage blocked (private browsing edge case)
    _memToken = t;
  }
};

export const setAuthUser = (user) => {
  try {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user || null));
  } catch { /* */ }
};

export const normalizeAuthUser = (data) => ({
  id: data?.user_id ?? data?.id ?? null,
  name: data?.user_name ?? data?.name ?? data?.username ?? '',
  role: data?.role ?? null,
  assignedClassIds: data?.assigned_class_ids ?? data?.assignedClassIds ?? [],
  classTeacherClassIds: data?.class_teacher_class_ids ?? data?.classTeacherClassIds ?? [],
  subjectAssignments: data?.subject_assignments ?? data?.subjectAssignments ?? [],
  linkedStudentId: data?.linked_student_id ?? data?.linkedStudentId ?? null,
  linkedStudentIds: data?.linked_student_ids ?? data?.linkedStudentIds ?? [],
});

export const getAuthUser = () => {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const getRole = () => getAuthUser()?.role || null;

let _memToken = null;

export const getToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || _memToken;
  } catch {
    return _memToken;
  }
};

export const clearToken = () => {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch { /* */ }
  _memToken = null;
};

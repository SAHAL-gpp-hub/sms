const TOKEN_KEY = 'sms_auth_token';
const USER_KEY = 'sms_auth_user';
const EXPIRY_KEY = 'sms_auth_expiry';
const DEFAULT_SESSION_MINUTES = 480;

let _memToken = null;
let _memUser = null;
let _memExpiry = null;

export const getTokenExpiry = () => {
  try {
    const raw = localStorage.getItem(EXPIRY_KEY);
    return raw ? Number(raw) : _memExpiry;
  } catch {
    return _memExpiry;
  }
};

export const setToken = (t, expiresInMinutes = DEFAULT_SESSION_MINUTES) => {
  const expiry = Date.now() + expiresInMinutes * 60 * 1000;
  try {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(EXPIRY_KEY, String(expiry));
  } catch {
    _memToken = t;
    _memExpiry = expiry;
  }
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
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return _memUser;
  }
};

export const getRole = () => getAuthUser()?.role || null;

export const getToken = () => {
  const expiry = getTokenExpiry();
  if (expiry && Date.now() > expiry) {
    clearToken();
    return null;
  }
  try {
    return localStorage.getItem(TOKEN_KEY) || _memToken;
  } catch {
    return _memToken;
  }
};

export const setAuthUser = (user) => {
  _memUser = user || null;
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user || null));
  } catch { /* */ }
};

export const clearToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EXPIRY_KEY);
  } catch { /* */ }
  _memToken = null;
  _memUser = null;
  _memExpiry = null;
};

import { useEffect, useMemo, useState } from 'react'
import { authAPI } from '../services/api'
import { getAuthUser, getRole, getToken, normalizeAuthUser, setAuthUser } from '../services/auth'

export function useRoleContext() {
  const [user, setUser] = useState(() => getAuthUser())
  const role = user?.role || getRole() || ''

  useEffect(() => {
    if (!getToken()) return undefined
    let active = true
    authAPI.me()
      .then(res => {
        if (!active) return
        const nextUser = normalizeAuthUser(res.data)
        setAuthUser(nextUser)
        setUser(nextUser)
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  return useMemo(() => {
    const classTeacherClassIds = user?.classTeacherClassIds || []
    const subjectAssignments = user?.subjectAssignments || []
    const assignedClassIds = user?.assignedClassIds || []
    const subjectClassIds = [
      ...new Set([
        ...subjectAssignments.map(assignment => assignment.class_id),
        ...classTeacherClassIds,
      ]),
    ]

    return {
      user,
      role,
      isAdmin: role === 'admin',
      isTeacher: role === 'teacher',
      isStudent: role === 'student',
      isParent: role === 'parent',
      classTeacherClassIds,
      subjectAssignments,
      assignedClassIds,
      subjectClassIds,
      canMarkAttendance: role === 'admin' || classTeacherClassIds.length > 0,
      canEnterMarks: role === 'admin' || subjectAssignments.length > 0,
    }
  }, [role, user])
}

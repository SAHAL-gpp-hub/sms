import { createContext, useContext } from 'react'

export const ACADEMIC_YEAR_CHANGED = 'sms:academic-year-changed'

export const AcademicYearContext = createContext({
  selectedYearId: '',
  selectedYear: null,
  years: [],
  isClosedYear: false,
  loading: true,
  error: null,
  refreshKey: 0,
  setSelectedYearId: () => {},
  refetchYears: () => {},
})

export function useAcademicYear() {
  return useContext(AcademicYearContext)
}

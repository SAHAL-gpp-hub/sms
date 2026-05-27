import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { SELECTED_YEAR_KEY, warmCurrentYearCache, yearendAPI } from '../services/api'
import { ACADEMIC_YEAR_CHANGED, AcademicYearContext } from '../contexts/academicYearContext'

function getStoredYearId() {
  try {
    return localStorage.getItem(SELECTED_YEAR_KEY) || ''
  } catch {
    return ''
  }
}

function storeYearId(value) {
  try {
    if (value) localStorage.setItem(SELECTED_YEAR_KEY, value)
    else localStorage.removeItem(SELECTED_YEAR_KEY)
  } catch {
    // Storage can fail in private browsing; the in-memory state still works.
  }
}

export default function AcademicYearProvider({ children }) {
  const queryClient = useQueryClient()
  const [years, setYears] = useState([])
  const [selectedYearId, setSelectedYearIdState] = useState(getStoredYearId())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const setSelectedYearId = useCallback((value) => {
    const next = value ? String(value) : ''
    setSelectedYearIdState(next)
    storeYearId(next)
    warmCurrentYearCache(next ? Number(next) : null)
    setRefreshKey(key => key + 1)
    queryClient.invalidateQueries()
    window.dispatchEvent(new CustomEvent(ACADEMIC_YEAR_CHANGED, {
      detail: { academicYearId: next ? Number(next) : null },
    }))
  }, [queryClient])

  const loadYears = useCallback(() => {
    let alive = true
    setLoading(true)
    setError(null)
    Promise.all([
      yearendAPI.getYears(),
      yearendAPI.getCurrentYear().catch(() => ({ data: null })),
    ])
      .then(([yearsRes, currentRes]) => {
        if (!alive) return
        const allYears = Array.isArray(yearsRes.data) ? yearsRes.data : []
        const stored = getStoredYearId()
        const storedExists = stored && allYears.some(year => String(year.id) === String(stored))
        const currentId = currentRes.data?.id ? String(currentRes.data.id) : ''
        const fallback = storedExists ? stored : currentId || (allYears[0]?.id ? String(allYears[0].id) : '')
        setYears(allYears)
        if (fallback && fallback !== selectedYearId) {
          setSelectedYearIdState(fallback)
          storeYearId(fallback)
          warmCurrentYearCache(Number(fallback))
        }
      })
      .catch(err => {
        if (!alive) return
        setYears([])
        setError(err)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => { alive = false }
  }, [selectedYearId])

  useEffect(() => {
    let cleanup = () => {}
    const timer = window.setTimeout(() => {
      cleanup = loadYears() || (() => {})
    }, 0)
    return () => {
      window.clearTimeout(timer)
      cleanup()
    }
  }, [loadYears])

  const selectedYear = useMemo(
    () => years.find(year => String(year.id) === String(selectedYearId)) || null,
    [selectedYearId, years]
  )
  const isClosedYear = String(selectedYear?.status || '').toLowerCase() === 'closed'

  const value = useMemo(() => ({
    selectedYearId,
    selectedYear,
    years,
    isClosedYear,
    loading,
    error,
    refreshKey,
    setSelectedYearId,
    refetchYears: loadYears,
  }), [error, isClosedYear, loadYears, loading, refreshKey, selectedYear, selectedYearId, setSelectedYearId, years])

  return (
    <AcademicYearContext.Provider value={value}>
      {children}
    </AcademicYearContext.Provider>
  )
}

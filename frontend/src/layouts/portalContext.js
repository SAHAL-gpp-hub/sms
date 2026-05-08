import { createContext, useContext } from 'react'

export const PortalContext = createContext({
  role: 'student',
  profile: null,
  children: [],
  selectedChildId: null,
  setSelectedChildId: () => {},
})

export const usePortalContext = () => useContext(PortalContext)

import Sidebar from './Sidebar'
import { Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
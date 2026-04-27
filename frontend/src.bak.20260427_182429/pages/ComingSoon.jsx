export default function ComingSoon({ title, description, icon }) {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-800">{title}</h1>
        <p className="text-slate-500 mt-1 text-sm">{description}</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
          <span className="text-3xl">{icon}</span>
        </div>
        <h3 className="text-lg font-semibold text-slate-700 mb-2">Coming in Sprint {title === 'Fees' ? '3' : title === 'Marks' ? '4' : title === 'Attendance' ? '6' : '7'}</h3>
        <p className="text-slate-400 text-sm max-w-sm">This module is part of the upcoming sprint. Student Management is fully ready — start adding students now!</p>
        <a href="/students" className="mt-6 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          Go to Students →
        </a>
      </div>
    </div>
  )
}
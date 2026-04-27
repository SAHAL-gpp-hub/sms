import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { studentAPI, setupAPI } from '../../services/api'

const CATEGORIES = ['GEN', 'OBC', 'SC', 'ST', 'EWS']
const GENDERS = [
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
  { value: 'Other', label: 'Other' },
]

// ✅ Defined OUTSIDE the component — this is the fix
function InputField({ label, required, error, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {error && <p className="text-rose-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

function TextInput({ value, onChange, type = 'text', placeholder, error, min }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      min={min}
      className={`w-full border rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
        error ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    />
  )
}

function SelectInput({ value, onChange, options, placeholder, error }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={`w-full border rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none bg-white ${
        error ? 'border-rose-400 bg-rose-50' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o}>
          {o.label ?? o}
        </option>
      ))}
    </select>
  )
}

export default function StudentForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [classes, setClasses] = useState([])
  const [academicYears, setAcademicYears] = useState([])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const [form, setForm] = useState({
    name_en: '',
    name_gu: '',
    dob: '',
    gender: 'M',
    class_id: '',
    roll_number: '',
    gr_number: '',
    father_name: '',
    mother_name: '',
    contact: '',
    address: '',
    category: 'GEN',
    aadhar: '',
    admission_date: new Date().toISOString().split('T')[0],
    academic_year_id: '',
  })

  useEffect(() => {
    setupAPI.getClasses().then(r => setClasses(r.data)).catch(() => {})
    setupAPI.getAcademicYears().then(r => {
      setAcademicYears(r.data)
      const current = r.data.find(y => y.is_current)
      if (current) setForm(f => ({ ...f, academic_year_id: String(current.id) }))
    }).catch(() => {})

    if (isEdit) {
      studentAPI.get(id).then(r => {
        const s = r.data
        setForm({
          name_en: s.name_en || '',
          name_gu: s.name_gu || '',
          dob: s.dob || '',
          gender: s.gender || 'M',
          class_id: String(s.class_id) || '',
          roll_number: s.roll_number ? String(s.roll_number) : '',
          gr_number: s.gr_number || '',
          father_name: s.father_name || '',
          mother_name: s.mother_name || '',
          contact: s.contact || '',
          address: s.address || '',
          category: s.category || 'GEN',
          aadhar: s.aadhar || '',
          admission_date: s.admission_date || '',
          academic_year_id: String(s.academic_year_id) || '',
        })
      }).catch(() => {})
    }
  }, [id])

  const setField = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const validate = () => {
    const e = {}
    if (!form.name_en.trim()) e.name_en = 'Full name in English is required'
    if (!form.name_gu.trim()) e.name_gu = 'Full name in Gujarati is required'
    if (!form.dob) e.dob = 'Date of birth is required'
    if (!form.father_name.trim()) e.father_name = "Father's name is required"
    if (!form.contact || !/^\d{10}$/.test(form.contact)) e.contact = 'Must be exactly 10 digits'
    if (!form.class_id) e.class_id = 'Please select a class'
    if (!form.academic_year_id) e.academic_year_id = 'Please select academic year'
    if (!form.admission_date) e.admission_date = 'Admission date is required'

    if (form.roll_number && parseInt(form.roll_number) <= 0) {
    e.roll_number = 'Roll number must be greater than 0'
  }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const payload = {
        ...form,
        class_id: parseInt(form.class_id),
        academic_year_id: parseInt(form.academic_year_id),
        roll_number: form.roll_number ? parseInt(form.roll_number) : null,
      }
      if (isEdit) {
        await studentAPI.update(id, payload)
      } else {
        await studentAPI.create(payload)
      }
      navigate('/students')
    } catch (err) {
      const detail = err.response?.data?.detail
      if (Array.isArray(detail)) {
        alert(detail.map(d => d.msg).join('\n'))
      } else {
        alert(detail || 'Something went wrong. Please try again.')
      }
    }
    setLoading(false)
  }

  const classOptions = classes.map(c => ({ value: String(c.id), label: `Class ${c.name} — Div ${c.division}` }))
  const yearOptions = academicYears.map(y => ({ value: String(y.id), label: y.label }))

  return (
    <div className="max-w-3xl">
      {/* Page Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/students')}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">
            {isEdit ? 'Edit Student' : 'Add New Student'}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {isEdit ? 'Update student details below' : 'Fill in the details to register a new student'}
          </p>
        </div>
      </div>

      <div className="space-y-6">

        {/* Section: Personal Info */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700">Personal Information</h2>
          </div>
          <div className="p-6 grid grid-cols-2 gap-5">
            <InputField label="Full Name (English)" required error={errors.name_en}>
              <TextInput value={form.name_en} onChange={setField('name_en')} placeholder="e.g. Rahul Patel" error={errors.name_en} />
            </InputField>
            <InputField label="Full Name (Gujarati)" required error={errors.name_gu}>
              <TextInput value={form.name_gu} onChange={setField('name_gu')} placeholder="ગુજરાતીમાં નામ" error={errors.name_gu} />
            </InputField>
            <InputField label="Date of Birth" required error={errors.dob}>
              <TextInput type="date" value={form.dob} onChange={setField('dob')} error={errors.dob} />
            </InputField>
            <InputField label="Gender" required>
              <SelectInput value={form.gender} onChange={setField('gender')} options={GENDERS} />
            </InputField>
            <InputField label="Category" required>
              <SelectInput
                value={form.category}
                onChange={setField('category')}
                options={CATEGORIES.map(c => ({ value: c, label: c }))}
              />
            </InputField>
            <InputField label="Aadhar Number">
              <TextInput value={form.aadhar} onChange={setField('aadhar')} placeholder="12-digit Aadhar (optional)" />
            </InputField>
          </div>
        </div>

        {/* Section: Academic Details */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700">Academic Details</h2>
          </div>
          <div className="p-6 grid grid-cols-2 gap-5">
            <InputField label="Class / Standard" required error={errors.class_id}>
              <SelectInput
                value={form.class_id}
                onChange={setField('class_id')}
                options={classOptions}
                placeholder="Select class..."
                error={errors.class_id}
              />
            </InputField>
            <InputField label="Academic Year" required error={errors.academic_year_id}>
              <SelectInput
                value={form.academic_year_id}
                onChange={setField('academic_year_id')}
                options={yearOptions}
                placeholder="Select year..."
                error={errors.academic_year_id}
              />
            </InputField>
            <InputField label="GR Number">
              <TextInput value={form.gr_number} onChange={setField('gr_number')} placeholder="General Register No." />
            </InputField>
            <InputField label="Roll Number">
              <TextInput 
  type="number" 
  value={form.roll_number} 
  onChange={setField('roll_number')} 
  placeholder="e.g. 1"
  min="1"
  error={errors.roll_number}
/>
            </InputField>
            <InputField label="Admission Date" required error={errors.admission_date}>
              <TextInput type="date" value={form.admission_date} onChange={setField('admission_date')} error={errors.admission_date} />
            </InputField>
          </div>
        </div>

        {/* Section: Family & Contact */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700">Family & Contact</h2>
          </div>
          <div className="p-6 grid grid-cols-2 gap-5">
            <InputField label="Father's Name" required error={errors.father_name}>
              <TextInput value={form.father_name} onChange={setField('father_name')} placeholder="Father's full name" error={errors.father_name} />
            </InputField>
            <InputField label="Mother's Name">
              <TextInput value={form.mother_name} onChange={setField('mother_name')} placeholder="Mother's full name" />
            </InputField>
            <InputField label="Contact Number" required error={errors.contact}>
              <TextInput value={form.contact} onChange={setField('contact')} placeholder="10-digit mobile number" error={errors.contact} />
            </InputField>
            <div className="col-span-2">
              <InputField label="Address">
                <textarea
                  value={form.address}
                  onChange={setField('address')}
                  placeholder="Home address (optional)"
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-slate-300 transition-all resize-none"
                />
              </InputField>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pb-8">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Saving...
              </span>
            ) : isEdit ? 'Update Student' : 'Add Student'}
          </button>
          <button
            onClick={() => navigate('/students')}
            className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  )
}
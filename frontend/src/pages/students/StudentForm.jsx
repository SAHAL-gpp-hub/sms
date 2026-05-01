// StudentForm.jsx — Fully responsive with mobile-optimized layout
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { studentAPI, setupAPI, extractError } from '../../services/api'
import { PageHeader, Field } from '../../components/UI'

const CATEGORIES = ['GEN', 'OBC', 'SC', 'ST', 'EWS']
const GENDERS = [
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
  { value: 'Other', label: 'Other' },
]
const STATUSES = [
  { value: 'Active',     label: 'Active' },
  { value: 'TC Issued',  label: 'TC Issued' },
  { value: 'Left',       label: 'Left' },
  { value: 'Passed Out', label: 'Passed Out' },
]

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="card" style={{ marginBottom: '14px' }}>
      <div style={{
        padding: '13px 18px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--gray-50)',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{subtitle}</div>}
      </div>
      <div style={{ padding: '18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {children}
      </div>
    </div>
  )
}

const EMPTY_FORM = {
  name_en: '', name_gu: '', dob: '', gender: 'M',
  class_id: '', roll_number: '', gr_number: '',
  father_name: '', mother_name: '', contact: '',
  address: '', category: 'GEN', aadhar_last4: '',
  admission_date: new Date().toISOString().split('T')[0],
  academic_year_id: '', status: 'Active',
}

export default function StudentForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [classes, setClasses]           = useState([])
  const [academicYears, setAcademicYears] = useState([])
  const [loading, setLoading]           = useState(false)
  const [initialLoading, setInitialLoading] = useState(isEdit)
  const [errors, setErrors]             = useState({})
  const [form, setForm]                 = useState(EMPTY_FORM)

  useEffect(() => {
    Promise.all([
      setupAPI.getClasses(),
      setupAPI.getAcademicYears(),
    ]).then(([classRes, yearRes]) => {
      setClasses(classRes.data)
      setAcademicYears(yearRes.data)
      const current = yearRes.data.find(y => y.is_current)
      if (current && !isEdit) {
        setForm(f => ({ ...f, academic_year_id: String(current.id) }))
      }
    }).catch(() => toast.error('Failed to load setup data'))

    if (isEdit) {
      studentAPI.get(id).then(r => {
        const s = r.data
        setForm({
          name_en: s.name_en || '', name_gu: s.name_gu || '',
          dob: s.dob || '', gender: s.gender || 'M',
          class_id: String(s.class_id) || '', roll_number: s.roll_number != null ? String(s.roll_number) : '',
          gr_number: s.gr_number || '', father_name: s.father_name || '',
          mother_name: s.mother_name || '', contact: s.contact || '',
          address: s.address || '', category: s.category || 'GEN',
          aadhar_last4: s.aadhar_last4 || '',
          admission_date: s.admission_date || '',
          academic_year_id: String(s.academic_year_id) || '',
          status: s.status || 'Active',
        })
        setInitialLoading(false)
      }).catch(() => {
        toast.error('Failed to load student data')
        setInitialLoading(false)
      })
    }
  }, [id])

  const setField = field => e => {
    setForm(f => ({ ...f, [field]: e.target.value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const validate = () => {
    const e = {}
    if (!form.name_en.trim())       e.name_en       = 'English name is required'
    if (!form.name_gu.trim())       e.name_gu       = 'Gujarati name is required'
    if (!form.dob)                  e.dob           = 'Date of birth is required'
    if (!form.father_name.trim())   e.father_name   = "Father's name is required"
    if (!form.class_id)             e.class_id      = 'Please select a class'
    if (!form.academic_year_id)     e.academic_year_id = 'Please select an academic year'
    if (!form.admission_date)       e.admission_date = 'Admission date is required'
    if (!form.contact || !/^\d{10}$/.test(form.contact)) e.contact = 'Must be exactly 10 digits'
    else if (form.contact.startsWith('0')) e.contact = 'Cannot start with 0'
    if (form.roll_number && parseInt(form.roll_number) <= 0) e.roll_number = 'Must be greater than 0'
    if (form.aadhar_last4 && (!/^\d{1,4}$/.test(form.aadhar_last4))) e.aadhar_last4 = 'Must be up to 4 numeric digits'
    if (form.dob && new Date(form.dob) > new Date()) e.dob = 'Cannot be in the future'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) { toast.error('Please fix the errors below'); return }
    setLoading(true)
    try {
      const payload = {
        ...form,
        class_id: parseInt(form.class_id),
        academic_year_id: parseInt(form.academic_year_id),
        roll_number: form.roll_number ? parseInt(form.roll_number) : null,
        aadhar_last4: form.aadhar_last4 || null,
      }
      delete payload.aadhar
      if (isEdit) {
        await studentAPI.update(id, payload)
        toast.success('Student updated successfully')
      } else {
        await studentAPI.create(payload)
        toast.success('Student added successfully')
      }
      navigate('/students')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  const classOptions  = classes.map(c => ({ value: String(c.id), label: `Class ${c.name} — Div ${c.division}` }))
  const yearOptions   = academicYears.map(y => ({ value: String(y.id), label: y.label + (y.is_current ? ' (Current)' : '') }))

  if (initialLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px', color: 'var(--text-tertiary)', fontSize: '14px' }}>
        <span className="spinner" /> Loading...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '800px' }}>
      <PageHeader
        title={isEdit ? 'Edit Student' : 'Add New Student'}
        subtitle={isEdit ? 'Update student information' : 'Fill in the details to register a new student'}
        back={() => navigate('/students')}
      />

      {/* Personal Information */}
      <SectionCard title="Personal Information" subtitle="Name, date of birth and identity">
        <Field label="Full Name (English)" required error={errors.name_en}>
          <input className={`input${errors.name_en ? ' error' : ''}`} value={form.name_en} onChange={setField('name_en')} placeholder="e.g. Rahul Patel" />
        </Field>
        <Field label="Full Name (Gujarati)" required error={errors.name_gu}>
          <input className={`input${errors.name_gu ? ' error' : ''}`} value={form.name_gu} onChange={setField('name_gu')} placeholder="ગુજરાતીમાં નામ" />
        </Field>
        <Field label="Date of Birth" required error={errors.dob}>
          <input type="date" className={`input${errors.dob ? ' error' : ''}`} value={form.dob} onChange={setField('dob')} max={new Date().toISOString().split('T')[0]} />
        </Field>
        <Field label="Gender" required>
          <select className="input" value={form.gender} onChange={setField('gender')}>
            {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </Field>
        <Field label="Category">
          <select className="input" value={form.category} onChange={setField('category')}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Aadhaar (Last 4 Digits)" error={errors.aadhar_last4} hint="Only last 4 digits stored for privacy">
          <input
            className={`input${errors.aadhar_last4 ? ' error' : ''}`}
            value={form.aadhar_last4}
            onChange={e => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 4)
              setForm(f => ({ ...f, aadhar_last4: val }))
              setErrors(prev => ({ ...prev, aadhar_last4: undefined }))
            }}
            placeholder="e.g. 1234"
            maxLength={4}
            inputMode="numeric"
          />
        </Field>
      </SectionCard>

      {/* Academic Details */}
      <SectionCard title="Academic Details" subtitle="Class, year, GR number and enrollment">
        <Field label="Class / Standard" required error={errors.class_id}>
          <select className={`input${errors.class_id ? ' error' : ''}`} value={form.class_id} onChange={setField('class_id')}>
            <option value="">Select class...</option>
            {classOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Academic Year" required error={errors.academic_year_id}>
          <select className={`input${errors.academic_year_id ? ' error' : ''}`} value={form.academic_year_id} onChange={setField('academic_year_id')}>
            <option value="">Select year...</option>
            {yearOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="GR Number" hint="General Register number">
          <input className="input" value={form.gr_number} onChange={setField('gr_number')} placeholder="e.g. GR2025001" />
        </Field>
        <Field label="Roll Number" error={errors.roll_number}>
          <input type="number" className={`input${errors.roll_number ? ' error' : ''}`} value={form.roll_number} onChange={setField('roll_number')} placeholder="e.g. 15" min="1" inputMode="numeric" />
        </Field>
        <Field label="Admission Date" required error={errors.admission_date}>
          <input type="date" className={`input${errors.admission_date ? ' error' : ''}`} value={form.admission_date} onChange={setField('admission_date')} />
        </Field>
        {isEdit && (
          <Field label="Status">
            <select className="input" value={form.status} onChange={setField('status')}>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
        )}
      </SectionCard>

      {/* Family & Contact */}
      <SectionCard title="Family & Contact" subtitle="Parent information and contact details">
        <Field label="Father's Name" required error={errors.father_name}>
          <input className={`input${errors.father_name ? ' error' : ''}`} value={form.father_name} onChange={setField('father_name')} placeholder="Father's full name" />
        </Field>
        <Field label="Mother's Name">
          <input className="input" value={form.mother_name} onChange={setField('mother_name')} placeholder="Mother's full name" />
        </Field>
        <Field label="Contact Number" required error={errors.contact} hint="10-digit mobile, no leading 0">
          <input
            className={`input${errors.contact ? ' error' : ''}`}
            value={form.contact}
            onChange={e => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 10)
              setForm(f => ({ ...f, contact: val }))
              setErrors(prev => ({ ...prev, contact: undefined }))
            }}
            placeholder="9876543210"
            maxLength={10}
            inputMode="tel"
          />
        </Field>
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Address">
            <textarea
              value={form.address}
              onChange={setField('address')}
              placeholder="Home address (optional)"
              rows={3}
              className="input"
              style={{ resize: 'vertical', minHeight: '72px' }}
            />
          </Field>
        </div>
      </SectionCard>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px', paddingBottom: '32px', flexWrap: 'wrap' }}>
        <button onClick={handleSubmit} disabled={loading} className="btn btn-primary btn-lg" style={{ flex: 1, minWidth: '140px' }}>
          {loading ? <><span className="spinner" style={{ width: '15px', height: '15px' }} /> Saving...</> : isEdit ? 'Save Changes' : 'Add Student'}
        </button>
        <button onClick={() => navigate('/students')} className="btn btn-secondary btn-lg" style={{ flex: 1, minWidth: '100px' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
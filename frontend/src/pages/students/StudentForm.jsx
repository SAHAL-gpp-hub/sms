// StudentForm.jsx — Fixed aadhar_last4 bug, improved UX throughout
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { studentAPI, setupAPI, extractError } from '../../services/api'
import { PageHeader, Field, Select } from '../../components/UI'

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
    <div className="card" style={{ marginBottom: '16px' }}>
      <div style={{
        padding: '16px 22px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--gray-50)',
      }}>
        <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{subtitle}</div>}
      </div>
      <div style={{ padding: '22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
        {children}
      </div>
    </div>
  )
}

function TextInput({ value, onChange, type = 'text', placeholder, error, min, max, maxLength, readOnly, hint }) {
  return (
    <>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        max={max}
        maxLength={maxLength}
        readOnly={readOnly}
        className={`input${error ? ' error' : ''}`}
        style={readOnly ? { background: 'var(--gray-50)', color: 'var(--text-secondary)', cursor: 'not-allowed' } : {}}
      />
    </>
  )
}

function SelectInput({ value, onChange, options, placeholder, error }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={`input${error ? ' error' : ''}`}
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

const EMPTY_FORM = {
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
  aadhar_last4: '',   // FIX: was 'aadhar' — now correctly uses aadhar_last4
  admission_date: new Date().toISOString().split('T')[0],
  academic_year_id: '',
  status: 'Active',
}

export default function StudentForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [classes, setClasses] = useState([])
  const [academicYears, setAcademicYears] = useState([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(isEdit)
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState(EMPTY_FORM)

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
          name_en:          s.name_en || '',
          name_gu:          s.name_gu || '',
          dob:              s.dob || '',
          gender:           s.gender || 'M',
          class_id:         String(s.class_id) || '',
          roll_number:      s.roll_number != null ? String(s.roll_number) : '',
          gr_number:        s.gr_number || '',
          father_name:      s.father_name || '',
          mother_name:      s.mother_name || '',
          contact:          s.contact || '',
          address:          s.address || '',
          category:         s.category || 'GEN',
          aadhar_last4:     s.aadhar_last4 || '',   // FIX: correct field name
          admission_date:   s.admission_date || '',
          academic_year_id: String(s.academic_year_id) || '',
          status:           s.status || 'Active',
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
    if (!form.name_en.trim())  e.name_en  = 'English name is required'
    if (!form.name_gu.trim())  e.name_gu  = 'Gujarati name is required'
    if (!form.dob)             e.dob      = 'Date of birth is required'
    if (!form.father_name.trim()) e.father_name = "Father's name is required"
    if (!form.class_id)        e.class_id = 'Please select a class'
    if (!form.academic_year_id) e.academic_year_id = 'Please select an academic year'
    if (!form.admission_date)  e.admission_date = 'Admission date is required'

    if (!form.contact || !/^\d{10}$/.test(form.contact)) {
      e.contact = 'Must be exactly 10 digits'
    } else if (form.contact.startsWith('0')) {
      e.contact = 'Contact number cannot start with 0'
    }

    if (form.roll_number && parseInt(form.roll_number) <= 0) {
      e.roll_number = 'Roll number must be greater than 0'
    }

    // FIX: validate aadhar_last4 — max 4 numeric digits
    if (form.aadhar_last4 && (!/^\d{1,4}$/.test(form.aadhar_last4))) {
      e.aadhar_last4 = 'Must be exactly 4 numeric digits'
    }

    if (form.dob && new Date(form.dob) > new Date()) {
      e.dob = 'Date of birth cannot be in the future'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) {
      toast.error('Please fix the errors below before submitting')
      return
    }
    setLoading(true)
    try {
      const payload = {
        ...form,
        class_id:         parseInt(form.class_id),
        academic_year_id: parseInt(form.academic_year_id),
        roll_number:      form.roll_number ? parseInt(form.roll_number) : null,
        // FIX: send aadhar_last4 (not aadhar) — backend schema uses aadhar_last4
        aadhar_last4: form.aadhar_last4 || null,
      }
      // Remove any legacy 'aadhar' key if it somehow exists
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
  const catOptions    = CATEGORIES.map(c => ({ value: c, label: c }))

  if (initialLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px', color: 'var(--text-tertiary)', fontSize: '14px' }}>
        <span className="spinner" /> Loading student data...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '820px' }}>
      <PageHeader
        title={isEdit ? 'Edit Student' : 'Add New Student'}
        subtitle={isEdit ? 'Update student information below' : 'Fill in the details to register a new student'}
        back={() => navigate('/students')}
      />

      {/* Personal Information */}
      <SectionCard title="Personal Information" subtitle="Student's name, date of birth, and identity details">
        <Field label="Full Name (English)" required error={errors.name_en}>
          <TextInput value={form.name_en} onChange={setField('name_en')} placeholder="e.g. Rahul Patel" error={errors.name_en} />
        </Field>

        <Field label="Full Name (Gujarati)" required error={errors.name_gu}>
          <TextInput value={form.name_gu} onChange={setField('name_gu')} placeholder="ગુજરાતીમાં નામ" error={errors.name_gu} />
        </Field>

        <Field label="Date of Birth" required error={errors.dob}>
          <TextInput type="date" value={form.dob} onChange={setField('dob')} error={errors.dob}
            max={new Date().toISOString().split('T')[0]} />
        </Field>

        <Field label="Gender" required>
          <SelectInput value={form.gender} onChange={setField('gender')} options={GENDERS} />
        </Field>

        <Field label="Category">
          <SelectInput value={form.category} onChange={setField('category')} options={catOptions} />
        </Field>

        {/* FIX: Changed label from "12-digit Aadhar" to "Last 4 Digits of Aadhaar"
            Changed field from 'aadhar' to 'aadhar_last4'
            Added maxLength=4 and hint explaining the legal reason */}
        <Field
          label="Aadhaar (Last 4 Digits)"
          error={errors.aadhar_last4}
          hint="Only the last 4 digits are stored for privacy compliance"
        >
          <TextInput
            value={form.aadhar_last4}
            onChange={e => {
              // Only allow digits, max 4
              const val = e.target.value.replace(/\D/g, '').slice(0, 4)
              setForm(f => ({ ...f, aadhar_last4: val }))
              setErrors(prev => ({ ...prev, aadhar_last4: undefined }))
            }}
            placeholder="e.g. 1234"
            maxLength={4}
            error={errors.aadhar_last4}
          />
        </Field>
      </SectionCard>

      {/* Academic Details */}
      <SectionCard title="Academic Details" subtitle="Class, academic year, GR number, and enrollment information">
        <Field label="Class / Standard" required error={errors.class_id}>
          <SelectInput
            value={form.class_id}
            onChange={setField('class_id')}
            options={classOptions}
            placeholder="Select class..."
            error={errors.class_id}
          />
        </Field>

        <Field label="Academic Year" required error={errors.academic_year_id}>
          <SelectInput
            value={form.academic_year_id}
            onChange={setField('academic_year_id')}
            options={yearOptions}
            placeholder="Select year..."
            error={errors.academic_year_id}
          />
        </Field>

        <Field label="GR Number" hint="General Register number assigned by school">
          <TextInput value={form.gr_number} onChange={setField('gr_number')} placeholder="e.g. GR2025001" />
        </Field>

        <Field label="Roll Number" error={errors.roll_number}>
          <TextInput
            type="number"
            value={form.roll_number}
            onChange={setField('roll_number')}
            placeholder="e.g. 15"
            min="1"
            error={errors.roll_number}
          />
        </Field>

        <Field label="Admission Date" required error={errors.admission_date}>
          <TextInput type="date" value={form.admission_date} onChange={setField('admission_date')} error={errors.admission_date} />
        </Field>

        {isEdit && (
          <Field label="Status">
            <SelectInput value={form.status} onChange={setField('status')} options={STATUSES} />
          </Field>
        )}
      </SectionCard>

      {/* Family & Contact */}
      <SectionCard title="Family & Contact" subtitle="Parent/guardian information and contact details">
        <Field label="Father's Name" required error={errors.father_name}>
          <TextInput value={form.father_name} onChange={setField('father_name')} placeholder="Father's full name" error={errors.father_name} />
        </Field>

        <Field label="Mother's Name">
          <TextInput value={form.mother_name} onChange={setField('mother_name')} placeholder="Mother's full name" />
        </Field>

        <Field label="Contact Number" required error={errors.contact} hint="10-digit mobile number, no leading 0">
          <TextInput
            value={form.contact}
            onChange={e => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 10)
              setForm(f => ({ ...f, contact: val }))
              setErrors(prev => ({ ...prev, contact: undefined }))
            }}
            placeholder="9876543210"
            maxLength={10}
            error={errors.contact}
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
      <div style={{ display: 'flex', gap: '12px', paddingBottom: '40px' }}>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn btn-primary btn-lg"
        >
          {loading
            ? <><span className="spinner" style={{ width: '15px', height: '15px' }} /> Saving...</>
            : isEdit ? 'Save Changes' : 'Add Student'
          }
        </button>
        <button
          onClick={() => navigate('/students')}
          className="btn btn-secondary btn-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

from datetime import date
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.main import app
from app.models.base_models import AcademicYear, Class, GenderEnum, Student, StudentStatusEnum, User

SQLALCHEMY_TEST_URL = 'sqlite:///./test_student_imports.db'
engine = create_engine(SQLALCHEMY_TEST_URL, connect_args={'check_same_thread': False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope='module', autouse=True)
def setup_database():
    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    year = AcademicYear(
        label='2025-26',
        start_date=date(2025, 6, 1),
        end_date=date(2026, 3, 31),
        is_current=True,
    )
    db.add(year)
    db.flush()
    cls = Class(name='7', division='A', academic_year_id=year.id)
    db.add(cls)
    db.flush()
    admin = User(name='Admin', email='admin-import@test.com', password_hash=get_password_hash('admin1234'), role='admin', is_active=True)
    db.add(admin)
    db.flush()
    existing = Student(
        student_id='OLD-2024-001',
        gr_number='GR2024001',
        name_en='Existing Student',
        name_gu='હાલનો વિદ્યાર્થી',
        dob=date(2013, 5, 12),
        gender=GenderEnum.M,
        class_id=cls.id,
        father_name='Existing Father',
        contact='9876543210',
        admission_date=date(2024, 6, 1),
        academic_year_id=year.id,
        status=StudentStatusEnum.Active,
    )
    db.add(existing)
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=engine)
    if previous_override is None:
        app.dependency_overrides.pop(get_db, None)
    else:
        app.dependency_overrides[get_db] = previous_override


@pytest.fixture(scope='module')
def client():
    return TestClient(app)


@pytest.fixture(scope='module')
def auth_headers(client):
    res = client.post('/api/v1/auth/login', data={'username': 'admin-import@test.com', 'password': 'admin1234'})
    assert res.status_code == 200
    return {'Authorization': f"Bearer {res.json()['access_token']}"}


def _csv_bytes(rows: list[str]) -> bytes:
    return ('\n'.join(rows) + '\n').encode('utf-8')


def test_preview_flags_duplicates_and_missing_classes(client, auth_headers):
    content = _csv_bytes([
        'student_id,gr_number,name_en,name_gu,dob,gender,class_name,division,father_name,contact,admission_date,academic_year_label',
        'OLD-2024-001,GR2024001,Aarav Patel,આરવ પટેલ,2013-05-12,M,7,A,Rakesh Patel,9876543210,2024-06-01,2025-26',
        'NEW-2024-002,GR2024002,Zoya Sheikh,ઝોયા શેખ,2013-06-15,F,8,A,Imran Sheikh,9876543211,2024-06-01,2025-26',
    ])
    res = client.post(
        '/api/v1/imports/students/preview',
        headers=auth_headers,
        files={'file': ('students.csv', content, 'text/csv')},
        data={'create_missing_classes': 'false'},
    )
    assert res.status_code == 200
    data = res.json()
    assert data['summary']['duplicate_rows'] == 1
    assert data['summary']['missing_class_rows'] == 1
    assert any('already exists' in issue for issue in data['rows'][0]['issues'])
    assert any('does not exist' in issue for issue in data['rows'][1]['issues'])


def test_commit_import_creates_students_and_classes(client, auth_headers):
    content = _csv_bytes([
        'student_id,gr_number,name_en,name_gu,dob,gender,class_name,division,father_name,contact,admission_date,academic_year_label,previous_school',
        'NEW-2024-010,GR2024010,Riya Modi,રિયા મોદી,2014-06-12,F,8,B,Ajay Modi,9876543204,2024-06-01,2025-26,Legacy School',
    ])
    res = client.post(
        '/api/v1/imports/students/commit',
        headers=auth_headers,
        files={'file': ('students.csv', content, 'text/csv')},
        data={'create_missing_classes': 'true'},
    )
    assert res.status_code == 200
    data = res.json()
    assert data['batch']['imported_rows'] == 1
    assert data['batch']['summary']['created_classes'][0]['name'] == '8'

    db = TestingSessionLocal()
    created_class = db.query(Class).filter_by(name='8', division='B').first()
    created_student = db.query(Student).filter_by(student_id='NEW-2024-010').first()
    assert created_class is not None
    assert created_student is not None
    assert created_student.previous_school == 'Legacy School'
    db.close()


def test_create_student_defaults_whatsapp_to_contact(client, auth_headers):
    payload = {
        'name_en': 'Fallback Create',
        'name_gu': 'ફૉલબેક ક્રિએટ',
        'dob': '2013-07-10',
        'gender': 'M',
        'class_id': 1,
        'roll_number': 9,
        'gr_number': 'GR2024991',
        'father_name': 'Create Parent',
        'mother_name': 'Create Mother',
        'contact': '9876500001',
        'student_email': 'fallback.create.student@test.com',
        'student_phone': '',
        'guardian_email': 'fallback.create.guardian@test.com',
        'guardian_phone': '',
        'address': 'Import Street',
        'category': 'GEN',
        'aadhar_last4': '1234',
        'admission_date': '2024-06-01',
        'academic_year_id': 1,
        'previous_school': None,
    }
    res = client.post('/api/v1/students/', headers=auth_headers, json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data['contact'] == '9876500001'
    assert data['student_phone'] == '9876500001'
    assert data['guardian_phone'] == '9876500001'


def test_update_student_defaults_blank_whatsapp_to_contact(client, auth_headers):
    create_payload = {
        'name_en': 'Fallback Update',
        'name_gu': 'ફૉલબેક અપડેટ',
        'dob': '2013-08-11',
        'gender': 'F',
        'class_id': 1,
        'roll_number': 10,
        'gr_number': 'GR2024992',
        'father_name': 'Update Parent',
        'mother_name': 'Update Mother',
        'contact': '9876500002',
        'student_email': 'fallback.update.student@test.com',
        'student_phone': '9876500002',
        'guardian_email': 'fallback.update.guardian@test.com',
        'guardian_phone': '9876500002',
        'address': 'Update Street',
        'category': 'GEN',
        'aadhar_last4': '5678',
        'admission_date': '2024-06-01',
        'academic_year_id': 1,
        'previous_school': None,
    }
    create_res = client.post('/api/v1/students/', headers=auth_headers, json=create_payload)
    assert create_res.status_code == 201
    student_id = create_res.json()['id']

    update_res = client.put(
        f'/api/v1/students/{student_id}',
        headers=auth_headers,
        json={
            'contact': '9876501234',
            'student_phone': '',
            'guardian_phone': '',
        },
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated['contact'] == '9876501234'
    assert updated['student_phone'] == '9876501234'
    assert updated['guardian_phone'] == '9876501234'
    assert updated['name_en'] == create_payload['name_en']
    assert updated['dob'] == create_payload['dob']


def test_commit_import_defaults_blank_whatsapp_to_contact(client, auth_headers):
    content = _csv_bytes([
        'student_id,gr_number,name_en,name_gu,dob,gender,class_name,division,father_name,contact,student_phone,guardian_phone,admission_date,academic_year_label',
        'NEW-2024-011,GR2024011,Import Phone Default,ઇમ્પોર્ટ ફોન ડિફોલ્ટ,2014-06-13,M,7,A,Hasan Ali,9876543205,,,2024-06-01,2025-26',
    ])
    res = client.post(
        '/api/v1/imports/students/commit',
        headers=auth_headers,
        files={'file': ('students.csv', content, 'text/csv')},
        data={'create_missing_classes': 'false'},
    )
    assert res.status_code == 200

    db = TestingSessionLocal()
    created_student = db.query(Student).filter_by(student_id='NEW-2024-011').first()
    assert created_student is not None
    assert created_student.contact == '9876543205'
    assert created_student.student_phone == '9876543205'
    assert created_student.guardian_phone == '9876543205'
    db.close()


def test_rollback_marks_imported_students_left(client, auth_headers):
    list_res = client.get('/api/v1/imports/students/batches', headers=auth_headers)
    assert list_res.status_code == 200
    batch_id = list_res.json()['items'][0]['id']

    rollback_res = client.post(f'/api/v1/imports/students/batches/{batch_id}/rollback', headers=auth_headers)
    assert rollback_res.status_code == 200
    payload = rollback_res.json()
    assert payload['status'] == 'rolled_back'
    assert payload['rollback_summary']['deactivated_students'] == 1

    db = TestingSessionLocal()
    rolled_back_student = db.query(Student).filter_by(student_id='NEW-2024-010').first()
    assert rolled_back_student.status == StudentStatusEnum.Left
    db.close()

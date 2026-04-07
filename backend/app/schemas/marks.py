from pydantic import BaseModel
from typing import Optional
from decimal import Decimal

class SubjectCreate(BaseModel):
    name: str
    class_id: int
    max_theory: int = 100
    max_practical: int = 0
    subject_type: str = "Theory"

class SubjectOut(BaseModel):
    id: int
    name: str
    class_id: int
    max_theory: int
    max_practical: int
    subject_type: str
    model_config = {"from_attributes": True}

class ExamCreate(BaseModel):
    name: str
    class_id: int
    academic_year_id: int
    exam_date: Optional[str] = None

class ExamOut(BaseModel):
    id: int
    name: str
    class_id: int
    academic_year_id: int
    exam_date: Optional[str]
    model_config = {"from_attributes": True}

class MarkEntry(BaseModel):
    student_id: int
    subject_id: int
    exam_id: int
    theory_marks: Optional[Decimal] = None
    practical_marks: Optional[Decimal] = None
    is_absent: bool = False

class MarkOut(BaseModel):
    id: int
    student_id: int
    subject_id: int
    exam_id: int
    theory_marks: Optional[Decimal]
    practical_marks: Optional[Decimal]
    is_absent: bool
    model_config = {"from_attributes": True}

class StudentResult(BaseModel):
    student_id: int
    student_name: str
    roll_number: Optional[int]
    subjects: list[dict]
    total_marks: Decimal
    max_marks: Decimal
    percentage: Decimal
    cgpa: Decimal
    grade: str
    result: str
    class_rank: Optional[int] = None
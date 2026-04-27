from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, computed_field, model_validator


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
    exam_date: Optional[date] = None
    total_marks: Optional[int] = None


class ExamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    class_id: int
    academic_year_id: int
    exam_date: Optional[date]
    total_marks: Optional[int] = None


class MarkEntry(BaseModel):
    student_id: int
    subject_id: int
    exam_id: int
    theory_marks: Optional[Decimal] = None
    practical_marks: Optional[Decimal] = None
    is_absent: bool = False

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_fields(cls, data):
        if not isinstance(data, dict):
            return data
        data = dict(data)
        if "marks_obtained" in data and "theory_marks" not in data:
            data["theory_marks"] = data.pop("marks_obtained")
        data.pop("max_marks", None)
        return data


class MarkUpdate(BaseModel):
    theory_marks: Optional[Decimal] = None
    practical_marks: Optional[Decimal] = None
    is_absent: Optional[bool] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_fields(cls, data):
        if not isinstance(data, dict):
            return data
        data = dict(data)
        if "marks_obtained" in data and "theory_marks" not in data:
            data["theory_marks"] = data.pop("marks_obtained")
        data.pop("max_marks", None)
        return data


class MarkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    subject_id: int
    exam_id: int
    theory_marks: Optional[Decimal]
    practical_marks: Optional[Decimal]
    is_absent: bool

    @computed_field
    @property
    def marks_obtained(self) -> Optional[Decimal]:
        return self.theory_marks

    @computed_field
    @property
    def rank(self) -> Optional[int]:
        return None


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

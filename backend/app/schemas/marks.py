"""
schemas/marks.py  (updated)

New schemas:
  - SubjectUpdate: PATCH-style updates for name/max marks/type/is_active
  - ExamSubjectConfigCreate / ExamSubjectConfigOut:
      per-exam max-marks override for a single subject
  - ExamSubjectConfigBulk: set configs for all subjects of an exam at once
"""

from datetime import date
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, ConfigDict, computed_field, model_validator, field_validator


class SubjectCreate(BaseModel):
    name:          str
    class_id:      int
    max_theory:    int = 100
    max_practical: int = 0
    subject_type:  str = "Theory"

    @field_validator("max_theory")
    @classmethod
    def validate_max_theory(cls, v):
        if v <= 0:
            raise ValueError("max_theory must be greater than 0")
        return v

    @field_validator("max_practical")
    @classmethod
    def validate_max_practical(cls, v):
        if v < 0:
            raise ValueError("max_practical cannot be negative")
        return v


class SubjectUpdate(BaseModel):
    """PATCH-style — only provided fields are updated."""
    name:          Optional[str]  = None
    max_theory:    Optional[int]  = None
    max_practical: Optional[int]  = None
    subject_type:  Optional[str]  = None
    is_active:     Optional[bool] = None

    @field_validator("max_theory")
    @classmethod
    def validate_max_theory(cls, v):
        if v is not None and v <= 0:
            raise ValueError("max_theory must be greater than 0")
        return v

    @field_validator("max_practical")
    @classmethod
    def validate_max_practical(cls, v):
        if v is not None and v < 0:
            raise ValueError("max_practical cannot be negative")
        return v


class SubjectOut(BaseModel):
    id:            int
    name:          str
    class_id:      int
    max_theory:    int
    max_practical: int
    subject_type:  str
    is_active:     bool = True
    model_config = {"from_attributes": True}


class ExamCreate(BaseModel):
    name:             str
    class_id:         int
    academic_year_id: int
    exam_date:        Optional[date] = None


class ExamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:               int
    name:             str
    class_id:         int
    academic_year_id: int
    exam_date:        Optional[date]


# ── Exam Subject Config (per-exam max marks override) ─────────────────────

class ExamSubjectConfigCreate(BaseModel):
    """Override max marks for ONE subject in ONE exam."""
    subject_id:    int
    max_theory:    int
    max_practical: int = 0

    @field_validator("max_theory")
    @classmethod
    def validate_max_theory(cls, v):
        if v <= 0:
            raise ValueError("max_theory must be greater than 0")
        return v

    @field_validator("max_practical")
    @classmethod
    def validate_max_practical(cls, v):
        if v < 0:
            raise ValueError("max_practical cannot be negative")
        return v


class ExamSubjectConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:            int
    exam_id:       int
    subject_id:    int
    max_theory:    int
    max_practical: int


class ExamSubjectConfigBulk(BaseModel):
    """
    Set all subject configs for an exam in one call.
    Missing subjects fall back to their subject-level defaults.
    An empty list clears all custom configs (revert to defaults).
    """
    configs: List[ExamSubjectConfigCreate]


# ── Marks entry ───────────────────────────────────────────────────────────

class MarkEntry(BaseModel):
    student_id:      int
    subject_id:      int
    exam_id:         int
    theory_marks:    Optional[Decimal] = None
    practical_marks: Optional[Decimal] = None
    is_absent:       bool = False

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
    theory_marks:    Optional[Decimal] = None
    practical_marks: Optional[Decimal] = None
    is_absent:       Optional[bool]    = None

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

    id:              int
    student_id:      int
    subject_id:      int
    exam_id:         int
    theory_marks:    Optional[Decimal]
    practical_marks: Optional[Decimal]
    is_absent:       bool

    @computed_field
    @property
    def marks_obtained(self) -> Optional[Decimal]:
        return self.theory_marks

class StudentResult(BaseModel):
    student_id:   int
    student_name: str
    roll_number:  Optional[int]
    subjects:     list[dict]
    total_marks:  Decimal
    max_marks:    Decimal
    percentage:   Decimal
    cgpa:         Decimal
    grade:        str
    result:       str
    class_rank:   Optional[int] = None

"""
schemas/student.py

FIXES APPLIED:
  - Minor 1: Removed redundant computed fields (date_of_birth, contact_number,
             first_name, last_name, first_name_gujarati, last_name_gujarati)
             that duplicated dob / contact / name_en / name_gu.
             They were doubling API response size and confusing API consumers.
             Legacy field names in StudentUpdate.normalize_legacy_fields are
             kept so existing integrations that POST with old names still work.
  - Minor 2: Removed spurious `data.pop("max_marks", None)` from StudentUpdate
             validator — max_marks is a marks-domain field, never a student field.
  - Security: aadhar field now stores only last 4 digits (aadhar_last4).
"""

from datetime import date
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class GenderEnum(str, Enum):
    M = "M"
    F = "F"
    Other = "Other"


class StudentStatusEnum(str, Enum):
    Active = "Active"
    TC_Issued = "TC Issued"
    Left = "Left"
    Passed_Out = "Passed Out"


class StudentCreate(BaseModel):
    name_en:          str = ""
    name_gu:          str = ""
    dob:              date
    gender:           GenderEnum
    class_id:         int
    roll_number:      Optional[int]  = None
    gr_number:        Optional[str]  = None
    father_name:      str
    mother_name:      Optional[str]  = None
    contact:          str
    address:          Optional[str]  = None
    category:         Optional[str]  = None
    # SECURITY FIX: only last 4 digits accepted from clients
    aadhar_last4:     Optional[str]  = Field(None, max_length=4, pattern=r"^\d{4}$")
    admission_date:   date
    academic_year_id: int

    @field_validator("contact")
    @classmethod
    def validate_contact(cls, value: str) -> str:
        if not value.isdigit() or len(value) != 10 or value.startswith("0"):
            raise ValueError(
                "Contact must be a 10-digit number and cannot start with 0"
            )
        return value

    @field_validator("roll_number")
    @classmethod
    def validate_roll_number(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value <= 0:
            raise ValueError("Roll number must be greater than 0")
        return value

    @field_validator("dob")
    @classmethod
    def validate_dob(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Date of birth cannot be in the future")
        return value


class StudentUpdate(BaseModel):
    name_en:          Optional[str]              = None
    name_gu:          Optional[str]              = None
    dob:              Optional[date]             = None
    gender:           Optional[GenderEnum]       = None
    class_id:         Optional[int]              = None
    roll_number:      Optional[int]              = None
    gr_number:        Optional[str]              = None
    father_name:      Optional[str]              = None
    mother_name:      Optional[str]              = None
    contact:          Optional[str]              = None
    address:          Optional[str]              = None
    category:         Optional[str]              = None
    aadhar_last4:     Optional[str]              = Field(None, max_length=4, pattern=r"^\d{4}$")
    admission_date:   Optional[date]             = None
    academic_year_id: Optional[int]              = None
    status:           Optional[StudentStatusEnum] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_fields(cls, data):
        """
        Accept legacy field names from older API clients / integrations.
        MINOR 2 FIX: Removed `data.pop("max_marks", None)` — that field
        belongs to the marks domain, never to a student payload.
        """
        if not isinstance(data, dict):
            return data

        data = dict(data)

        # contact_number → contact
        if "contact_number" in data and "contact" not in data:
            data["contact"] = data.pop("contact_number")

        # date_of_birth → dob
        if "date_of_birth" in data and "dob" not in data:
            data["dob"] = data.pop("date_of_birth")

        # first_name + last_name → name_en
        first_name = data.pop("first_name", None)
        last_name  = data.pop("last_name",  None)
        if (first_name or last_name) and "name_en" not in data:
            data["name_en"] = " ".join(
                part for part in [first_name, last_name] if part
            ).strip()

        # first_name_gujarati + last_name_gujarati → name_gu
        first_name_gu = data.pop("first_name_gujarati", None)
        last_name_gu  = data.pop("last_name_gujarati",  None)
        if (first_name_gu or last_name_gu) and "name_gu" not in data:
            data["name_gu"] = " ".join(
                part for part in [first_name_gu, last_name_gu] if part
            ).strip()

        # Legacy aadhar (full 12-digit) → silently take last 4 only
        if "aadhar" in data and "aadhar_last4" not in data:
            full = str(data.pop("aadhar") or "")
            data["aadhar_last4"] = full[-4:] if len(full) >= 4 else None

        return data

    @field_validator("contact")
    @classmethod
    def validate_contact(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not value.isdigit() or len(value) != 10 or value.startswith("0"):
            raise ValueError(
                "Contact must be a 10-digit number and cannot start with 0"
            )
        return value

    @field_validator("roll_number")
    @classmethod
    def validate_roll_number(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value <= 0:
            raise ValueError("Roll number must be greater than 0")
        return value

    @field_validator("dob")
    @classmethod
    def validate_dob(cls, value: Optional[date]) -> Optional[date]:
        if value is not None and value > date.today():
            raise ValueError("Date of birth cannot be in the future")
        return value


class StudentOut(BaseModel):
    """
    MINOR 1 FIX: Removed the six redundant computed fields that duplicated
    dob/contact/name_en/name_gu under legacy names.  They doubled the JSON
    payload size (every student response carried 12 name/date/contact fields
    instead of 6) and made API responses confusing to consume.

    If a frontend or integration NEEDS legacy names, add a versioned endpoint
    or use the StudentOutLegacy schema below rather than polluting the primary
    schema.
    """
    model_config = ConfigDict(from_attributes=True)

    id:               int
    student_id:       str
    name_en:          str
    name_gu:          str
    dob:              date
    gender:           GenderEnum
    class_id:         int
    roll_number:      Optional[int]
    gr_number:        Optional[str]
    father_name:      str
    mother_name:      Optional[str]
    contact:          str
    address:          Optional[str]
    category:         Optional[str]
    aadhar_last4:     Optional[str] = None
    admission_date:   date
    academic_year_id: int
    status:           StudentStatusEnum


class StudentOutLegacy(StudentOut):
    """
    Legacy wrapper that re-exposes old field names for backward compatibility
    with any existing frontend code that reads first_name / contact_number / dob.
    Import this in routers that need to stay backward-compatible.
    """
    from pydantic import computed_field

    @computed_field
    @property
    def first_name(self) -> str:
        return (self.name_en or "").strip().split(" ", 1)[0]

    @computed_field
    @property
    def last_name(self) -> str:
        parts = (self.name_en or "").strip().split(" ", 1)
        return parts[1] if len(parts) > 1 else ""

    @computed_field
    @property
    def first_name_gujarati(self) -> str:
        return (self.name_gu or "").strip().split(" ", 1)[0]

    @computed_field
    @property
    def last_name_gujarati(self) -> str:
        parts = (self.name_gu or "").strip().split(" ", 1)
        return parts[1] if len(parts) > 1 else ""

    @computed_field
    @property
    def contact_number(self) -> str:
        return self.contact

    @computed_field
    @property
    def date_of_birth(self) -> date:
        return self.dob

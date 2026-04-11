from datetime import date
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator


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
    name_en: str = ""
    name_gu: str = ""
    dob: date
    gender: GenderEnum
    class_id: int
    roll_number: Optional[int] = None
    gr_number: Optional[str] = None
    father_name: str
    mother_name: Optional[str] = None
    contact: str
    address: Optional[str] = None
    category: Optional[str] = None
    aadhar: Optional[str] = None
    admission_date: date
    academic_year_id: int

    @field_validator("contact")
    @classmethod
    def validate_contact(cls, value: str) -> str:
        if not value.isdigit() or len(value) != 10 or value.startswith("0"):
            raise ValueError("Contact must be a 10-digit number and cannot start with 0")
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
    name_en: Optional[str] = None
    name_gu: Optional[str] = None
    dob: Optional[date] = None
    gender: Optional[GenderEnum] = None
    class_id: Optional[int] = None
    roll_number: Optional[int] = None
    gr_number: Optional[str] = None
    father_name: Optional[str] = None
    mother_name: Optional[str] = None
    contact: Optional[str] = None
    address: Optional[str] = None
    category: Optional[str] = None
    aadhar: Optional[str] = None
    admission_date: Optional[date] = None
    academic_year_id: Optional[int] = None
    status: Optional[StudentStatusEnum] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_fields(cls, data):
        if not isinstance(data, dict):
            return data

        data = dict(data)

        if "contact_number" in data and "contact" not in data:
            data["contact"] = data.pop("contact_number")
        if "date_of_birth" in data and "dob" not in data:
            data["dob"] = data.pop("date_of_birth")

        first_name = data.pop("first_name", None)
        last_name = data.pop("last_name", None)
        if (first_name or last_name) and "name_en" not in data:
            data["name_en"] = " ".join(part for part in [first_name, last_name] if part).strip()

        first_name_gu = data.pop("first_name_gujarati", None)
        last_name_gu = data.pop("last_name_gujarati", None)
        if (first_name_gu or last_name_gu) and "name_gu" not in data:
            data["name_gu"] = " ".join(part for part in [first_name_gu, last_name_gu] if part).strip()

        return data

    @field_validator("contact")
    @classmethod
    def validate_contact(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not value.isdigit() or len(value) != 10 or value.startswith("0"):
            raise ValueError("Contact must be a 10-digit number and cannot start with 0")
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
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: str
    name_en: str
    name_gu: str
    dob: date
    gender: GenderEnum
    class_id: int
    roll_number: Optional[int]
    gr_number: Optional[str]
    father_name: str
    mother_name: Optional[str]
    contact: str
    address: Optional[str]
    category: Optional[str]
    aadhar: Optional[str] = None
    admission_date: date
    academic_year_id: int
    status: StudentStatusEnum

    @computed_field
    @property
    def first_name(self) -> str:
        return (self.name_en or "").strip().split(" ", 1)[0] if self.name_en else ""

    @computed_field
    @property
    def last_name(self) -> str:
        parts = (self.name_en or "").strip().split(" ", 1)
        return parts[1] if len(parts) > 1 else ""

    @computed_field
    @property
    def first_name_gujarati(self) -> str:
        return (self.name_gu or "").strip().split(" ", 1)[0] if self.name_gu else ""

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

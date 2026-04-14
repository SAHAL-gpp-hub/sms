from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date
from enum import Enum

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
    name_en: str
    name_gu: str
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
    def validate_contact(cls, v):
        if not v.isdigit() or len(v) != 10:
            raise ValueError("Contact must be a 10-digit number")
        if v.startswith("0"):
            raise ValueError("Contact number must not start with 0")
        return v

    @field_validator("dob")
    @classmethod
    def validate_dob(cls, v):
        if v > date.today():
            raise ValueError("Date of birth cannot be in the future")
        return v

    @field_validator("roll_number")
    @classmethod
    def validate_roll_number(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Roll number must be greater than 0")
        return v

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
    status: Optional[StudentStatusEnum] = None

    @field_validator("contact")
    @classmethod
    def validate_contact(cls, v):
        if v is not None:
            if not v.isdigit() or len(v) != 10:
                raise ValueError("Contact must be a 10-digit number")
            if v.startswith("0"):
                raise ValueError("Contact number must not start with 0")
        return v

    @field_validator("roll_number")
    @classmethod
    def validate_roll_number(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Roll number must be greater than 0")
        return v

class StudentOut(BaseModel):
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
    admission_date: date
    academic_year_id: int
    status: StudentStatusEnum

    model_config = {"from_attributes": True}

"""
schemas/student.py

FIXES:
  BUG-C: The aadhar field in StudentCreate accepted a 12-digit string
  ("12-digit Aadhar") but the DB column (after migration 384df2f48f9d)
  only stores the last 4 digits (aadhar_last4 VARCHAR(4)).

  The old normalize_legacy_fields validator silently truncated the input —
  the user typed 12 digits, saw no error, and had no idea data was lost.
  This is both a UX failure and a compliance risk under the Aadhaar Act.

  Fix: rename the field to aadhar_last4, enforce maxLength=4, and let the
  frontend (already updated in StudentForm.jsx) show the correct label
  "Last 4 Digits of Aadhar".
"""

from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date
from enum import Enum


class GenderEnum(str, Enum):
    M     = "M"
    F     = "F"
    Other = "Other"


class StudentStatusEnum(str, Enum):
    Active     = "Active"
    TC_Issued  = "TC Issued"
    Left       = "Left"
    Passed_Out = "Passed Out"


class StudentCreate(BaseModel):
    name_en:          str
    name_gu:          str
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
    # BUG-C FIX: was 'aadhar' (12-digit placeholder) — now aadhar_last4 (4 digits max)
    aadhar_last4:     Optional[str]  = None
    admission_date:   date
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

    @field_validator("aadhar_last4")
    @classmethod
    def validate_aadhar_last4(cls, v):
        if v is None:
            return v
        # Strip whitespace and accept only digits
        v = v.strip()
        if v == "":
            return None
        if not v.isdigit() or len(v) > 4:
            raise ValueError("Aadhar last 4 digits must be exactly 4 numeric digits")
        return v.zfill(4)  # pad to 4 digits if fewer were provided


class StudentUpdate(BaseModel):
    name_en:       Optional[str]              = None
    name_gu:       Optional[str]              = None
    dob:           Optional[date]             = None
    gender:        Optional[GenderEnum]       = None
    class_id:      Optional[int]              = None
    roll_number:   Optional[int]              = None
    gr_number:     Optional[str]              = None
    father_name:   Optional[str]              = None
    mother_name:   Optional[str]              = None
    contact:       Optional[str]              = None
    address:       Optional[str]              = None
    category:      Optional[str]              = None
    status:        Optional[StudentStatusEnum] = None
    # STEP 3.8 FIX: aadhar_last4 and admission_date were missing from
    # StudentUpdate, so updating these fields via PUT /students/{id} was
    # silently ignored (the field values were excluded from model_dump).
    aadhar_last4:    Optional[str]  = None
    admission_date:  Optional[date] = None

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

    @field_validator("aadhar_last4")
    @classmethod
    def validate_aadhar_last4(cls, v):
        if v is None:
            return v
        v = v.strip()
        if v == "":
            return None
        if not v.isdigit() or len(v) > 4:
            raise ValueError("Aadhar last 4 digits must be exactly 4 numeric digits")
        return v.zfill(4)


class StudentOut(BaseModel):
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
    admission_date:   date
    academic_year_id: int
    status:           StudentStatusEnum

    model_config = {"from_attributes": True}

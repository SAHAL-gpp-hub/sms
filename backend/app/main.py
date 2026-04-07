from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import students, setup, fees, marks, pdf, attendance, yearend
from app.core.database import engine, Base
from app.models.base_models import *  # noqa

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="School Management System — GSEB",
    version="1.0.0",
    description="SMS for Iqra English Medium School"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:80", "http://localhost", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(students.router)
app.include_router(setup.router)
app.include_router(fees.router)
app.include_router(marks.router)
app.include_router(pdf.router)
app.include_router(attendance.router)
app.include_router(yearend.router)

@app.get("/")
def root():
    return {"status": "SMS Backend is running ✅"}

@app.get("/health")
def health():
    return {"status": "ok"}
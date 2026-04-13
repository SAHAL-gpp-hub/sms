from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.routers import students, setup, fees, marks, pdf, attendance, yearend, auth
from app.routers.auth import get_current_user
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

# C-01 FIX: Auth router included first (unprotected — needed for login/register)
app.include_router(auth.router)

# C-01 FIX: All other routers now require a valid JWT token
app.include_router(students.router,   dependencies=[Depends(get_current_user)])
app.include_router(setup.router,      dependencies=[Depends(get_current_user)])
app.include_router(fees.router,       dependencies=[Depends(get_current_user)])
app.include_router(marks.router,      dependencies=[Depends(get_current_user)])
app.include_router(pdf.router,        dependencies=[Depends(get_current_user)])
app.include_router(attendance.router, dependencies=[Depends(get_current_user)])
app.include_router(yearend.router,    dependencies=[Depends(get_current_user)])


@app.get("/")
def root():
    return {"status": "SMS Backend is running ✅"}


@app.get("/health")
def health():
    return {"status": "ok"}

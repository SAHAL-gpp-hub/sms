from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://sms_user:sms_pass@db:5432/school_sms"
    SECRET_KEY: str = "change-this-in-production-very-secret"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours

    class Config:
        env_file = ".env"

settings = Settings()
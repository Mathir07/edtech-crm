from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "EdTech Enterprise CRM"
    API_V1_STR: str = "/api/v1"
    
    # Environment & Secrets
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "edtech-crm-super-secret-key-change-in-production-min32chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database
    DATABASE_URL: str = "sqlite:///./crm.db"  # Defaults to local SQLite for immediate running, overridden by POSTGRESQL in production/docker
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost",
    ]

    # Company Mail Configuration (Disabled / Not Configured)
    MAIL_PROVIDER: str = "none"
    MAIL_FROM_NAME: str = "Kiwi Cloud Tech"
    MAIL_FROM_ADDRESS: str = ""

    MAIL_SMTP_HOST: str = ""
    MAIL_SMTP_PORT: int = 465
    MAIL_SMTP_SECURITY: str = "none"  # ssl, starttls, tls, none
    MAIL_SMTP_USERNAME: str = ""
    MAIL_SMTP_PASSWORD: str = ""

    MAIL_IMAP_HOST: str = ""
    MAIL_IMAP_PORT: int = 993
    MAIL_IMAP_SECURITY: str = "none"
    MAIL_IMAP_USERNAME: str = ""
    MAIL_IMAP_PASSWORD: str = ""

    # Legacy / Alternative aliases (backward-compatible)
    HOSTINGER_SMTP_HOST: str = ""
    HOSTINGER_SMTP_PORT: int = 465
    HOSTINGER_SMTP_USERNAME: str = ""
    HOSTINGER_SMTP_PASSWORD: str = ""
    HOSTINGER_SMTP_USE_TLS: bool = False
    HOSTINGER_SMTP_USE_SSL: bool = True
    HOSTINGER_IMAP_HOST: str = ""
    HOSTINGER_IMAP_PORT: int = 993
    HOSTINGER_IMAP_USERNAME: str = ""
    HOSTINGER_IMAP_PASSWORD: str = ""
    HOSTINGER_IMAP_USE_SSL: bool = True
    HOSTINGER_EMAIL_FROM: str = ""
    HOSTINGER_EMAIL_FROM_NAME: str = "Kiwi Cloud Tech"

    # Provider-Neutral Telephony Configuration (Phase 1 / Step 1B)
    TELEPHONY_ENABLED: bool = False
    TELEPHONY_PROVIDER: str = "none"
    TELEPHONY_BUSINESS_NUMBER: str = ""

    # WhatsApp Business API
    WHATSAPP_PROVIDER: str = "META_CLOUD"
    WHATSAPP_API_URL: str = "https://graph.facebook.com/v18.0"
    WHATSAPP_API_TOKEN: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_WEBHOOK_SECRET: str = ""

    # Communications & Notifications
    COMM_NOTIFICATION_EMAILS_ENABLED: bool = False

    # Legacy Telephony / Phone
    PHONE_PROVIDER: str = "none"
    PHONE_API_URL: str = ""
    PHONE_API_KEY: str = ""

    @property
    def effective_smtp_host(self) -> str:
        return self.MAIL_SMTP_HOST or self.HOSTINGER_SMTP_HOST

    @property
    def effective_smtp_port(self) -> int:
        return self.MAIL_SMTP_PORT or self.HOSTINGER_SMTP_PORT

    @property
    def effective_smtp_username(self) -> str:
        return self.MAIL_SMTP_USERNAME or self.HOSTINGER_SMTP_USERNAME

    @property
    def effective_smtp_password(self) -> str:
        return self.MAIL_SMTP_PASSWORD or self.HOSTINGER_SMTP_PASSWORD

    @property
    def effective_imap_host(self) -> str:
        return self.MAIL_IMAP_HOST or self.HOSTINGER_IMAP_HOST

    @property
    def effective_imap_port(self) -> int:
        return self.MAIL_IMAP_PORT or self.HOSTINGER_IMAP_PORT

    @property
    def effective_imap_username(self) -> str:
        return self.MAIL_IMAP_USERNAME or self.HOSTINGER_IMAP_USERNAME

    @property
    def effective_imap_password(self) -> str:
        return self.MAIL_IMAP_PASSWORD or self.HOSTINGER_IMAP_PASSWORD

    @property
    def effective_email_from(self) -> str:
        return self.MAIL_FROM_ADDRESS or self.HOSTINGER_EMAIL_FROM

    @property
    def effective_email_from_name(self) -> str:
        return self.MAIL_FROM_NAME or self.HOSTINGER_EMAIL_FROM_NAME

    # AI Assistant Configuration (Phase 12)
    AI_PROVIDER: str = "mock"
    AI_API_KEY: str = ""
    AI_MODEL: str = "gpt-4o-mini"
    AI_MAX_PROMPT_LENGTH: int = 2000
    AI_MAX_TOOL_RESULTS: int = 10

    # Production Database Connection Pooling (Phase 13)
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_RECYCLE: int = 1800
    DB_POOL_TIMEOUT: int = 30

    # Production Rate Limiting (Phase 13)
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_LOGIN_PER_MINUTE: int = 10
    RATE_LIMIT_AI_PER_MINUTE: int = 30
    RATE_LIMIT_COMM_PER_MINUTE: int = 20

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_production_database(cls, v: str, info) -> str:
        env = info.data.get("ENVIRONMENT", "development")
        if env == "production" and v.startswith("sqlite"):
            raise ValueError(
                "Production startup aborted: SQLite cannot be used as the production database. "
                "PostgreSQL must be used (e.g., postgresql+psycopg://USER:PASSWORD@db:5432/DATABASE)."
            )
        return v

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_production_secret(cls, v: str, info) -> str:
        env = info.data.get("ENVIRONMENT", "development")
        if env == "production":
            insecure_placeholders = {
                "edtech-crm-super-secret-key-change-in-production-min32chars",
                "CHANGE_ME_TO_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS",
                "CHANGE_ME_RANDOM_SECRET_MIN_32_CHARS",
                "replace-with-a-secure-random-32-character-secret-key-in-production",
            }
            if not v or v in insecure_placeholders or "CHANGE_ME" in v or len(v) < 32:
                raise ValueError(
                    "Production startup aborted: In production mode, SECRET_KEY must be a unique, "
                    "secure string of at least 32 characters."
                )
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

settings = Settings()

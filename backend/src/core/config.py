from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://orderflow:orderflow@localhost:5432/orderflow"

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_starter: str = ""
    stripe_price_business: str = ""
    stripe_price_pro: str = ""

    email_from: str = "no-reply@orderflow.example"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""

    frontend_base_url: str = "http://localhost:5173"
    trial_length_days: int = 14
    due_soon_days: int = 3

    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()

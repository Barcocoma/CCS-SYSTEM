import os

from dotenv import load_dotenv

load_dotenv()


def _is_truthy(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


class Config:
    """Application configuration"""

    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "jwt-secret-key-change-in-production")

    FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "")
    FIREBASE_DATABASE_ID = os.environ.get("FIREBASE_DATABASE_ID", "")
    FIREBASE_SERVICE_ACCOUNT_PATH = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH", "")
    FIREBASE_SERVICE_ACCOUNT_JSON = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "")
    FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON_BASE64", "")
    DB_MOCK = _is_truthy(
        os.environ.get("DB_MOCK")
        or os.environ.get("FIREBASE_MOCK")
    )

    PORT = int(os.environ.get("PORT", 5000))
    FLASK_ENV = os.environ.get("FLASK_ENV", "development")
    TESTING = False


class DevelopmentConfig(Config):
    """Development configuration"""

    DEBUG = True


class ProductionConfig(Config):
    """Production configuration"""

    DEBUG = False


class TestingConfig(Config):
    """Testing configuration"""

    DEBUG = False
    TESTING = True
    DB_MOCK = True


config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
    "default": DevelopmentConfig,
}

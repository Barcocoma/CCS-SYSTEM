import os
from urllib.parse import quote_plus

from dotenv import load_dotenv

load_dotenv()


def _is_truthy(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def build_mongo_uri():
    mongo_uri = os.environ.get("MONGO_URI")
    if mongo_uri:
        return mongo_uri

    mongo_host = os.environ.get("MONGO_HOST", "localhost")
    mongo_port = int(os.environ.get("MONGO_PORT", 27017))
    mongo_user = os.environ.get("MONGO_USER", "")
    mongo_password = os.environ.get("MONGO_PASSWORD", "")
    mongo_db_name = os.environ.get("MONGO_DB_NAME", "ccs_system")
    mongo_auth_db = os.environ.get("MONGO_AUTH_DB", "admin")

    if mongo_user and mongo_password:
        user = quote_plus(mongo_user)
        password = quote_plus(mongo_password)
        return f"mongodb://{user}:{password}@{mongo_host}:{mongo_port}/{mongo_db_name}?authSource={mongo_auth_db}"

    return f"mongodb://{mongo_host}:{mongo_port}/{mongo_db_name}"


class Config:
    """Application configuration"""

    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")

    MONGO_HOST = os.environ.get("MONGO_HOST", "localhost")
    MONGO_PORT = int(os.environ.get("MONGO_PORT", 27017))
    MONGO_USER = os.environ.get("MONGO_USER", "")
    MONGO_PASSWORD = os.environ.get("MONGO_PASSWORD", "")
    MONGO_DB_NAME = os.environ.get("MONGO_DB_NAME", "ccs_system")
    MONGO_AUTH_DB = os.environ.get("MONGO_AUTH_DB", "admin")
    MONGO_URI = build_mongo_uri()
    MONGO_MOCK = _is_truthy(os.environ.get("MONGO_MOCK"))

    PORT = int(os.environ.get("PORT", 5000))
    FLASK_ENV = os.environ.get("FLASK_ENV", "development")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "jwt-secret-key-change-in-production")
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
    MONGO_MOCK = True


config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
    "default": DevelopmentConfig,
}

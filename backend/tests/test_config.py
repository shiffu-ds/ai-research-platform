from backend.config import Settings


def test_settings_have_safe_defaults(monkeypatch):
    # Defaults must hold regardless of the shell running the tests
    # (CI sets DATABASE_URL for the RAG integration suite).
    for name in ("APP_ENV", "API_V1_PREFIX", "LOG_LEVEL", "DATABASE_URL", "REDIS_URL"):
        monkeypatch.delenv(name, raising=False)
    settings = Settings(_env_file=None)

    assert settings.app_env == "development"
    assert settings.api_v1_prefix == "/api/v1"
    assert settings.log_level == "INFO"
    assert settings.database_url is None
    assert settings.redis_url is None


def test_settings_read_environment_overrides(monkeypatch):
    monkeypatch.setenv("APP_ENV", "testing")
    monkeypatch.setenv("API_V1_PREFIX", "/api/test")
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+psycopg://user:pass@localhost:5432/testdb",
    )
    monkeypatch.setenv(
        "REDIS_URL",
        "redis://localhost:6380/0",
    )

    settings = Settings(_env_file=None)

    assert settings.app_env == "testing"
    assert settings.api_v1_prefix == "/api/test"
    assert settings.log_level == "DEBUG"
    assert (
        settings.database_url
        == "postgresql+psycopg://user:pass@localhost:5432/testdb"
    )
    assert settings.redis_url == "redis://localhost:6380/0"


def test_sqlalchemy_url_pins_the_psycopg3_driver(monkeypatch):
    for given, expected in [
        ("postgresql://u:p@db:5432/x", "postgresql+psycopg://u:p@db:5432/x"),
        ("postgres://u:p@db:5432/x", "postgresql+psycopg://u:p@db:5432/x"),
        ("postgresql+psycopg://u:p@db/x", "postgresql+psycopg://u:p@db/x"),
        ("sqlite:///tmp.db", "sqlite:///tmp.db"),
    ]:
        monkeypatch.setenv("DATABASE_URL", given)
        assert Settings(_env_file=None).sqlalchemy_database_url == expected

    monkeypatch.delenv("DATABASE_URL")
    assert Settings(_env_file=None).sqlalchemy_database_url is None

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    api_v1_prefix: str = "/api/v1"
    log_level: str = "INFO"

    database_url: str | None = None
    redis_url: str | None = None

    # Comma-separated browser origins allowed to call the API (e.g. the
    # frontend at http://localhost:3000). Empty means no cross-origin access.
    cors_origins: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]

    @property
    def sqlalchemy_database_url(self) -> str | None:
        """
        DATABASE_URL as SQLAlchemy should see it.

        The RAG module reads the same variable with psycopg directly, so it is
        usually a plain libpq URL (postgresql://…). SQLAlchemy 2.0 maps that
        scheme to psycopg2, which is not installed, so pin the psycopg (v3)
        driver explicitly. URLs that already name a driver are left alone.
        """
        url = self.database_url
        if not url:
            return url
        for prefix in ("postgresql://", "postgres://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url[len(prefix):]
        return url

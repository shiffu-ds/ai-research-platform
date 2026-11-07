from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from backend.config import Settings


settings = Settings()


def create_database_engine() -> Engine | None:
    url = settings.sqlalchemy_database_url
    if not url:
        return None

    return create_engine(
        url,
        pool_pre_ping=True,
        connect_args={
            "connect_timeout": 2,
        },
    )


engine = create_database_engine()

SessionLocal = (
    sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        class_=Session,
    )
    if engine is not None
    else None
)

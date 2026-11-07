from redis import Redis

from backend.config import Settings


settings = Settings()


def create_redis_client() -> Redis | None:
    if not settings.redis_url:
        return None

    return Redis.from_url(
        settings.redis_url,
        decode_responses=True,
        socket_connect_timeout=2,
        socket_timeout=2,
    )


redis_client = create_redis_client()

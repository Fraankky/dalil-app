from fastapi import Request
from slowapi import Limiter


def proxy_key_func(request: Request) -> str:
    """Trust upstream nginx XFF on the first hop."""
    xff = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if xff:
        return xff
    return request.client.host if request.client else ""


limiter = Limiter(key_func=proxy_key_func, default_limits=["60/minute"])

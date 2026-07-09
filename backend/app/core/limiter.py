from fastapi import Request
from slowapi import Limiter


def proxy_key_func(request: Request) -> str:
    """Trust the rightmost XFF hop (added by our nginx). Leftmost is client-spoofable."""
    xff = request.headers.get("x-forwarded-for", "")
    hops = [h.strip() for h in xff.split(",") if h.strip()]
    if hops:
        return hops[-1]
    return request.client.host if request.client else ""


limiter = Limiter(key_func=proxy_key_func, default_limits=["60/minute"])

"""
[SEC-H8] WebSocket authentication helpers.

Clients send the JWT as a subprotocol instead of in the URL, so it never lands in
proxy/server access logs:

    new WebSocket(url, ["access_token", "<jwt>"])

The server echoes "access_token" back when it accepts (see SubprotocolAcceptMixin).
Set WS_ALLOW_QUERY_TOKEN=True to also accept the old ?token= form during a rollout.
"""
from urllib.parse import parse_qs, urlparse

from channels.security.websocket import OriginValidator
from django.conf import settings

TOKEN_SUBPROTOCOL = "access_token"


def get_token_from_scope(scope):
    """Return the JWT from the subprotocol list (or ?token= when allowed), else None."""
    subprotocols = scope.get("subprotocols") or []
    if TOKEN_SUBPROTOCOL in subprotocols:
        index = subprotocols.index(TOKEN_SUBPROTOCOL)
        if index + 1 < len(subprotocols):
            return subprotocols[index + 1]

    if settings.WS_ALLOW_QUERY_TOKEN:
        query = parse_qs(scope.get("query_string", b"").decode())
        return query.get("token", [None])[0]

    return None


class SubprotocolAcceptMixin:
    """
    Put first in a consumer's bases. Browsers drop the connection if the server doesn't
    pick one of the offered subprotocols, so accept() echoes "access_token" when offered.
    """

    async def accept(self, subprotocol=None, headers=None):
        if subprotocol is None and TOKEN_SUBPROTOCOL in (self.scope.get("subprotocols") or []):
            subprotocol = TOKEN_SUBPROTOCOL
        await super().accept(subprotocol=subprotocol, headers=headers)


def allowed_ws_origins():
    """Hosts allowed to open sockets: ALLOWED_HOSTS + the CORS_ALLOWED_ORIGINS hosts."""
    origins = list(settings.ALLOWED_HOSTS)
    for origin in getattr(settings, "CORS_ALLOWED_ORIGINS", []):
        host = urlparse(origin).hostname
        if host:
            origins.append(host)

    if settings.DEBUG and not origins:
        origins = ["localhost", "127.0.0.1", "[::1]"]
    return origins


def with_origin_check(application):
    """Wrap the websocket app in an Origin check unless WS_ORIGIN_CHECK=False."""
    if not settings.WS_ORIGIN_CHECK:
        return application
    return OriginValidator(application, allowed_ws_origins())

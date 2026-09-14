"""Validate deployment-owned AiSummaryConfig without accepting model endpoints."""
from urllib.parse import urlsplit


def summary_configured(config) -> bool:
    if not isinstance(config, dict) or set(config) - {'conversationBaseUrl', 'env'}:
        return False
    base = config.get('conversationBaseUrl')
    if not isinstance(base, str) or not base.strip() or any(c.isspace() for c in base):
        return False
    try:
        url = urlsplit(base)
        if url.scheme not in {'http', 'https'} or not url.hostname or url.username or url.password or url.query or url.fragment:
            return False
        _ = url.port
    except ValueError:
        return False
    return 'env' not in config or isinstance(config['env'], str)

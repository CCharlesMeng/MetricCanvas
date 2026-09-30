"""Best-effort diagnostics. Callers supply fixed messages and safe scalar fields."""


def safe_log(logger, level, message, *args):
    """A broken logging sink must not change results or mask business exceptions.

    Never pass provider exception text, credentials or request/response bodies.
    Logging failure deliberately stops here; retrying the same sink is unsafe.
    Cancellation and other BaseException subclasses still propagate.
    """
    try:
        logger.log(level, message, *args)
    except Exception:
        # Intentional isolation boundary, not a recoverable business failure.
        return

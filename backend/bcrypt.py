"""Small bcrypt-compatible fallback for the demo auth flow.

The project imports ``bcrypt`` directly, but binary bcrypt wheels are not
available for the current Python 3.14 environment.  This module provides the
tiny API surface used by the app: ``gensalt``, ``hashpw`` and ``checkpw``.
"""
import base64
import hashlib
import hmac
import os


_ITERATIONS = 260_000


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def gensalt() -> bytes:
    return _b64(os.urandom(16)).encode("ascii")


def hashpw(password: bytes, salt: bytes) -> bytes:
    salt_text = salt.decode("utf-8")
    if salt_text.startswith("pbkdf2_sha256$"):
        salt_text = salt_text.split("$", 3)[2]
    salt_bytes = _unb64(salt_text)
    digest = hashlib.pbkdf2_hmac("sha256", password, salt_bytes, _ITERATIONS)
    return f"pbkdf2_sha256${_ITERATIONS}${salt_text}${_b64(digest)}".encode("ascii")


def checkpw(password: bytes, hashed: bytes) -> bool:
    try:
        algorithm, iterations, salt_text, digest_text = hashed.decode("utf-8").split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac("sha256", password, _unb64(salt_text), int(iterations))
        return hmac.compare_digest(_b64(digest), digest_text)
    except Exception:
        return False

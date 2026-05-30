"""Minimal jose-compatible JWT helper for local demo use."""
import base64
import datetime
import hashlib
import hmac
import json


class JWTError(Exception):
    pass


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


class jwt:
    @staticmethod
    def encode(payload, key, algorithm="HS256"):
        if algorithm != "HS256":
            raise JWTError("Only HS256 is supported by the local fallback")

        def default(value):
            if isinstance(value, (datetime.datetime, datetime.date)):
                return int(value.timestamp())
            raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")

        header = {"alg": "HS256", "typ": "JWT"}
        signing_input = ".".join([
            _b64(json.dumps(header, separators=(",", ":")).encode("utf-8")),
            _b64(json.dumps(payload, separators=(",", ":"), default=default).encode("utf-8")),
        ])
        signature = hmac.new(key.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256).digest()
        return f"{signing_input}.{_b64(signature)}"

    @staticmethod
    def decode(token, key, algorithms=None):
        if algorithms and "HS256" not in algorithms:
            raise JWTError("Only HS256 is supported by the local fallback")
        try:
            header_text, payload_text, signature_text = token.split(".")
            signing_input = f"{header_text}.{payload_text}"
            expected = hmac.new(key.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256).digest()
            if not hmac.compare_digest(_b64(expected), signature_text):
                raise JWTError("Invalid token signature")
            payload = json.loads(_unb64(payload_text))
            exp = payload.get("exp")
            if exp is not None and datetime.datetime.now(datetime.UTC).timestamp() > float(exp):
                raise JWTError("Token has expired")
            return payload
        except JWTError:
            raise
        except Exception as exc:
            raise JWTError("Invalid token") from exc

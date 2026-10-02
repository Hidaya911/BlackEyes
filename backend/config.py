"""Validated deployment settings. Never supply a built-in signing secret."""
import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().with_name('.env'))


def reset_token_secret() -> bytes:
    secret = os.environ.get('RESET_TOKEN_SECRET', '')
    if len(secret.encode()) < 32 or len(set(secret)) < 12 or secret != secret.strip():
        raise RuntimeError('RESET_TOKEN_SECRET must be a randomly generated secret of at least 32 bytes.')
    return secret.encode()


@dataclass(frozen=True)
class Settings:
    cors_origins: list[str]
    cookie_secure: bool
    frontend_url: str


def load_settings() -> Settings:
    reset_token_secret()
    environment = os.getenv('APP_ENV', 'development').lower()
    if environment not in {'development', 'test', 'production'}:
        raise RuntimeError('APP_ENV must be development, test, or production.')
    production = environment == 'production' or os.getenv('VERCEL') == '1'
    secure = os.getenv('COOKIE_SECURE', 'true' if production else 'false').lower()
    if secure not in {'true', 'false'} or (production and secure != 'true'):
        raise RuntimeError('COOKIE_SECURE must be true in production (true or false in development).')
    origins = [origin.strip() for origin in os.getenv(
        'CORS_ORIGINS', '' if production else 'http://localhost:5173,http://127.0.0.1:5173'
    ).split(',') if origin.strip()]
    frontend = os.getenv('FRONTEND_URL', '' if production else 'http://localhost:5173')
    for origin in [*origins, frontend]:
        parsed = urlsplit(origin)
        if (not parsed.hostname or parsed.scheme not in ({'https'} if production else {'http', 'https'})
                or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment
                or '*' in origin):
            raise RuntimeError('CORS_ORIGINS and FRONTEND_URL must be explicit origins without paths; production requires HTTPS.')
    return Settings(origins, secure == 'true', frontend)

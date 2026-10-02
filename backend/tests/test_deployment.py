"""Deployment settings, reset signatures, and cookie policy regressions."""
import os
import secrets
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi import HTTPException, Response
from fastapi.testclient import TestClient
from config import load_settings, reset_token_secret
from main import app
from routers.user import make_reset_token, read_reset_token, logout
from sessions import create_session


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {
            'RESET_TOKEN_SECRET': secrets.token_urlsafe(48), 'APP_ENV': 'production',
            'FRONTEND_URL': 'https://print.example.com',
            'CORS_ORIGINS': 'https://print.example.com',
        }, clear=True)
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def test_missing_and_weak_secrets_fail(self):
        for secret in ['', 'change-this-reset-secret', 'a' * 64, ' short ']:
            with self.subTest(secret=secret), patch.dict(os.environ, {'RESET_TOKEN_SECRET': secret}):
                with self.assertRaises(RuntimeError):
                    load_settings()

    def test_production_rejects_insecure_settings(self):
        for name, value in [('COOKIE_SECURE', 'false'), ('COOKIE_SECURE', 'yes'),
                            ('CORS_ORIGINS', '*'), ('CORS_ORIGINS', 'http://example.com'),
                            ('CORS_ORIGINS', 'https://example.com/path'),
                            ('CORS_ORIGINS', 'https://user:pass@example.com'),
                            ('FRONTEND_URL', ''), ('FRONTEND_URL', 'http://example.com')]:
            with self.subTest(name=name, value=value), patch.dict(os.environ, {name: value}):
                with self.assertRaises(RuntimeError):
                    load_settings()

    def test_same_origin_deployment_may_disable_cors(self):
        with patch.dict(os.environ, {'CORS_ORIGINS': ''}):
            self.assertEqual(load_settings().cors_origins, [])
        self.assertTrue(load_settings().cookie_secure)

    def test_copied_website_urls_are_normalized(self):
        origin = 'https://black-eyes-jdcaf7dju-teamss1.vercel.app'
        with patch.dict(os.environ, {'FRONTEND_URL': f' {origin}/\n',
                                     'CORS_ORIGINS': f' {origin}/, https://print.example.com/ '}):
            settings = load_settings()
            self.assertEqual(settings.frontend_url, origin)
            self.assertEqual(settings.cors_origins, [origin, 'https://print.example.com'])

    def test_invalid_origin_error_identifies_setting_without_exposing_value(self):
        for name in ('FRONTEND_URL', 'CORS_ORIGINS'):
            for value in ('https://example.com/path', 'https://example.com/?token=private',
                          'https://example.com/#fragment', 'https://example.com:invalid',
                          'https://example.com:99999', 'https://exa mple.com',
                          'https://user:private@example.com'):
                with self.subTest(name=name, value=value), patch.dict(os.environ, {name: value}):
                    with self.assertRaises(RuntimeError) as caught:
                        load_settings()
                    self.assertIn(name, str(caught.exception))
                    self.assertNotIn('private', str(caught.exception))

    def test_vercel_requires_production_cookie_policy(self):
        with patch.dict(os.environ, {'APP_ENV': 'development', 'VERCEL': '1', 'COOKIE_SECURE': 'false'}):
            with self.assertRaises(RuntimeError):
                load_settings()

    def test_reset_token_signature_expiry_and_rotation(self):
        token = make_reset_token('customer@example.com')
        self.assertEqual(read_reset_token(token), 'customer@example.com')
        with self.assertRaises(HTTPException):
            read_reset_token(token + 'x')
        with patch('routers.user.time.time', return_value=10**12), self.assertRaises(HTTPException):
            read_reset_token(token)
        with patch.dict(os.environ, {'RESET_TOKEN_SECRET': secrets.token_urlsafe(48)}):
            with self.assertRaises(HTTPException):
                read_reset_token(token)
        self.assertGreaterEqual(len(reset_token_secret()), 32)

    def test_session_and_logout_cookie_flags_match(self):
        response = Response()
        create_session(SimpleNamespace(user_id=1), response, Mock())
        cookie = response.headers['set-cookie']
        for flag in ['HttpOnly', 'Secure', 'SameSite=lax', 'Path=/']:
            self.assertIn(flag, cookie)
        response = Response()
        logout(SimpleNamespace(cookies={}), response, Mock())
        for flag in ['HttpOnly', 'Secure', 'SameSite=lax', 'Path=/']:
            self.assertIn(flag, response.headers['set-cookie'])

    def test_cors_allows_configured_origin_and_rejects_unknown_origin(self):
        # The application was initialized with the test process's environment.
        from main import settings_config
        if not settings_config.cors_origins:
            self.skipTest('CORS disabled for this test process')
        client = TestClient(app)
        origin = settings_config.cors_origins[0]
        response = client.options('/api/auth/login', headers={
            'Origin': origin, 'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type',
        })
        self.assertEqual(response.headers['access-control-allow-origin'], origin)
        self.assertEqual(response.headers['access-control-allow-credentials'], 'true')
        response = client.options('/api/auth/login', headers={
            'Origin': 'https://untrusted.invalid', 'Access-Control-Request-Method': 'POST',
        })
        self.assertEqual(response.status_code, 400)
        self.assertNotIn('access-control-allow-origin', response.headers)

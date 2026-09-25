import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.core.file_security import sanitize_filename, validate_uploaded_file
from fastapi import HTTPException

client = TestClient(app)

def test_liveness_health_check():
    """Verify GET /api/health returns 200 with service information."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "service" in data
    assert "environment" in data

def test_readiness_health_check():
    """Verify GET /api/health/readiness returns 200 and connected database status."""
    response = client.get("/api/health/readiness")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["database"] == "connected"

def test_security_headers_present():
    """Verify all critical production security headers are attached to responses."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "SAMEORIGIN"
    assert response.headers.get("X-XSS-Protection") == "1; mode=block"
    assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "Permissions-Policy" in response.headers
    assert "X-Request-ID" in response.headers

def test_request_id_propagation():
    """Verify custom X-Request-ID is propagated through middleware."""
    custom_id = "test-custom-request-id-12345"
    response = client.get("/api/health", headers={"X-Request-ID": custom_id})
    assert response.headers.get("X-Request-ID") == custom_id

def test_filename_sanitization_and_path_traversal():
    """Verify sanitize_filename strips path traversal sequences."""
    assert sanitize_filename("../../../etc/passwd") == "passwd"
    assert sanitize_filename("..\\..\\windows\\system32\\cmd.exe") == "cmd.exe"
    assert sanitize_filename("normal_file.pdf") == "normal_file.pdf"
    assert sanitize_filename("file with spaces & symbols!@.png") == "file_with_spaces___symbols__.png"
    assert sanitize_filename("") == "attachment"

def test_file_upload_validation():
    """Verify validate_uploaded_file enforces extensions and size limits."""
    # Allowed file
    safe_name = validate_uploaded_file("invoice.pdf", 1024)
    assert safe_name == "invoice.pdf"

    # Disallowed executable extension
    with pytest.raises(HTTPException) as exc:
        validate_uploaded_file("malicious_script.exe", 1024)
    assert exc.value.status_code == 400
    assert "strictly forbidden" in exc.value.detail

    # Disallowed script extension
    with pytest.raises(HTTPException) as exc:
        validate_uploaded_file("exploit.php", 1024)
    assert exc.value.status_code == 400

    # Oversized file
    with pytest.raises(HTTPException) as exc:
        validate_uploaded_file("huge.pdf", 20 * 1024 * 1024, max_size_bytes=10 * 1024 * 1024)
    assert exc.value.status_code == 400
    assert "exceeds maximum allowed limit" in exc.value.detail

def test_rate_limiting_on_login():
    """Verify sliding-window rate limiter trips after exceeding login limit."""
    # Configure low threshold for unit test
    original_enabled = settings.RATE_LIMIT_ENABLED
    original_limit = settings.RATE_LIMIT_LOGIN_PER_MINUTE
    settings.RATE_LIMIT_ENABLED = True
    settings.RATE_LIMIT_LOGIN_PER_MINUTE = 5
    try:
        status_codes = []
        for _ in range(7):
            res = client.post(
                "/api/v1/auth/login",
                json={"email": "ratelimit_test@example.com", "password": "WrongPassword123!"},
            )
            status_codes.append(res.status_code)
        
        # At least one request must have returned 429 Too Many Requests
        assert 429 in status_codes
        idx = status_codes.index(429)
        assert status_codes[idx] == 429
    finally:
        settings.RATE_LIMIT_LOGIN_PER_MINUTE = original_limit
        settings.RATE_LIMIT_ENABLED = original_enabled

def test_inactive_user_cannot_login(client, db_session):
    """Verify inactive users are rejected with HTTP 403."""
    from app.users.models import User
    from app.core.security import get_password_hash
    import uuid

    email = f"inactive_{uuid.uuid4().hex[:6]}@example.com"
    pwd = "TestPassword123!"
    user = User(
        email=email,
        hashed_password=get_password_hash(pwd),
        first_name="Inactive",
        last_name="Test",
        is_active=False,
    )
    db_session.add(user)
    db_session.commit()

    res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": pwd},
    )
    assert res.status_code == 403
    assert "inactive" in res.json()["detail"].lower()

def test_production_error_masking():
    """Verify production error handler masks internal tracebacks."""
    orig_env = settings.ENVIRONMENT
    settings.ENVIRONMENT = "production"
    try:
        # Trigger an unhandled route error by passing invalid non-existent path or error
        # Verify that even on 404 or 500, no traceback is leaked
        res = client.get("/api/v1/crm/colleges/invalid-uuid-non-existent")
        assert res.status_code in [401, 403, 404]
        assert "Traceback" not in res.text
    finally:
        settings.ENVIRONMENT = orig_env

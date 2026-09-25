"""
Production Object Storage Backend Unit Tests (Phase 2B Part 5)
Verifies:
1. LocalStorageBackend remains 100% compatible for local development/tests
2. ProductionStorageBackend configuration validation
3. Missing production credentials fail safely with explicit error
4. S3/R2-compatible upload persistence via mock S3 client
5. Binary streaming download and read_bytes byte-for-byte equality
6. Existence verification (exists)
7. Deletion behavior (delete)
8. Pre-signed URL generation (get_signed_url)
9. Object key format preservation (no local filesystem paths)
10. Strict refusal of silent fallback to local filesystem
11. Zero credential leakage in exceptions/logs
12. Factory get_storage_backend() routing based on STORAGE_BACKEND setting
"""

import io
import os
import tempfile
import pytest

from app.core.config import settings
from app.core.storage import (
    LocalStorageBackend,
    ProductionStorageBackend,
    StorageResult,
    get_storage_backend,
)


class MockS3Client:
    """Mock S3 client implementing standard Boto3 S3 client methods in-memory."""

    def __init__(self):
        self.objects = {}  # (bucket, key) -> {"Body": bytes, "ContentType": str, "ContentLength": int}

    def put_object(self, Bucket: str, Key: str, Body: bytes, ContentType: str = "application/octet-stream", **kwargs):
        data = Body if isinstance(Body, bytes) else Body.read()
        self.objects[(Bucket, Key)] = {
            "Body": data,
            "ContentType": ContentType,
            "ContentLength": len(data),
        }
        return {"ResponseMetadata": {"HTTPStatusCode": 200}}

    def get_object(self, Bucket: str, Key: str, **kwargs):
        if (Bucket, Key) not in self.objects:
            err = Exception("NoSuchKey: The specified key does not exist.")
            err.response = {"Error": {"Code": "NoSuchKey"}}
            raise err
        obj = self.objects[(Bucket, Key)]
        return {
            "Body": io.BytesIO(obj["Body"]),
            "ContentType": obj["ContentType"],
            "ContentLength": obj["ContentLength"],
        }

    def head_object(self, Bucket: str, Key: str, **kwargs):
        if (Bucket, Key) not in self.objects:
            err = Exception("Not Found (404)")
            err.response = {"Error": {"Code": "404"}}
            raise err
        obj = self.objects[(Bucket, Key)]
        return {
            "ContentType": obj["ContentType"],
            "ContentLength": obj["ContentLength"],
        }

    def delete_object(self, Bucket: str, Key: str, **kwargs):
        self.objects.pop((Bucket, Key), None)
        return {"ResponseMetadata": {"HTTPStatusCode": 204}}

    def generate_presigned_url(self, ClientMethod: str, Params: dict, ExpiresIn: int = 3600, **kwargs):
        bucket = Params.get("Bucket", "")
        key = Params.get("Key", "")
        return f"https://mock-r2.cloudflarestorage.com/{bucket}/{key}?signature=mock_sig&expires={ExpiresIn}"


@pytest.fixture
def mock_s3_backend():
    """Provides a ProductionStorageBackend instance wired to MockS3Client."""
    mock_client = MockS3Client()
    backend = ProductionStorageBackend(
        provider="r2",
        bucket_name="kct-crm-attachments-test",
        endpoint_url="https://mock-account-id.r2.cloudflarestorage.com",
        access_key_id="mock_access_key_12345",
        secret_access_key="mock_secret_key_67890",
        region="auto",
        client=mock_client,
    )
    return backend, mock_client


def test_local_storage_backend_remains_compatible():
    """Test 1: LocalStorageBackend continues to function identically without cloud dependencies."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        backend = LocalStorageBackend(base_dir=tmp_dir)
        payload = b"Local development attachment content"

        # Upload
        res = backend.upload(payload, "local_test.pdf", prefix="local_dev")
        assert isinstance(res, StorageResult)
        assert res.filename == "local_test.pdf"
        assert res.size == len(payload)
        assert res.key.startswith("local_dev/")

        # Exists
        assert backend.exists(res.key) is True

        # Read
        assert backend.read_bytes(res.key) == payload
        stream, ctype, size = backend.get_stream(res.key)
        assert stream.read() == payload
        assert size == len(payload)

        # Delete
        assert backend.delete(res.key) is True
        assert backend.exists(res.key) is False


def test_production_backend_configuration_validation():
    """Test 2: ProductionStorageBackend validates explicit credentials and configuration."""
    backend = ProductionStorageBackend(
        provider="s3",
        bucket_name="prod-crm-bucket",
        endpoint_url="https://s3.us-east-1.amazonaws.com",
        access_key_id="AKIAIOSFODNN7EXAMPLE",
        secret_access_key="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        region="us-east-1",
    )
    assert backend.bucket_name == "prod-crm-bucket"
    assert backend.provider == "s3"
    assert backend.region == "us-east-1"


def test_missing_credentials_fail_safely():
    """Test 3: Missing credentials fail explicitly with clear message naming missing env vars."""
    with pytest.raises(RuntimeError) as exc_info:
        ProductionStorageBackend(
            provider="r2",
            bucket_name="",
            access_key_id="",
            secret_access_key="",
        )
    err = str(exc_info.value)
    assert "STORAGE_BUCKET_NAME" in err
    assert "STORAGE_ACCESS_KEY_ID" in err
    assert "STORAGE_SECRET_ACCESS_KEY" in err
    assert "Refusing silent fallback to local filesystem" in err


def test_no_credential_leakage(monkeypatch):
    """Test 4: Error messages and string representations do not reveal secret credentials."""
    secret = "SUPER_SECRET_KEY_NEVER_LEAK_IN_LOGS_999"
    backend = ProductionStorageBackend(
        provider="r2",
        bucket_name="prod-bucket",
        access_key_id="PUBLIC_KEY_ID",
        secret_access_key=secret,
        client=MockS3Client(),
    )
    # Check repr / str
    assert secret not in str(backend)
    assert secret not in repr(backend)


def test_production_backend_upload(mock_s3_backend):
    """Test 5: S3 upload correctly validates, sanitizes, and persists object."""
    backend, mock_client = mock_s3_backend
    payload = b"%PDF-1.4 Mock document bytes for production S3 test"

    result = backend.upload(
        file_bytes=payload,
        filename="company_financials.pdf",
        content_type="application/pdf",
        prefix="finance/reports",
    )

    assert isinstance(result, StorageResult)
    assert result.filename == "company_financials.pdf"
    assert result.content_type == "application/pdf"
    assert result.size == len(payload)
    assert result.key.startswith("finance/reports/")
    assert "company_financials.pdf" in result.key

    # Check mock client state
    assert (backend.bucket_name, result.key) in mock_client.objects
    stored = mock_client.objects[(backend.bucket_name, result.key)]
    assert stored["Body"] == payload
    assert stored["ContentType"] == "application/pdf"


def test_production_backend_read_and_download_stream(mock_s3_backend):
    """Test 6: S3 get_stream and read_bytes return exact binary content."""
    backend, _ = mock_s3_backend
    payload = b"Diagnostic trace log content for ticket attachment"

    res = backend.upload(payload, "diag_trace.log", prefix="service/tickets/101")
    key = res.key

    # Test read_bytes
    assert backend.read_bytes(key) == payload

    # Test get_stream
    stream, content_type, size = backend.get_stream(key)
    try:
        assert stream.read() == payload
        assert size == len(payload)
        assert content_type == "text/plain"
    finally:
        stream.close()


def test_production_backend_exists_and_delete(mock_s3_backend):
    """Test 7 & 8: exists and delete methods work accurately against S3 backend."""
    backend, _ = mock_s3_backend
    payload = b"Temporary bug screenshot binary"

    res = backend.upload(payload, "screenshot.png", prefix="bugs/attachments")
    key = res.key

    # Check exists
    assert backend.exists(key) is True
    assert backend.exists("non_existent_key_xyz.png") is False

    # Check delete
    deleted = backend.delete(key)
    assert deleted is True
    assert backend.exists(key) is False

    # Delete again returns False (idempotent / already gone)
    assert backend.delete(key) is False


def test_production_backend_presigned_url(mock_s3_backend):
    """Test 9: Generates valid pre-signed URL for existing object, raises 404 for missing."""
    backend, _ = mock_s3_backend
    payload = b"Confidential client agreement"

    res = backend.upload(payload, "agreement.pdf", prefix="contracts")
    url = backend.get_signed_url(res.key, expires_in=1800)

    assert "https://mock-r2.cloudflarestorage.com" in url
    assert res.key in url
    assert "expires=1800" in url

    # Missing object raises FileNotFoundError
    with pytest.raises(FileNotFoundError):
        backend.get_signed_url("non_existent_doc.pdf")


def test_object_key_preservation(mock_s3_backend):
    """Test 10: Object keys never contain machine-specific filesystem paths."""
    backend, _ = mock_s3_backend
    payload = b"General communication attachment"

    res = backend.upload(payload, "announcement.txt", prefix="communications/messages/55")
    key = res.key

    # Must be cloud-ready key
    assert not key.startswith(("C:", "D:", "/", "\\"))
    assert not key.startswith(("/var/", "/home/", "storage/"))
    assert key.startswith("communications/messages/55/")


def test_no_local_fallback(monkeypatch):
    """Test 11: Production backend configuration strictly raises on missing creds without local fallback."""
    monkeypatch.setattr(settings, "STORAGE_BACKEND", "r2")
    monkeypatch.setattr(settings, "STORAGE_BUCKET_NAME", "")
    monkeypatch.setattr(settings, "STORAGE_ACCESS_KEY_ID", "")
    monkeypatch.setattr(settings, "STORAGE_SECRET_ACCESS_KEY", "")

    with pytest.raises(RuntimeError, match="Refusing silent fallback to local filesystem"):
        get_storage_backend()


def test_factory_selects_correct_backend(monkeypatch):
    """Test 12: get_storage_backend() accurately dispatches to the configured backend type."""
    # 1. Local backend
    monkeypatch.setattr(settings, "STORAGE_BACKEND", "local")
    local_backend = get_storage_backend()
    assert isinstance(local_backend, LocalStorageBackend)

    # 2. S3 backend with valid config
    monkeypatch.setattr(settings, "STORAGE_BACKEND", "s3")
    monkeypatch.setattr(settings, "STORAGE_BUCKET_NAME", "my-s3-bucket")
    monkeypatch.setattr(settings, "STORAGE_ACCESS_KEY_ID", "mock_key")
    monkeypatch.setattr(settings, "STORAGE_SECRET_ACCESS_KEY", "mock_secret")
    s3_backend = get_storage_backend()
    assert isinstance(s3_backend, ProductionStorageBackend)
    assert s3_backend.provider == "s3"

    # 3. R2 backend with valid config
    monkeypatch.setattr(settings, "STORAGE_BACKEND", "r2")
    r2_backend = get_storage_backend()
    assert isinstance(r2_backend, ProductionStorageBackend)
    assert r2_backend.provider == "r2"

    # 4. Unsupported backend raises ValueError
    monkeypatch.setattr(settings, "STORAGE_BACKEND", "unknown_provider_xyz")
    with pytest.raises(ValueError, match="Unsupported STORAGE_BACKEND"):
        get_storage_backend()

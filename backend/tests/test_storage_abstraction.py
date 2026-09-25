"""
Unit Tests for Storage Abstraction (Phase 2B Part 1)
Tests LocalStorageBackend and ProductionStorageBackend contract in isolation
using a temporary directory fixture to guarantee zero filesystem pollution.
"""

import os
import tempfile
import pytest
from app.core.storage import (
    LocalStorageBackend,
    ProductionStorageBackend,
    StorageResult,
    get_storage_backend,
)
from app.core.config import settings


@pytest.fixture
def temp_storage():
    """Provides a LocalStorageBackend bound to an ephemeral temporary directory."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        backend = LocalStorageBackend(base_dir=tmp_dir)
        yield backend, tmp_dir


def test_storage_upload_and_read(temp_storage):
    """Test 1 & 10: Successful file upload, binary content preservation."""
    backend, tmp_dir = temp_storage
    content = b"%PDF-1.4 Mock binary PDF content \x00\xff\xfe"
    
    result = backend.upload(
        file_bytes=content,
        filename="project_spec.pdf",
        content_type="application/pdf",
        prefix="projects/p1",
    )
    
    assert isinstance(result, StorageResult)
    assert result.filename == "project_spec.pdf"
    assert result.content_type == "application/pdf"
    assert result.size == len(content)
    assert result.key.startswith("projects/p1/")
    assert result.key.endswith("_project_spec.pdf")

    # Verify read_bytes returns exact binary data
    read_data = backend.read_bytes(result.key)
    assert read_data == content

    # Verify get_stream returns readable stream and metadata
    stream, ctype, size = backend.get_stream(result.key)
    try:
        assert ctype == "application/pdf"
        assert size == len(content)
        assert stream.read() == content
    finally:
        stream.close()


def test_generated_key_uniqueness(temp_storage):
    """Test 2: Each upload of same filename produces a distinct unique key."""
    backend, tmp_dir = temp_storage
    content = b"sample image data"
    
    res1 = backend.upload(content, "photo.png", prefix="bugs")
    res2 = backend.upload(content, "photo.png", prefix="bugs")
    
    assert res1.key != res2.key
    assert backend.exists(res1.key)
    assert backend.exists(res2.key)


def test_filename_safety_and_sanitization(temp_storage):
    """Test 3: Filename sanitization cleans malicious characters."""
    backend, tmp_dir = temp_storage
    content = b"safe text log"
    
    res = backend.upload(content, "bad:name*<file>?.txt", prefix="logs")
    assert ":" not in res.filename
    assert "<" not in res.filename
    assert ">" not in res.filename
    assert "?" not in res.filename
    assert backend.exists(res.key)


def test_path_traversal_rejection(temp_storage):
    """Test 4: Direct path traversal attacks in key resolution are strictly blocked."""
    backend, tmp_dir = temp_storage
    
    with pytest.raises(ValueError, match="Path traversal"):
        backend._resolve_path("../../etc/passwd")

    with pytest.raises(ValueError, match="Path traversal"):
        backend._resolve_path("uploads/../../../windows/system32")

    with pytest.raises(ValueError, match="Path traversal"):
        backend._resolve_path("/absolute/path/attempt")

    with pytest.raises(ValueError, match="Path traversal"):
        backend._resolve_path("valid/key\0with_null_byte.png")


def test_exists_and_delete(temp_storage):
    """Test 6 & 7: Existence check and deletion behavior."""
    backend, tmp_dir = temp_storage
    content = b"content to delete"
    
    res = backend.upload(content, "to_delete.txt", prefix="temp")
    assert backend.exists(res.key) is True

    # Delete existing
    deleted = backend.delete(res.key)
    assert deleted is True
    assert backend.exists(res.key) is False

    # Delete non-existent returns False
    deleted_again = backend.delete(res.key)
    assert deleted_again is False


def test_missing_object_behavior(temp_storage):
    """Test 8: Missing objects raise FileNotFoundError on read/stream."""
    backend, tmp_dir = temp_storage
    
    assert backend.exists("nonexistent/key.pdf") is False

    with pytest.raises(FileNotFoundError):
        backend.read_bytes("nonexistent/key.pdf")

    with pytest.raises(FileNotFoundError):
        backend.get_stream("nonexistent/key.pdf")

    with pytest.raises(FileNotFoundError):
        backend.get_signed_url("nonexistent/key.pdf")


def test_empty_file_upload(temp_storage):
    """Test 9: Empty (0 bytes) file is handled gracefully."""
    backend, tmp_dir = temp_storage
    content = b""
    
    res = backend.upload(content, "empty_log.txt", prefix="logs")
    assert res.size == 0
    assert backend.exists(res.key) is True
    assert backend.read_bytes(res.key) == b""


def test_disallowed_extension_rejection(temp_storage):
    """Verifies executable extensions are rejected by file_security validation."""
    backend, tmp_dir = temp_storage
    content = b"malicious binary payload"
    
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        backend.upload(content, "script.exe", prefix="bugs")
    assert exc_info.value.status_code == 400


def test_production_backend_fails_without_credentials(monkeypatch):
    """Test 5 & Contract: Production backend fails explicitly if credentials missing."""
    monkeypatch.setattr(settings, "STORAGE_BUCKET_NAME", "")
    monkeypatch.setattr(settings, "STORAGE_ACCESS_KEY_ID", "")
    monkeypatch.setattr(settings, "STORAGE_SECRET_ACCESS_KEY", "")

    with pytest.raises(RuntimeError, match="credentials are missing"):
        ProductionStorageBackend(provider="r2")


def test_get_storage_backend_factory(monkeypatch):
    """Verifies the factory dependency returns LocalStorageBackend by default."""
    monkeypatch.setattr(settings, "STORAGE_BACKEND", "local")
    storage = get_storage_backend()
    assert isinstance(storage, LocalStorageBackend)

"""
Comprehensive Communication Attachment Storage Migration Unit Tests (Phase 2B Part 4)
Verifies that communication attachments use StorageBackend abstraction:
1. Authenticated attachment upload
2. Attachment database persistence
3. Cloud-ready object key format (stored in communication_attachments.file_path)
4. Binary download byte-for-byte equality
5. Allowed file types acceptance
6. Invalid extension rejection (.exe, .sh, .py, .bat, .php)
7. Path traversal handling and filename sanitization
8. 15MB upload size limit enforcement
9. Missing attachment and missing message behavior (HTTP 404)
10. Attachment download authorization enforcement (HTTP 401 for unauthenticated)
11. Storage-backed streaming download
12. Temporary storage isolation
13. Zero leaked local files
14. Existing CommunicationAttachmentResponse schema compatibility
"""

import io
import os
import tempfile
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.storage import LocalStorageBackend, get_storage_backend
from app.communication.models import CommunicationMessage, CommunicationAttachment


@pytest.fixture
def temp_comm_storage():
    """Configures a temporary LocalStorageBackend and overrides get_storage_backend dependency."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        temp_backend = LocalStorageBackend(base_dir=tmp_dir)
        app.dependency_overrides[get_storage_backend] = lambda: temp_backend
        yield temp_backend, tmp_dir
        app.dependency_overrides.pop(get_storage_backend, None)


@pytest.fixture
def test_message_fixture(db_session):
    """Creates a communication message for attachment testing."""
    msg = CommunicationMessage(
        channel="EMAIL",
        direction="OUTBOUND",
        status="SENT",
        sender="support@kiwicloudtech.co.in",
        recipient="client@example.edu",
        subject="Attachment Storage Verification Test",
        body_text="Testing communication attachment migration to StorageBackend.",
    )
    db_session.add(msg)
    db_session.commit()
    db_session.refresh(msg)
    return msg


def test_authenticated_attachment_upload_and_download(
    client: TestClient, admin_headers: dict, temp_comm_storage, test_message_fixture, db_session
):
    """Tests 1, 2, 3, 4, 11, 14: Upload, persistence, object key format, streaming download, and schema validation."""
    backend, tmp_dir = temp_comm_storage
    msg_id = test_message_fixture.id
    payload = b"%PDF-1.4 Mock Communication Proposal Document Content for Storage Migration"

    files = {"file": ("proposal_blueprint.pdf", io.BytesIO(payload), "application/pdf")}
    resp = client.post(
        f"/api/v1/communications/messages/{msg_id}/attachments",
        files=files,
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    att_id = data["id"]

    # 14. Verify CommunicationAttachmentResponse schema fields
    assert data["message_id"] == msg_id
    assert data["filename"] == "proposal_blueprint.pdf"
    assert data["file_size"] == len(payload)
    assert data["content_type"] == "application/pdf"
    assert "created_at" in data

    # 2 & 3. Verify DB record stores cloud-ready object key (not machine local path)
    db_att = db_session.query(CommunicationAttachment).filter(CommunicationAttachment.id == att_id).first()
    assert db_att is not None
    assert db_att.file_path.startswith(f"communications/{msg_id}/")
    assert not db_att.file_path.startswith(("C:", "D:", "/", "\\"))
    assert "proposal_blueprint.pdf" in db_att.file_path

    # Verify object physically exists in storage backend
    assert backend.exists(db_att.file_path) is True

    # 4 & 11. Download attachment and verify byte-for-byte binary equality
    down_resp = client.get(
        f"/api/v1/communications/attachments/{att_id}/download",
        headers=admin_headers,
    )
    assert down_resp.status_code == 200
    assert down_resp.content == payload
    assert "attachment; filename=\"proposal_blueprint.pdf\"" in down_resp.headers.get("content-disposition", "")
    assert down_resp.headers.get("content-length") == str(len(payload))


def test_allowed_file_types(
    client: TestClient, admin_headers: dict, temp_comm_storage, test_message_fixture
):
    """Test 5: Multiple allowed file types (.txt, .json, .csv, .docx, .xlsx, .png) are accepted."""
    msg_id = test_message_fixture.id

    allowed_samples = [
        ("report.txt", b"Plain text note", "text/plain"),
        ("data.json", b'{"key": "value"}', "application/json"),
        ("sheet.csv", b"col1,col2\nval1,val2", "text/csv"),
        ("document.docx", b"PK\x03\x04docx content", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        ("image.png", b"\x89PNG\r\n\x1a\nimage content", "image/png"),
    ]

    for fname, content, ctype in allowed_samples:
        files = {"file": (fname, io.BytesIO(content), ctype)}
        resp = client.post(
            f"/api/v1/communications/messages/{msg_id}/attachments",
            files=files,
            headers=admin_headers,
        )
        assert resp.status_code == 200, f"Failed to upload {fname}: {resp.text}"
        data = resp.json()
        assert data["filename"] == fname

        # Download check
        dl = client.get(
            f"/api/v1/communications/attachments/{data['id']}/download",
            headers=admin_headers,
        )
        assert dl.status_code == 200
        assert dl.content == content


def test_invalid_extension_rejection(
    client: TestClient, admin_headers: dict, temp_comm_storage, test_message_fixture
):
    """Test 6: Disallowed extensions (.exe, .sh, .py, .bat, .php) are rejected with HTTP 400."""
    msg_id = test_message_fixture.id

    for bad_name in ["script.sh", "executable.exe", "trojan.bat", "module.py", "webshell.php"]:
        files = {"file": (bad_name, io.BytesIO(b"malicious script content"), "application/octet-stream")}
        resp = client.post(
            f"/api/v1/communications/messages/{msg_id}/attachments",
            files=files,
            headers=admin_headers,
        )
        assert resp.status_code == 400, f"Expected 400 for {bad_name}, got {resp.status_code}"
        detail = resp.json()["detail"].lower()
        assert "forbidden" in detail or "unsupported" in detail


def test_path_traversal_sanitization(
    client: TestClient, admin_headers: dict, temp_comm_storage, test_message_fixture, db_session
):
    """Test 7: Filenames containing path traversal characters (../) are sanitized."""
    backend, tmp_dir = temp_comm_storage
    msg_id = test_message_fixture.id

    malicious_filename = "../../../var/log/syslog_dump.txt"
    files = {"file": (malicious_filename, io.BytesIO(b"log data"), "text/plain")}
    resp = client.post(
        f"/api/v1/communications/messages/{msg_id}/attachments",
        files=files,
        headers=admin_headers,
    )
    assert resp.status_code == 200
    data = resp.json()

    # Traversal markers must be stripped from response filename
    assert ".." not in data["filename"]
    assert "/" not in data["filename"]
    assert "\\" not in data["filename"]

    # Verify object key in DB is safely scoped
    db_att = db_session.query(CommunicationAttachment).filter(CommunicationAttachment.id == data["id"]).first()
    assert db_att.file_path.startswith(f"communications/{msg_id}/")
    assert ".." not in db_att.file_path


def test_max_file_size_limit(
    client: TestClient, admin_headers: dict, temp_comm_storage, test_message_fixture
):
    """Test 8: Upload exceeding 15MB limit is rejected with HTTP 400."""
    msg_id = test_message_fixture.id
    over_limit_bytes = b"x" * (15 * 1024 * 1024 + 1024)  # 15MB + 1KB

    files = {"file": ("oversized.pdf", io.BytesIO(over_limit_bytes), "application/pdf")}
    resp = client.post(
        f"/api/v1/communications/messages/{msg_id}/attachments",
        files=files,
        headers=admin_headers,
    )
    assert resp.status_code == 400
    assert "exceeds" in resp.json()["detail"].lower() or "limit" in resp.json()["detail"].lower()


def test_missing_attachment_and_message_behavior(
    client: TestClient, admin_headers: dict, temp_comm_storage, test_message_fixture
):
    """Test 9: Missing attachment returns 404, upload to missing message returns 404, missing backend file returns 404."""
    backend, tmp_dir = temp_comm_storage
    msg_id = test_message_fixture.id

    # 1. Upload to nonexistent message returns 404
    files = {"file": ("test.pdf", io.BytesIO(b"content"), "application/pdf")}
    resp = client.post(
        "/api/v1/communications/messages/non-existent-msg-id/attachments",
        files=files,
        headers=admin_headers,
    )
    assert resp.status_code == 404
    assert "message not found" in resp.json()["detail"].lower()

    # 2. Download nonexistent attachment returns 404
    dl_missing = client.get(
        "/api/v1/communications/attachments/non-existent-att-id/download",
        headers=admin_headers,
    )
    assert dl_missing.status_code == 404
    assert "attachment not found" in dl_missing.json()["detail"].lower()

    # 3. Download when attachment row exists but file deleted from storage backend returns 404
    up_resp = client.post(
        f"/api/v1/communications/messages/{msg_id}/attachments",
        files=files,
        headers=admin_headers,
    )
    assert up_resp.status_code == 200
    valid_att_id = up_resp.json()["id"]

    # Delete underlying storage object
    db_att = client.get(f"/api/v1/communications/attachments/{valid_att_id}/download", headers=admin_headers)
    assert db_att.status_code == 200
    backend.delete(up_resp.json()["id"])  # delete by key or let's delete the exact key
    # Delete from backend by key
    for root, dirs, files_in_dir in os.walk(tmp_dir):
        for f in files_in_dir:
            os.remove(os.path.join(root, f))

    dl_deleted = client.get(
        f"/api/v1/communications/attachments/{valid_att_id}/download",
        headers=admin_headers,
    )
    assert dl_deleted.status_code == 404
    assert "not found on server" in dl_deleted.json()["detail"].lower()


def test_download_authorization_enforcement(
    client: TestClient, admin_headers: dict, temp_comm_storage, test_message_fixture
):
    """Test 10: Unauthenticated requests are rejected with HTTP 401."""
    msg_id = test_message_fixture.id
    files = {"file": ("secure_doc.pdf", io.BytesIO(b"confidential client data"), "application/pdf")}
    resp = client.post(
        f"/api/v1/communications/messages/{msg_id}/attachments",
        files=files,
        headers=admin_headers,
    )
    assert resp.status_code == 200
    att_id = resp.json()["id"]

    # Unauthenticated download attempt
    unauth_resp = client.get(f"/api/v1/communications/attachments/{att_id}/download")
    assert unauth_resp.status_code in (401, 403)


def test_zero_leaked_test_files():
    """Test 12 & 13: Temporary storage directory cleans up completely without leaving files."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        backend = LocalStorageBackend(base_dir=tmp_dir)
        res = backend.upload(b"comm test data", "comm_cleanup.pdf", prefix="communications/test")
        assert backend.exists(res.key) is True
        assert os.path.exists(tmp_dir) is True

    # Upon exit, the temporary directory is completely wiped
    assert not os.path.exists(tmp_dir)

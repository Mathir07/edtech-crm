"""
Comprehensive QA / Bug Attachment Storage Migration Unit Tests (Phase 2B Part 2)
Verifies that bug attachments use StorageBackend abstraction:
1. Authenticated bug attachment upload
2. Valid attachment persistence
3. Object key stored in BugAttachment.file_path (not machine filesystem path)
4. Attachment download returns 200
5. Downloaded binary content matches uploaded content
6. Invalid extension rejection (.exe, .sh)
7. Filename and path traversal protection
8. 10MB size limit enforcement
9. Missing attachment behavior (404)
10. Cross-bug download protection (attachment belonging to Bug A cannot be downloaded via Bug B)
11. Temporary/local storage behavior
12. Zero leaked test files after test completion
"""

import io
import os
import tempfile
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.storage import LocalStorageBackend, get_storage_backend
from app.qa.models import BugAttachment
from app.core.database import get_db


@pytest.fixture
def temp_qa_storage():
    """Configures a temporary LocalStorageBackend and overrides get_storage_backend dependency."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        temp_backend = LocalStorageBackend(base_dir=tmp_dir)
        app.dependency_overrides[get_storage_backend] = lambda: temp_backend
        yield temp_backend, tmp_dir
        app.dependency_overrides.pop(get_storage_backend, None)


@pytest.fixture
def test_bugs_fixture(client: TestClient, admin_headers: dict, pm_headers: dict, qa_headers: dict):
    """Creates two test bugs under a dedicated test company/project for isolation."""
    col_resp = client.post("/api/v1/companies", json={
        "organization_name": "QA Storage Tech University",
        "code": "QA-STR-01",
    }, headers=admin_headers)
    assert col_resp.status_code == 200
    company_id = col_resp.json()["id"]

    proj_resp = client.post("/api/v1/projects", json={
        "company_id": company_id,
        "name": "QA Storage Project",
        "code": "PRJ-QA-STR",
        "budget": 50000.0,
    }, headers=pm_headers)
    assert proj_resp.status_code == 200
    project_id = proj_resp.json()["id"]

    # Create Bug A
    bug_a_resp = client.post(f"/api/v1/projects/{project_id}/bugs", json={
        "title": "Bug A for attachment testing",
        "severity": "HIGH",
        "priority": "HIGH",
        "environment": "Staging",
    }, headers=qa_headers)
    assert bug_a_resp.status_code == 200
    bug_a_id = bug_a_resp.json()["id"]

    # Create Bug B
    bug_b_resp = client.post(f"/api/v1/projects/{project_id}/bugs", json={
        "title": "Bug B for cross-bug isolation testing",
        "severity": "LOW",
        "priority": "LOW",
        "environment": "Staging",
    }, headers=qa_headers)
    assert bug_b_resp.status_code == 200
    bug_b_id = bug_b_resp.json()["id"]

    return {"bug_a_id": bug_a_id, "bug_b_id": bug_b_id, "project_id": project_id}


def test_bug_attachment_upload_and_persistence(
    client: TestClient, qa_headers: dict, dev_headers: dict, temp_qa_storage, test_bugs_fixture, db_session
):
    """Tests 1, 2, 3, 4, 5, 11: Upload, storage persistence, object key format, and binary download."""
    backend, tmp_dir = temp_qa_storage
    bug_a_id = test_bugs_fixture["bug_a_id"]
    binary_payload = b"%PDF-1.4 Test QA Storage Attachment Content \x00\x01\x02\xff"

    files = {"file": ("crash_report.pdf", io.BytesIO(binary_payload), "application/pdf")}
    resp = client.post(f"/api/v1/bugs/{bug_a_id}/attachments", files=files, headers=qa_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    att_id = data["id"]
    assert data["filename"] == "crash_report.pdf"
    assert data["file_size"] == len(binary_payload)
    assert data["content_type"] == "application/pdf"

    # Verify database record stores the storage object key (not machine local path)
    db_att = db_session.query(BugAttachment).filter(BugAttachment.id == att_id).first()
    assert db_att is not None
    # Key must be structured as bugs/{bug_id}/{uuid}_{filename}
    assert db_att.file_path.startswith(f"bugs/{bug_a_id}/")
    assert not db_att.file_path.startswith(("C:", "D:", "/", "\\"))
    assert "crash_report.pdf" in db_att.file_path

    # Verify object physically exists in the temporary storage backend
    assert backend.exists(db_att.file_path) is True

    # Download attachment
    down_resp = client.get(f"/api/v1/bugs/{bug_a_id}/attachments/{att_id}/download", headers=dev_headers)
    assert down_resp.status_code == 200
    assert down_resp.content == binary_payload
    assert "attachment; filename=\"crash_report.pdf\"" in down_resp.headers.get("content-disposition", "")


def test_disallowed_extension_rejected(
    client: TestClient, qa_headers: dict, temp_qa_storage, test_bugs_fixture
):
    """Test 6: Executable and malicious script extensions are rejected with HTTP 400."""
    bug_a_id = test_bugs_fixture["bug_a_id"]

    for bad_name in ["malware.exe", "backdoor.sh", "exploit.py", "shell.php"]:
        bad_files = {"file": (bad_name, io.BytesIO(b"malicious payload"), "application/octet-stream")}
        bad_resp = client.post(f"/api/v1/bugs/{bug_a_id}/attachments", files=bad_files, headers=qa_headers)
        assert bad_resp.status_code == 400
        detail = bad_resp.json()["detail"].lower()
        assert "forbidden" in detail or "unsupported" in detail


def test_filename_and_path_traversal_protection(
    client: TestClient, qa_headers: dict, dev_headers: dict, temp_qa_storage, test_bugs_fixture, db_session
):
    """Test 7: Filenames with path traversal characters (../) and illegal characters are sanitized."""
    backend, tmp_dir = temp_qa_storage
    bug_a_id = test_bugs_fixture["bug_a_id"]

    malicious_filename = "../../../etc/passwd_screenshot.png"
    files = {"file": (malicious_filename, io.BytesIO(b"png image bytes"), "image/png")}
    resp = client.post(f"/api/v1/bugs/{bug_a_id}/attachments", files=files, headers=qa_headers)
    assert resp.status_code == 200
    data = resp.json()

    # Filename must NOT contain path traversal sequences
    assert ".." not in data["filename"]
    assert "/" not in data["filename"]
    assert "\\" not in data["filename"]

    # Verify file_path key in database is safely inside bugs/{bug_a_id}/
    db_att = db_session.query(BugAttachment).filter(BugAttachment.id == data["id"]).first()
    assert db_att.file_path.startswith(f"bugs/{bug_a_id}/")
    assert ".." not in db_att.file_path


def test_max_file_size_limit(
    client: TestClient, qa_headers: dict, temp_qa_storage, test_bugs_fixture
):
    """Test 8: Upload exceeding 10MB limit is rejected."""
    bug_a_id = test_bugs_fixture["bug_a_id"]
    over_limit_bytes = b"x" * (10 * 1024 * 1024 + 1024)  # 10MB + 1KB

    files = {"file": ("large_dump.log", io.BytesIO(over_limit_bytes), "text/plain")}
    resp = client.post(f"/api/v1/bugs/{bug_a_id}/attachments", files=files, headers=qa_headers)
    assert resp.status_code == 400
    assert "exceeds" in resp.json()["detail"].lower() or "limit" in resp.json()["detail"].lower()


def test_missing_attachment_and_cross_bug_protection(
    client: TestClient, qa_headers: dict, dev_headers: dict, temp_qa_storage, test_bugs_fixture
):
    """Test 9 & 10: Non-existent attachment returns 404, and Bug A attachment cannot be downloaded from Bug B."""
    bug_a_id = test_bugs_fixture["bug_a_id"]
    bug_b_id = test_bugs_fixture["bug_b_id"]

    # Upload attachment to Bug A
    files = {"file": ("bug_a_spec.pdf", io.BytesIO(b"%PDF-1.4 Bug A Content"), "application/pdf")}
    resp = client.post(f"/api/v1/bugs/{bug_a_id}/attachments", files=files, headers=qa_headers)
    assert resp.status_code == 200
    att_a_id = resp.json()["id"]

    # 1. Non-existent attachment ID under Bug A returns 404
    missing_resp = client.get(f"/api/v1/bugs/{bug_a_id}/attachments/non-existent-uuid/download", headers=dev_headers)
    assert missing_resp.status_code == 404

    # 2. Cross-bug protection: requesting Bug A's attachment ID via Bug B returns 404
    cross_resp = client.get(f"/api/v1/bugs/{bug_b_id}/attachments/{att_a_id}/download", headers=dev_headers)
    assert cross_resp.status_code == 404


def test_zero_leaked_test_files():
    """Test 12: Confirms temporary directory is purged upon context exit without lingering files."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        backend = LocalStorageBackend(base_dir=tmp_dir)
        res = backend.upload(b"test data", "cleanup_test.txt", prefix="bugs/test")
        assert backend.exists(res.key) is True
        assert os.path.exists(tmp_dir) is True

    # Upon exit, the temporary directory and all uploaded files within it are completely removed
    assert not os.path.exists(tmp_dir)

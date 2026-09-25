"""
Comprehensive Service / Ticket Attachment Storage Migration Unit Tests (Phase 2B Part 3)
Verifies that ticket attachments use StorageBackend abstraction:
1. Authenticated ticket attachment upload
2. Valid attachment persistence
3. Object key stored in TicketAttachment.file_path (not machine filesystem path)
4. Attachment download returns 200
5. Downloaded binary content matches uploaded content
6. Invalid extension rejection (.exe, .sh, .py, .php)
7. Filename and path traversal protection
8. 10MB size limit enforcement
9. Missing attachment behavior (404)
10. Cross-ticket download protection (attachment belonging to Ticket A cannot be downloaded via Ticket B)
11. Temporary/local storage behavior
12. Zero leaked test files after test completion
13. Existing TicketAttachmentResponse backwards compatibility (filename and file_name fields present)
"""

import io
import os
import tempfile
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.storage import LocalStorageBackend, get_storage_backend
from app.service.models import TicketAttachment
from app.core.database import get_db


@pytest.fixture
def temp_service_storage():
    """Configures a temporary LocalStorageBackend and overrides get_storage_backend dependency."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        temp_backend = LocalStorageBackend(base_dir=tmp_dir)
        app.dependency_overrides[get_storage_backend] = lambda: temp_backend
        yield temp_backend, tmp_dir
        app.dependency_overrides.pop(get_storage_backend, None)


@pytest.fixture
def test_tickets_fixture(client: TestClient, admin_headers: dict, service_exec_headers: dict, db_session):
    """Creates two test tickets under a test company for storage testing."""
    import uuid
    from app.organizations.models import Contact

    # 1. Create College / Company
    col_resp = client.post("/api/v1/companies", json={
        "organization_name": "Service Storage Institute of Technology",
        "code": "SRV-STR-01",
    }, headers=admin_headers)
    assert col_resp.status_code == 200
    company_id = col_resp.json()["id"]

    # Create associated Contact
    contact = Contact(
        company_id=company_id,
        name="Dean IT Service Storage",
        email=f"dean_{uuid.uuid4().hex[:6]}@servicestorage.edu",
    )
    db_session.add(contact)
    db_session.commit()
    contact_id = contact.id

    # 2. Create Ticket A
    tkt_a_resp = client.post("/api/v1/service/tickets", json={
        "company_id": company_id,
        "contact_id": contact_id,
        "subject": "Ticket A for attachment storage verification",
        "description": "Network latency and database connection pool timeouts",
        "priority": "HIGH",
        "severity": "MAJOR",
    }, headers=service_exec_headers)
    assert tkt_a_resp.status_code == 201, tkt_a_resp.text
    ticket_a_id = tkt_a_resp.json()["id"]

    # 3. Create Ticket B
    tkt_b_resp = client.post("/api/v1/service/tickets", json={
        "company_id": company_id,
        "contact_id": contact_id,
        "subject": "Ticket B for cross-ticket attachment isolation",
        "description": "User account password reset request",
        "priority": "LOW",
        "severity": "MINOR",
    }, headers=service_exec_headers)
    assert tkt_b_resp.status_code == 201, tkt_b_resp.text
    ticket_b_id = tkt_b_resp.json()["id"]

    return {"ticket_a_id": ticket_a_id, "ticket_b_id": ticket_b_id, "company_id": company_id}


def test_ticket_attachment_upload_and_download(
    client: TestClient, service_exec_headers: dict, service_readonly_headers: dict,
    temp_service_storage, test_tickets_fixture, db_session
):
    """Tests 1, 2, 3, 4, 5, 11, 13: Upload, persistence, object key format, binary download, and field compatibility."""
    backend, tmp_dir = temp_service_storage
    ticket_a_id = test_tickets_fixture["ticket_a_id"]
    binary_payload = b"Error 504 Gateway Timeout: connection pool exhausted at 10.0.4.12:6379\nStack trace: Line 42"

    files = {"file": ("error_trace.log", io.BytesIO(binary_payload), "text/plain")}
    data = {"is_internal_only": "false"}
    resp = client.post(
        f"/api/v1/service/tickets/{ticket_a_id}/attachments",
        files=files,
        data=data,
        headers=service_exec_headers,
    )
    assert resp.status_code == 200, resp.text
    res_data = resp.json()
    att_id = res_data["id"]

    # 13. Backwards compatibility: both filename and file_name must be present
    assert res_data["filename"] == "error_trace.log"
    assert res_data["file_name"] == "error_trace.log"
    assert res_data["file_size"] == len(binary_payload)
    assert res_data["content_type"] == "text/plain"

    # 3. Verify database record stores the storage object key (not machine local path)
    db_att = db_session.query(TicketAttachment).filter(TicketAttachment.id == att_id).first()
    assert db_att is not None
    assert db_att.file_path.startswith(f"tickets/{ticket_a_id}/")
    assert not db_att.file_path.startswith(("C:", "D:", "/", "\\"))
    assert "error_trace.log" in db_att.file_path

    # 2. Verify object physically exists in the temporary storage backend
    assert backend.exists(db_att.file_path) is True

    # 4 & 5. Download attachment and verify exact binary match
    down_resp = client.get(
        f"/api/v1/service/tickets/{ticket_a_id}/attachments/{att_id}/download",
        headers=service_readonly_headers,
    )
    assert down_resp.status_code == 200
    assert down_resp.content == binary_payload
    assert "attachment; filename=\"error_trace.log\"" in down_resp.headers.get("content-disposition", "")


def test_disallowed_file_extension_rejection(
    client: TestClient, service_exec_headers: dict, temp_service_storage, test_tickets_fixture
):
    """Test 6: Executables and scripts (.exe, .sh, .py, .php) are rejected with HTTP 400."""
    ticket_a_id = test_tickets_fixture["ticket_a_id"]

    for bad_name in ["malware.exe", "exploit.sh", "backdoor.py", "shell.php"]:
        bad_files = {"file": (bad_name, io.BytesIO(b"malicious executable"), "application/octet-stream")}
        bad_resp = client.post(
            f"/api/v1/service/tickets/{ticket_a_id}/attachments",
            files=bad_files,
            headers=service_exec_headers,
        )
        assert bad_resp.status_code == 400
        detail = bad_resp.json()["detail"].lower()
        assert "forbidden" in detail or "unsupported" in detail


def test_filename_and_path_traversal_protection(
    client: TestClient, service_exec_headers: dict, temp_service_storage, test_tickets_fixture, db_session
):
    """Test 7: Filenames with path traversal characters (../) and illegal characters are sanitized."""
    backend, tmp_dir = temp_service_storage
    ticket_a_id = test_tickets_fixture["ticket_a_id"]

    malicious_filename = "../../../etc/passwd_dump.csv"
    files = {"file": (malicious_filename, io.BytesIO(b"id,name\n1,root"), "text/csv")}
    resp = client.post(
        f"/api/v1/service/tickets/{ticket_a_id}/attachments",
        files=files,
        headers=service_exec_headers,
    )
    assert resp.status_code == 200
    data = resp.json()

    # Filename must NOT contain path traversal sequences
    assert ".." not in data["filename"]
    assert "/" not in data["filename"]
    assert "\\" not in data["filename"]

    # Verify file_path key in database is safely inside tickets/{ticket_a_id}/
    db_att = db_session.query(TicketAttachment).filter(TicketAttachment.id == data["id"]).first()
    assert db_att.file_path.startswith(f"tickets/{ticket_a_id}/")
    assert ".." not in db_att.file_path


def test_max_file_size_limit(
    client: TestClient, service_exec_headers: dict, temp_service_storage, test_tickets_fixture
):
    """Test 8: Upload exceeding 10MB limit is rejected."""
    ticket_a_id = test_tickets_fixture["ticket_a_id"]
    over_limit_bytes = b"x" * (10 * 1024 * 1024 + 1024)  # 10MB + 1KB

    files = {"file": ("large_log.log", io.BytesIO(over_limit_bytes), "text/plain")}
    resp = client.post(
        f"/api/v1/service/tickets/{ticket_a_id}/attachments",
        files=files,
        headers=service_exec_headers,
    )
    assert resp.status_code == 400
    assert "exceeds" in resp.json()["detail"].lower() or "limit" in resp.json()["detail"].lower()


def test_missing_attachment_and_cross_ticket_isolation(
    client: TestClient, service_exec_headers: dict, service_readonly_headers: dict,
    temp_service_storage, test_tickets_fixture
):
    """Test 9 & 10: Missing attachments return 404, and cross-ticket downloads are blocked."""
    ticket_a_id = test_tickets_fixture["ticket_a_id"]
    ticket_b_id = test_tickets_fixture["ticket_b_id"]

    # Upload attachment to Ticket A
    files = {"file": ("ticket_a_log.log", io.BytesIO(b"Ticket A Diagnostic Log"), "text/plain")}
    resp = client.post(
        f"/api/v1/service/tickets/{ticket_a_id}/attachments",
        files=files,
        headers=service_exec_headers,
    )
    assert resp.status_code == 200
    att_a_id = resp.json()["id"]

    # 1. Non-existent attachment ID under Ticket A returns 404
    missing_resp = client.get(
        f"/api/v1/service/tickets/{ticket_a_id}/attachments/non-existent-uuid/download",
        headers=service_readonly_headers,
    )
    assert missing_resp.status_code == 404

    # 2. Cross-ticket isolation: requesting Ticket A's attachment ID via Ticket B returns 404
    cross_resp = client.get(
        f"/api/v1/service/tickets/{ticket_b_id}/attachments/{att_a_id}/download",
        headers=service_readonly_headers,
    )
    assert cross_resp.status_code == 404


def test_zero_leaked_test_files():
    """Test 12: Confirms temporary directory is purged upon context exit without lingering files."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        backend = LocalStorageBackend(base_dir=tmp_dir)
        res = backend.upload(b"service test data", "service_cleanup.txt", prefix="tickets/test")
        assert backend.exists(res.key) is True
        assert os.path.exists(tmp_dir) is True

    # Upon exit, the temporary directory and all uploaded files within it are completely removed
    assert not os.path.exists(tmp_dir)

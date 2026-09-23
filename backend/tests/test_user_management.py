import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.users.models import User, Role, Department, Team
from app.core.security import verify_password

def test_admin_list_users(client: TestClient, admin_headers: dict):
    response = client.get("/api/v1/users", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    emails = [u["email"] for u in data]
    assert "test.admin@edtechcrm.com" in emails

def test_admin_create_user_with_role_and_dept(client: TestClient, admin_headers: dict, db_session: Session):
    roles_resp = client.get("/api/v1/roles", headers=admin_headers)
    assert roles_resp.status_code == 200
    roles = roles_resp.json()
    sales_role = next((r for r in roles if "Sales" in r["name"]), roles[0])

    depts_resp = client.get("/api/v1/departments", headers=admin_headers)
    assert depts_resp.status_code == 200
    depts = depts_resp.json()
    test_dept = depts[0]

    # Create team if needed
    team = db_session.query(Team).first()
    if not team:
        team = Team(name="KCT Test Team", department_id=test_dept["id"])
        db_session.add(team)
        db_session.commit()
        db_session.refresh(team)

    create_payload = {
        "email": "new.employee@kct.ac.in",
        "password": "TemporaryPassword123!",
        "first_name": "Test",
        "last_name": "Employee",
        "phone": "+91 9123456780",
        "department_id": test_dept["id"],
        "team_id": team.id,
        "is_active": True,
        "role_ids": [sales_role["id"]],
    }

    create_resp = client.post("/api/v1/users", json=create_payload, headers=admin_headers)
    assert create_resp.status_code == 200, create_resp.text
    user_data = create_resp.json()
    assert user_data["email"] == "new.employee@kct.ac.in"
    assert user_data["first_name"] == "Test"
    assert user_data["last_name"] == "Employee"
    assert user_data["is_active"] is True
    assert user_data["is_superuser"] is False
    assert len(user_data["roles"]) == 1
    assert "hashed_password" not in user_data

    # Verify newly created user can log in
    login_resp = client.post("/api/v1/auth/login", json={
        "email": "new.employee@kct.ac.in",
        "password": "TemporaryPassword123!",
    })
    assert login_resp.status_code == 200
    assert login_resp.json()["email"] == "new.employee@kct.ac.in"

def test_admin_edit_user_name_and_phone(client: TestClient, admin_headers: dict):
    # Create target user
    user_resp = client.post("/api/v1/users", json={
        "email": "edit.target@kct.ac.in",
        "password": "SecretPassword123!",
        "first_name": "InitialFirst",
        "last_name": "InitialLast",
        "phone": "+91 9999999999",
        "is_active": True,
    }, headers=admin_headers)
    assert user_resp.status_code == 200
    user_id = user_resp.json()["id"]

    # Update name and phone
    update_resp = client.put(f"/api/v1/users/{user_id}", json={
        "first_name": "UpdatedFirst",
        "last_name": "UpdatedLast",
        "phone": "+91 8888888888",
    }, headers=admin_headers)
    assert update_resp.status_code == 200
    updated_data = update_resp.json()
    assert updated_data["id"] == user_id
    assert updated_data["first_name"] == "UpdatedFirst"
    assert updated_data["last_name"] == "UpdatedLast"
    assert updated_data["phone"] == "+91 8888888888"

def test_admin_change_email_preserves_user_id(client: TestClient, admin_headers: dict):
    # Create user with initial email
    create_resp = client.post("/api/v1/users", json={
        "email": "old.email@demo.com",
        "password": "SecretPassword123!",
        "first_name": "Email",
        "last_name": "Tester",
        "is_active": True,
    }, headers=admin_headers)
    assert create_resp.status_code == 200
    original_id = create_resp.json()["id"]

    # Change email
    new_email = "real.employee@kct.ac.in"
    update_resp = client.put(f"/api/v1/users/{original_id}", json={
        "email": new_email,
    }, headers=admin_headers)
    assert update_resp.status_code == 200
    updated = update_resp.json()

    # CRITICAL: ID must remain the exact same UUID
    assert updated["id"] == original_id
    assert updated["email"] == new_email

    # Verify user can log in with new email and old password
    login_resp = client.post("/api/v1/auth/login", json={
        "email": new_email,
        "password": "SecretPassword123!",
    })
    assert login_resp.status_code == 200
    assert login_resp.json()["user_id"] == original_id

    # Verify old email cannot log in
    old_login = client.post("/api/v1/auth/login", json={
        "email": "old.email@demo.com",
        "password": "SecretPassword123!",
    })
    assert old_login.status_code == 401

def test_duplicate_email_rejected(client: TestClient, admin_headers: dict):
    # Create User A
    client.post("/api/v1/users", json={
        "email": "user.a@kct.ac.in",
        "password": "SecretPassword123!",
        "first_name": "User",
        "last_name": "A",
    }, headers=admin_headers)

    # Create User B
    resp_b = client.post("/api/v1/users", json={
        "email": "user.b@kct.ac.in",
        "password": "SecretPassword123!",
        "first_name": "User",
        "last_name": "B",
    }, headers=admin_headers)
    user_b_id = resp_b.json()["id"]

    # Try to change User B's email to User A's email
    conflict_resp = client.put(f"/api/v1/users/{user_b_id}", json={
        "email": "user.a@kct.ac.in",
    }, headers=admin_headers)
    assert conflict_resp.status_code == 400
    assert "already exists" in conflict_resp.json()["detail"].lower()

def test_admin_change_roles_department_team(client: TestClient, admin_headers: dict, db_session: Session):
    roles = client.get("/api/v1/roles", headers=admin_headers).json()
    depts = client.get("/api/v1/departments", headers=admin_headers).json()
    teams = client.get("/api/v1/teams", headers=admin_headers).json()

    user_resp = client.post("/api/v1/users", json={
        "email": "roledept.test@kct.ac.in",
        "password": "SecretPassword123!",
        "first_name": "Role",
        "last_name": "Dept",
        "role_ids": [roles[0]["id"]],
        "department_id": depts[0]["id"],
    }, headers=admin_headers)
    user_id = user_resp.json()["id"]

    # Change to second role and second department
    new_role_id = roles[1]["id"] if len(roles) > 1 else roles[0]["id"]
    new_dept_id = depts[1]["id"] if len(depts) > 1 else depts[0]["id"]
    new_team_id = teams[0]["id"] if len(teams) > 0 else None

    update_resp = client.put(f"/api/v1/users/{user_id}", json={
        "role_ids": [new_role_id],
        "department_id": new_dept_id,
        "team_id": new_team_id,
    }, headers=admin_headers)
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert any(r["id"] == new_role_id for r in updated["roles"])
    assert updated["department_id"] == new_dept_id
    if new_team_id:
        assert updated["team_id"] == new_team_id

def test_admin_activate_and_deactivate_user(client: TestClient, admin_headers: dict):
    user_resp = client.post("/api/v1/users", json={
        "email": "deactivate.target@kct.ac.in",
        "password": "SecretPassword123!",
        "first_name": "Active",
        "last_name": "Target",
        "is_active": True,
    }, headers=admin_headers)
    user_id = user_resp.json()["id"]

    # Deactivate user
    deact_resp = client.put(f"/api/v1/users/{user_id}", json={"is_active": False}, headers=admin_headers)
    assert deact_resp.status_code == 200
    assert deact_resp.json()["is_active"] is False

    # Attempt login as deactivated user (should be rejected with 403)
    login_resp = client.post("/api/v1/auth/login", json={
        "email": "deactivate.target@kct.ac.in",
        "password": "SecretPassword123!",
    })
    assert login_resp.status_code == 403
    assert "inactive" in login_resp.json()["detail"].lower()

    # Reactivate user
    react_resp = client.put(f"/api/v1/users/{user_id}", json={"is_active": True}, headers=admin_headers)
    assert react_resp.status_code == 200
    assert react_resp.json()["is_active"] is True

    # Login succeeds now
    react_login = client.post("/api/v1/auth/login", json={
        "email": "deactivate.target@kct.ac.in",
        "password": "SecretPassword123!",
    })
    assert react_login.status_code == 200

def test_admin_reset_password(client: TestClient, admin_headers: dict):
    user_resp = client.post("/api/v1/users", json={
        "email": "reset.pw@kct.ac.in",
        "password": "OldPassword123!",
        "first_name": "Reset",
        "last_name": "Tester",
    }, headers=admin_headers)
    user_id = user_resp.json()["id"]

    # Admin resets password
    reset_resp = client.post(f"/api/v1/users/{user_id}/reset-password", json={
        "new_password": "NewBrandPassword456!",
    }, headers=admin_headers)
    assert reset_resp.status_code == 200
    assert "reset successfully" in reset_resp.json()["message"].lower()

    # Old password no longer works
    old_login = client.post("/api/v1/auth/login", json={
        "email": "reset.pw@kct.ac.in",
        "password": "OldPassword123!",
    })
    assert old_login.status_code == 401

    # New password works
    new_login = client.post("/api/v1/auth/login", json={
        "email": "reset.pw@kct.ac.in",
        "password": "NewBrandPassword456!",
    })
    assert new_login.status_code == 200

def test_superuser_grant_revoke_and_last_admin_protection(client: TestClient, admin_headers: dict):
    user_resp = client.post("/api/v1/users", json={
        "email": "candidate.super@kct.ac.in",
        "password": "SuperCandidate123!",
        "first_name": "Super",
        "last_name": "Candidate",
        "is_active": True,
    }, headers=admin_headers)
    user_id = user_resp.json()["id"]
    assert user_resp.json()["is_superuser"] is False

    # Super admin grants superuser
    grant_resp = client.put(f"/api/v1/users/{user_id}/superuser", json={
        "is_superuser": True,
    }, headers=admin_headers)
    assert grant_resp.status_code == 200
    assert grant_resp.json()["is_superuser"] is True

    # Super admin revokes superuser
    revoke_resp = client.put(f"/api/v1/users/{user_id}/superuser", json={
        "is_superuser": False,
    }, headers=admin_headers)
    assert revoke_resp.status_code == 200
    assert revoke_resp.json()["is_superuser"] is False

    # SAFETY CHECK: Attempt to revoke the only remaining superuser
    # Get current super admin ID
    me_resp = client.get("/api/v1/auth/me", headers=admin_headers)
    admin_id = me_resp.json()["id"]

    safety_resp = client.put(f"/api/v1/users/{admin_id}/superuser", json={
        "is_superuser": False,
    }, headers=admin_headers)
    assert safety_resp.status_code == 400
    assert "cannot revoke" in safety_resp.json()["detail"].lower()

    # SAFETY CHECK: Attempt to deactivate the only active super admin
    deact_admin_resp = client.put(f"/api/v1/users/{admin_id}", json={
        "is_active": False,
    }, headers=admin_headers)
    assert deact_admin_resp.status_code == 400
    assert "cannot deactivate" in deact_admin_resp.json()["detail"].lower()

def test_ordinary_user_cannot_manage_users(client: TestClient, sales_headers: dict, admin_headers: dict):
    # Try to list users (allowed for all authenticated users)
    list_resp = client.get("/api/v1/users", headers=sales_headers)
    assert list_resp.status_code == 200

    # Try to create user (forbidden without users.manage)
    create_resp = client.post("/api/v1/users", json={
        "email": "hacker@kct.ac.in",
        "password": "Password123!",
        "first_name": "Malicious",
        "last_name": "User",
    }, headers=sales_headers)
    assert create_resp.status_code == 403

    # Try to edit another user (forbidden)
    me_admin = client.get("/api/v1/auth/me", headers=admin_headers).json()
    edit_resp = client.put(f"/api/v1/users/{me_admin['id']}", json={
        "first_name": "Hacked",
    }, headers=sales_headers)
    assert edit_resp.status_code == 403

    # Try to reset password of another user (forbidden)
    reset_resp = client.post(f"/api/v1/users/{me_admin['id']}/reset-password", json={
        "new_password": "HackedPassword123!",
    }, headers=sales_headers)
    assert reset_resp.status_code == 403

    # Try to grant superuser (forbidden)
    me_user = client.get("/api/v1/auth/me", headers=sales_headers).json()
    super_resp = client.put(f"/api/v1/users/{me_user['id']}/superuser", json={
        "is_superuser": True,
    }, headers=sales_headers)
    assert super_resp.status_code == 403

def test_user_self_profile_update(client: TestClient, sales_headers: dict):
    update_resp = client.put("/api/v1/auth/me", json={
        "first_name": "MyNewFirst",
        "last_name": "MyNewLast",
        "phone": "+91 7777777777",
    }, headers=sales_headers)
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["first_name"] == "MyNewFirst"
    assert data["last_name"] == "MyNewLast"
    assert data["phone"] == "+91 7777777777"

def test_user_self_password_change(client: TestClient, admin_headers: dict):
    # Create user
    client.post("/api/v1/users", json={
        "email": "self.pw@kct.ac.in",
        "password": "CurrentPassword123!",
        "first_name": "Self",
        "last_name": "Change",
    }, headers=admin_headers)

    login_resp = client.post("/api/v1/auth/login", json={
        "email": "self.pw@kct.ac.in",
        "password": "CurrentPassword123!",
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Wrong old password
    fail_resp = client.post("/api/v1/auth/change-password", json={
        "old_password": "WrongPassword!",
        "new_password": "UpdatedPassword456!",
    }, headers=headers)
    assert fail_resp.status_code == 400

    # Correct old password
    ok_resp = client.post("/api/v1/auth/change-password", json={
        "old_password": "CurrentPassword123!",
        "new_password": "UpdatedPassword456!",
    }, headers=headers)
    assert ok_resp.status_code == 200

    # Verify new password login
    new_login = client.post("/api/v1/auth/login", json={
        "email": "self.pw@kct.ac.in",
        "password": "UpdatedPassword456!",
    })
    assert new_login.status_code == 200

def test_get_teams_endpoint(client: TestClient, admin_headers: dict, db_session: Session):
    depts = client.get("/api/v1/departments", headers=admin_headers).json()
    team = db_session.query(Team).first()
    if not team:
        team = Team(name="Engineering Team Alpha", department_id=depts[0]["id"])
        db_session.add(team)
        db_session.commit()

    teams_resp = client.get("/api/v1/teams", headers=admin_headers)
    assert teams_resp.status_code == 200
    data = teams_resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "name" in data[0]
    assert "department_id" in data[0]

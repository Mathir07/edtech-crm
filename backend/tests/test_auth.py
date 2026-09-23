from fastapi.testclient import TestClient

def test_login_success(client: TestClient):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test.admin@edtechcrm.com", "password": "AdminPass123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["email"] == "test.admin@edtechcrm.com"
    assert "*" in data["permissions"]

def test_login_invalid_credentials(client: TestClient):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test.admin@edtechcrm.com", "password": "WrongPassword!"},
    )
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]

def test_current_user_profile(client: TestClient, admin_headers: dict):
    response = client.get("/api/v1/auth/me", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test.admin@edtechcrm.com"
    assert data["is_superuser"] is True

def test_unauthenticated_request(client: TestClient):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401

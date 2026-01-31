"""
Testy autentykacji i autoryzacji.
"""
import pytest
from fastapi import status


def test_register_user(client):
    """Test rejestracji nowego użytkownika."""
    response = client.post(
        "/auth/register",
        json={
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "SecurePass123!"
        }
    )
    # FastAPI domyślnie zwraca 200 dla POST
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["username"] == "newuser"
    assert data["email"] == "newuser@example.com"
    assert "id" in data
    assert "hashed_password" not in data


def test_register_duplicate_username(client, test_user):
    """Test rejestracji z istniejącą nazwą użytkownika."""
    response = client.post(
        "/auth/register",
        json={
            "username": "testuser",
            "email": "different@example.com",
            "password": "SecurePass123!"
        }
    )
    assert response.status_code == status.HTTP_409_CONFLICT


def test_register_weak_password(client):
    """Test rejestracji ze słabym hasłem."""
    response = client.post(
        "/auth/register",
        json={
            "username": "weakuser",
            "email": "weak@example.com",
            "password": "123"
        }
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_login_success(client, test_user):
    """Test poprawnego logowania."""
    response = client.post(
        "/auth/login",
        data={"username": "testuser", "password": "testpass123"}
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client, test_user):
    """Test logowania z błędnym hasłem."""
    response = client.post(
        "/auth/login",
        data={"username": "testuser", "password": "wrongpass"}
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_login_nonexistent_user(client):
    """Test logowania nieistniejącego użytkownika."""
    response = client.post(
        "/auth/login",
        data={"username": "nonexistent", "password": "password123"}
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_get_current_user(client, auth_headers):
    """Test pobierania danych zalogowanego użytkownika."""
    response = client.get("/auth/me", headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["username"] == "testuser"
    assert "hashed_password" not in data


def test_get_current_user_unauthorized(client):
    """Test pobierania danych bez autoryzacji."""
    response = client.get("/auth/me")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_get_current_user_invalid_token(client):
    """Test pobierania danych z nieprawidłowym tokenem."""
    response = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer invalid_token"}
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


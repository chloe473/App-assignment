import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend import setting


@pytest.fixture
def client(monkeypatch):
    users = {}

    def fake_read_users():
        return users

    def fake_write_users(updated_users):
        snapshot = dict(updated_users)
        users.clear()
        users.update(snapshot)

    monkeypatch.setattr(setting, "read_users", fake_read_users)
    monkeypatch.setattr(setting, "write_users", fake_write_users)

    return TestClient(app)
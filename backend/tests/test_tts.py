"""Tests for the ElevenLabs Read Aloud endpoint: POST /api/tts"""
import os

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


class TestTTS:
    def test_tts_returns_mp3(self, client):
        r = client.post(f"{BASE_URL}/api/tts",
                        json={"text": "Embeddings turn text into vectors."}, timeout=120)
        assert r.status_code == 200, r.text[:300]
        assert r.headers.get("content-type", "").startswith("audio/mpeg"), r.headers
        assert len(r.content) > 1024, f"body too small: {len(r.content)}"
        # MP3 magic: ID3 tag or frame sync
        assert r.content[:3] == b"ID3" or r.content[0] == 0xFF, r.content[:8]

    def test_tts_empty_text_400(self, client):
        r = client.post(f"{BASE_URL}/api/tts", json={"text": ""}, timeout=60)
        assert r.status_code == 400, f"{r.status_code} {r.text[:200]}"
        assert "detail" in r.json()

    def test_tts_whitespace_only_400(self, client):
        r = client.post(f"{BASE_URL}/api/tts", json={"text": "   \n "}, timeout=60)
        assert r.status_code == 400, f"{r.status_code} {r.text[:200]}"

    def test_tts_missing_field_422(self, client):
        r = client.post(f"{BASE_URL}/api/tts", json={}, timeout=60)
        assert r.status_code == 422, f"{r.status_code} {r.text[:200]}"

    def test_tts_custom_voice_id(self, client):
        r = client.post(f"{BASE_URL}/api/tts",
                        json={"text": "Testing a custom voice id.",
                              "voice_id": "EXAVITQu4vr4xnSDxMaL"}, timeout=120)
        assert r.status_code == 200, r.text[:300]
        assert len(r.content) > 1024

    def test_tts_invalid_voice_id_error(self, client):
        r = client.post(f"{BASE_URL}/api/tts",
                        json={"text": "Bad voice.", "voice_id": "not-a-real-voice"}, timeout=120)
        # Should surface an error, not a silent empty 200 audio stream
        assert r.status_code >= 400 or len(r.content) > 1024, (
            f"status={r.status_code} bytes={len(r.content)} ct={r.headers.get('content-type')}")

    def test_tts_long_text_truncated_ok(self, client):
        r = client.post(f"{BASE_URL}/api/tts", json={"text": "Vector search. " * 400}, timeout=180)
        assert r.status_code == 200, r.text[:300]
        assert len(r.content) > 1024

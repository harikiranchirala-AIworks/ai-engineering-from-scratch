"""
Backend tests for The Production GenAI Engineer Roadmap.
Tests the SSE tutor chat endpoint and the history endpoint.
"""
import os
import json
import time
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


def _parse_sse(text: str):
    """Return list of decoded event dicts from an SSE payload."""
    events = []
    for chunk in text.split("\n\n"):
        line = chunk.strip()
        if not line.startswith("data:"):
            continue
        payload = line[len("data:"):].strip()
        try:
            events.append(json.loads(payload))
        except json.JSONDecodeError:
            continue
    return events


def _stream_chat(message: str, session_id: str | None = None, timeout: int = 90):
    """Send a chat message, collect the full SSE stream, return (events, assembled_text, resolved_session_id)."""
    payload = {"message": message}
    if session_id:
        payload["session_id"] = session_id
    resp = requests.post(
        f"{API}/tutor/chat",
        json=payload,
        stream=True,
        timeout=timeout,
        headers={"Accept": "text/event-stream"},
    )
    assert resp.status_code == 200, f"expected 200, got {resp.status_code}: {resp.text[:400]}"
    assert "text/event-stream" in resp.headers.get("content-type", ""), (
        f"unexpected content-type: {resp.headers.get('content-type')}"
    )

    buffer = ""
    events = []
    for raw in resp.iter_lines(decode_unicode=True):
        if raw is None:
            continue
        if raw == "":
            # end of an SSE event
            for line in buffer.split("\n"):
                if line.startswith("data:"):
                    data = line[len("data:"):].strip()
                    try:
                        events.append(json.loads(data))
                    except json.JSONDecodeError:
                        pass
            buffer = ""
        else:
            buffer += raw + "\n"
    # flush any tail
    for line in buffer.split("\n"):
        if line.startswith("data:"):
            data = line[len("data:"):].strip()
            try:
                events.append(json.loads(data))
            except json.JSONDecodeError:
                pass

    session_evt = next((e for e in events if e.get("type") == "session"), None)
    deltas = [e.get("content", "") for e in events if e.get("type") == "delta"]
    errors = [e for e in events if e.get("type") == "error"]
    done = any(e.get("type") == "done" for e in events)
    assembled = "".join(deltas)
    resolved_session = session_evt["session_id"] if session_evt else None
    return {
        "events": events,
        "session_id": resolved_session,
        "text": assembled,
        "errors": errors,
        "done": done,
    }


# --- Health -----------------------------------------------------------------


class TestHealth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert r.json().get("message") == "GenAI Learning Hub API"


# --- Tutor chat streaming ---------------------------------------------------


# All LLM-hitting tests live under one class so pytest-xdist loadscope pins them
# to a single worker (Emergent LLM key does not allow parallel requests).
class TestTutorLLM:
    def test_arithmetic_probe_returns_43(self):
        """Sanity: the model actually reached the LLM and can answer a checkable Q."""
        result = _stream_chat("What is 17 + 26? Reply with just the number.")
        assert result["done"], f"stream did not signal done. events={result['events'][:6]}"
        assert not result["errors"], f"error events present: {result['errors']}"
        assert result["session_id"], "no session event received"
        assert result["text"].strip(), "no delta content received"
        assert "43" in result["text"], f"expected '43' in reply, got: {result['text']!r}"

    def test_ai_concept_answer_has_topic_words(self):
        """A real, on-topic AI answer must mention the concept keywords."""
        result = _stream_chat(
            "Explain self-attention in transformers in 2-3 sentences. Include the word 'attention'."
        )
        assert result["done"]
        assert not result["errors"]
        text = result["text"].lower()
        assert len(result["text"]) > 40, f"reply too short: {result['text']!r}"
        # The word 'attention' or 'attend' should appear in an on-topic reply.
        assert "attention" in text or "attend" in text, (
            f"reply doesn't discuss attention: {result['text']!r}"
        )

    def test_session_is_generated_when_none_sent(self):
        result = _stream_chat("Give me one AI/ML term.")
        assert result["session_id"]
        # basic UUID shape
        uuid.UUID(result["session_id"])

    def test_client_session_id_is_respected(self):
        sid = str(uuid.uuid4())
        result = _stream_chat("Say the word ok.", session_id=sid)
        assert result["session_id"] == sid


# --- Tutor history (shares the same class so xdist keeps LLM calls serial) --

    def test_history_persists_user_and_assistant(self):
        sid = str(uuid.uuid4())
        result = _stream_chat(
            "What is RAG in one sentence? Use the phrase 'retrieval augmented'.",
            session_id=sid,
        )
        assert result["done"]
        assert result["text"].strip(), "no reply text to persist"

        # small buffer for the final DB write which happens after stream close
        time.sleep(1.0)

        r = requests.get(f"{API}/tutor/history/{sid}", timeout=15)
        assert r.status_code == 200
        history = r.json()
        assert isinstance(history, list)
        assert len(history) >= 2, f"expected user+assistant, got {history}"

        roles = [m["role"] for m in history]
        assert "user" in roles
        assert "assistant" in roles

        user_msg = next(m for m in history if m["role"] == "user")
        asst_msg = next(m for m in history if m["role"] == "assistant")

        assert "RAG" in user_msg["content"] or "rag" in user_msg["content"].lower()
        assert asst_msg["content"].strip(), "assistant content is empty in DB"
        # optional: assembled reply should match what was streamed
        assert asst_msg["content"].strip() == result["text"].strip(), (
            "stored assistant content differs from streamed content"
        )
        # ObjectId must be excluded
        assert "_id" not in user_msg
        assert "_id" not in asst_msg

    def test_history_empty_for_unknown_session(self):
        r = requests.get(f"{API}/tutor/history/{uuid.uuid4()}", timeout=15)
        assert r.status_code == 200
        assert r.json() == []

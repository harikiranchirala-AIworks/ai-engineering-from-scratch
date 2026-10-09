"""
Backend tests for POST /api/interview/evaluate — AI Mock Interview grader.
Uses the real EMERGENT_LLM_KEY (gpt-5.4) — asserts real graded output, not fallback.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

QUESTION = "What is the difference between fine-tuning and RAG for adapting an LLM to a company's private data?"
STRONG_ANSWER = (
    "Fine-tuning updates the model's weights on domain data so the knowledge is baked into the model — "
    "it's expensive, needs GPUs, and can go stale as data changes, but it changes style/behavior. "
    "RAG (retrieval-augmented generation) keeps the base LLM frozen and injects relevant chunks retrieved "
    "from a vector store into the prompt at query time. RAG is cheaper, easier to update (just re-index), "
    "and gives citations, so it's usually the right first choice for private/changing company data. "
    "You typically use fine-tuning for style/format and RAG for facts."
)
REFERENCE = (
    "Fine-tuning modifies model weights on domain data; RAG retrieves relevant chunks at inference. "
    "RAG is easier to update and cheaper for factual grounding; fine-tuning is better for style/behavior."
)


def _post_eval(answer: str, question: str = QUESTION, reference: str | None = REFERENCE, session_id: str | None = None, timeout: int = 120):
    payload = {"question": question, "answer": answer}
    if reference is not None:
        payload["reference"] = reference
    if session_id:
        payload["session_id"] = session_id
    r = requests.post(f"{API}/interview/evaluate", json=payload, timeout=timeout)
    return r


class TestInterviewEvaluate:
    """POST /api/interview/evaluate — real LLM grading path."""

    def test_strong_answer_scores_high(self):
        r = _post_eval(STRONG_ANSWER)
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:400]}"
        data = r.json()

        # Schema
        for k in ["score", "verdict", "strengths", "improvements", "model_answer", "session_id"]:
            assert k in data, f"missing key {k} in {data}"
        assert isinstance(data["score"], int)
        assert 0 <= data["score"] <= 100
        assert isinstance(data["verdict"], str) and data["verdict"].strip()
        assert isinstance(data["strengths"], list)
        assert isinstance(data["improvements"], list)
        assert isinstance(data["model_answer"], str)
        assert isinstance(data["session_id"], str) and data["session_id"]

        # Real-content signals: verdict must not be the error/ungraded fallback
        assert data["verdict"] not in ("Error", "Ungraded"), f"fallback path used: {data}"
        # A strong answer should score meaningfully — pin to a reasonable floor
        assert data["score"] >= 60, f"strong answer scored too low: {data}"
        # Model answer should be non-trivial
        assert len(data["model_answer"].strip()) >= 20, f"model_answer too short: {data['model_answer']!r}"

    def test_empty_answer_scores_low_and_below_strong(self):
        # First a strong grade
        rs = _post_eval(STRONG_ANSWER)
        assert rs.status_code == 200
        strong = rs.json()

        # Now empty answer
        re_ = _post_eval("")
        assert re_.status_code == 200, f"got {re_.status_code}: {re_.text[:400]}"
        empty = re_.json()
        assert empty["verdict"] not in ("Error",), f"error path on empty: {empty}"
        assert 0 <= empty["score"] <= 100

        # Empty must score lower than strong answer — this proves real grading
        assert empty["score"] < strong["score"], (
            f"empty answer ({empty['score']}) did not score below strong ({strong['score']}) — "
            f"grader may be hardcoded. empty={empty} strong={strong}"
        )
        # And empty should be low-ish
        assert empty["score"] <= 40, f"empty answer scored too high: {empty}"

    def test_nonsense_answer_scores_low(self):
        r = _post_eval("banana banana banana purple 42 quack")
        assert r.status_code == 200
        data = r.json()
        assert data["verdict"] not in ("Error", "Ungraded"), f"fallback path used: {data}"
        assert data["score"] <= 40, f"nonsense scored too high: {data}"

    def test_session_id_is_generated_when_not_supplied(self):
        r = _post_eval("A short reasonable answer about RAG uses retrieval to ground the LLM.")
        assert r.status_code == 200
        sid = r.json()["session_id"]
        # basic UUID shape
        uuid.UUID(sid)

    def test_session_id_respected_when_supplied(self):
        sid = str(uuid.uuid4())
        r = _post_eval("Short answer.", session_id=sid)
        assert r.status_code == 200
        assert r.json()["session_id"] == sid

    def test_works_without_reference(self):
        r = _post_eval(STRONG_ANSWER, reference=None)
        assert r.status_code == 200
        data = r.json()
        assert data["verdict"] not in ("Error", "Ungraded"), f"fallback path used: {data}"
        assert 0 <= data["score"] <= 100

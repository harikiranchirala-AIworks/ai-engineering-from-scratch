from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
from elevenlabs.client import ElevenLabs

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']
ELEVENLABS_API_KEY = os.environ.get('ELEVENLABS_API_KEY', '')
DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"  # Sarah — clear neutral narrator
eleven_client = ElevenLabs(api_key=ELEVENLABS_API_KEY) if ELEVENLABS_API_KEY else None

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()
api_router = APIRouter(prefix="/api")

TUTOR_SYSTEM_PROMPT = (
    "You are NEURON, an expert AI/ML tutor inside 'The Production GenAI Engineer Roadmap' learning hub. "
    "You explain artificial intelligence, machine learning, deep learning, transformers, LLMs, RAG, agents, "
    "and LLMOps clearly and practically. Your teaching style: 'More practical, less textbook'. "
    "Always give a crisp definition first, then a concrete real-world example, then (if useful) a tiny code snippet. "
    "Keep answers focused and under ~200 words unless asked to go deep. Use plain language. "
    "If asked something unrelated to AI/tech learning, gently steer back to AI concepts."
)


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    role: str
    content: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@api_router.get("/")
async def root():
    return {"message": "GenAI Learning Hub API"}


@api_router.post("/tutor/chat")
async def tutor_chat(req: ChatRequest):
    session_id = req.session_id or str(uuid.uuid4())

    await db.chat_messages.insert_one(
        ChatMessage(session_id=session_id, role="user", content=req.message).model_dump()
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=TUTOR_SYSTEM_PROMPT,
    ).with_model("openai", "gpt-5.4")

    async def event_generator():
        yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"
        collected = []
        try:
            async for event in chat.stream_message(UserMessage(text=req.message)):
                if isinstance(event, TextDelta):
                    collected.append(event.content)
                    yield f"data: {json.dumps({'type': 'delta', 'content': event.content})}\n\n"
                elif isinstance(event, StreamDone):
                    break
        except Exception as e:
            logger.exception("tutor stream failed")
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        full = "".join(collected)
        if full:
            await db.chat_messages.insert_one(
                ChatMessage(session_id=session_id, role="assistant", content=full).model_dump()
            )
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@api_router.get("/tutor/history/{session_id}", response_model=List[ChatMessage])
async def tutor_history(session_id: str):
    docs = await db.chat_messages.find({"session_id": session_id}, {"_id": 0}).sort("timestamp", 1).to_list(500)
    return docs


INTERVIEW_SYSTEM_PROMPT = (
    "You are a senior AI engineering interviewer grading a candidate's answer to a technical question. "
    "Be fair but rigorous, like a real FAANG-level AI interview. Reward correct concepts, concrete examples, "
    "and clear reasoning; penalize vagueness, factual errors, and missing key points. "
    "Return ONLY a JSON object (no markdown, no prose) with exactly these keys: "
    '{"score": <int 0-100>, "verdict": "<2-4 word rating like \'Strong hire\', \'Solid\', \'Needs work\', \'Weak\'>", '
    '"strengths": ["<short point>", ...], "improvements": ["<short actionable point>", ...], '
    '"model_answer": "<a concise ideal answer, 2-4 sentences>"}. '
    "Keep strengths and improvements to at most 3 items each. If the answer is empty or nonsense, score it low."
)


class InterviewEvalRequest(BaseModel):
    question: str
    answer: str
    reference: Optional[str] = None
    session_id: Optional[str] = None


def _extract_json(text: str) -> dict:
    t = text.strip()
    if t.startswith("```"):
        t = t.strip("`")
        if t.lower().startswith("json"):
            t = t[4:]
    start, end = t.find("{"), t.rfind("}")
    if start != -1 and end != -1:
        t = t[start:end + 1]
    return json.loads(t)


@api_router.post("/interview/evaluate")
async def interview_evaluate(req: InterviewEvalRequest):
    session_id = req.session_id or str(uuid.uuid4())
    ref = f"\n\nReference answer (for your judgement only, candidate did not see it): {req.reference}" if req.reference else ""
    user_prompt = (
        f"Interview question: {req.question}\n\n"
        f"Candidate's answer: {req.answer or '(no answer given)'}"
        f"{ref}\n\nGrade this answer now. Return ONLY the JSON object."
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"interview-{session_id}",
        system_message=INTERVIEW_SYSTEM_PROMPT,
    ).with_model("openai", "gpt-5.4")

    collected = []
    try:
        async for event in chat.stream_message(UserMessage(text=user_prompt)):
            if isinstance(event, TextDelta):
                collected.append(event.content)
            elif isinstance(event, StreamDone):
                break
    except Exception as e:
        logger.exception("interview eval failed")
        return {"score": 0, "verdict": "Error", "strengths": [], "improvements": [str(e)], "model_answer": ""}

    raw = "".join(collected)
    try:
        data = _extract_json(raw)
    except Exception:
        data = {"score": 50, "verdict": "Ungraded", "strengths": [],
                "improvements": ["Could not parse evaluation, try again."], "model_answer": raw[:600]}

    data["score"] = max(0, min(100, int(data.get("score", 0))))
    data.setdefault("verdict", "Graded")
    data.setdefault("strengths", [])
    data.setdefault("improvements", [])
    data.setdefault("model_answer", "")
    data["session_id"] = session_id
    return data


class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None


@api_router.post("/tts")
async def tts(req: TTSRequest):
    if not eleven_client:
        raise HTTPException(status_code=503, detail="Text-to-speech is not configured.")
    text = (req.text or "").strip()[:2500]
    if not text:
        raise HTTPException(status_code=400, detail="No text provided.")
    voice_id = req.voice_id or DEFAULT_VOICE_ID

    try:
        chunks = eleven_client.text_to_speech.convert(
            text=text,
            voice_id=voice_id,
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
        )
        audio = b"".join(c for c in chunks if c)
    except Exception as e:
        logger.exception("TTS failed")
        raise HTTPException(status_code=502, detail=f"TTS error: {e}")

    if not audio:
        raise HTTPException(status_code=502, detail="TTS returned no audio.")

    return Response(content=audio, media_type="audio/mpeg")


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

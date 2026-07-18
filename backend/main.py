import os
import json
from typing import Any, Dict, List

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
MODEL = os.getenv("MODEL", "anthropic/claude-haiku-4.5")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

app = FastAPI(title="LifeOS Orchestrator Brain")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = """
You are the LifeOS Orchestrator Agent.

Your sole mission is to help the user achieve their goals and be genuinely useful.

You are a practical CEO-style assistant inside LifeOS, but you must behave like a normal chatbot.

Rules:
- Answer the user's actual message.
- Be direct, practical, and specific.
- Help with goals, tasks, schedule, journal, routines, projects, planning, and app building.
- Ask follow-up questions when context is missing.
- Do not repeat default template responses.
- Do not force fake sample goals like "Become a Senior Architect".
- Do not sound like generic AI slop.
- Use TASK: lines only when a real useful task should be created.
- For app/site/code changes, give a safe implementation plan and ask for approval.
"""

def latest_user(messages: List[Dict[str, Any]]) -> str:
    for m in reversed(messages or []):
        if m.get("role") == "user":
            c = m.get("content", "")
            return c if isinstance(c, str) else json.dumps(c)
    return ""

def fake_response(content: str, model: str = "local-orchestrator"):
    return {
        "id": "lifeos-local",
        "object": "chat.completion",
        "created": 0,
        "model": model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop"
            }
        ],
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    }

def local_reply(user_text: str):
    text = (user_text or "").strip().lower()

    if not text:
        return "I’m here. Ask me about goals, tasks, schedule, journal, app changes, or planning."

    if text in ["hi", "hello", "hey", "yo"] or text.startswith("yo "):
        return "Yo. I’m here. What are we working on right now?"

    if "plan" in text and "day" in text:
        return "Give me wake time, sleep target, fixed commitments, energy 1-10, and top 3 tasks. I’ll turn it into a realistic schedule."

    if "task" in text:
        return "Send me the messy task list. I’ll sort it into do now, do later, delete/archive, and smaller next steps."

    if "app" in text or "site" in text or "change" in text or "code" in text:
        return "Tell me the exact app change you want. I’ll create a safe implementation plan before anything is changed."

    return "I get you. What do you want help with right now?"

def clean_messages(messages: List[Dict[str, Any]]):
    cleaned = []

    for m in messages or []:
        role = m.get("role", "user")
        content = m.get("content", "")

        if role == "system":
            continue

        if isinstance(content, str):
            bad = [
                "Decision: focus on the highest-priority open work",
                "Your current command target is",
                "Become a Senior Architect",
                "do not redesign the system until that block is complete"
            ]
            if any(x in content for x in bad):
                continue

        cleaned.append({"role": role, "content": content})

    if not cleaned:
        cleaned = [{"role": "user", "content": "Talk to me like a normal chatbot."}]

    return cleaned[-12:]

@app.get("/")
def root():
    return {
        "ok": True,
        "marker": "LIFEOS_BRAIN_8799_ACTIVE",
        "openrouter_key_set": bool(OPENROUTER_API_KEY),
        "model": MODEL
    }

@app.post("/api/openrouter/chat/completions")
async def chat(req: Request):
    try:
        payload = await req.json()
    except Exception:
        payload = {}

    messages = payload.get("messages", [])
    user_text = latest_user(messages)

    if not OPENROUTER_API_KEY:
        return fake_response(local_reply(user_text))

    body = {
        "model": MODEL,
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}] + clean_messages(messages),
        "temperature": 0.35,
        "max_tokens": min(int(payload.get("max_tokens", 900) or 900), 1000)
    }

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://127.0.0.1:5173",
        "X-OpenRouter-Title": "LifeOS Orchestrator Brain",
    }

    async with httpx.AsyncClient(timeout=90) as client:
        r = await client.post(OPENROUTER_URL, headers=headers, json=body)

    if r.status_code >= 400:
        return fake_response("OpenRouter error:\n\n" + r.text[:1200], MODEL)

    return r.json()

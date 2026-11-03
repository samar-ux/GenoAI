"""LLM client (Anthropic Messages API). Without an API key it returns a dev-mode reply."""

import httpx

import config

API_URL = "https://api.anthropic.com/v1/messages"
SYSTEM_PROMPT = (
    "You are Geno, a friendly and helpful AI assistant. "
    "Always reply in the same language the user writes in (Arabic or English). "
    "Keep answers clear and concise."
)


class LLMError(Exception):
    """Raised when the AI service cannot produce a reply."""


def generate_reply(messages: list[dict]) -> str:
    """messages: [{'role': 'user' | 'assistant', 'content': str}, ...] in chronological order."""
    if not config.ANTHROPIC_API_KEY:
        last = messages[-1]["content"] if messages else ""
        return f"[dev mode: no ANTHROPIC_API_KEY configured] You said: {last}"

    try:
        response = httpx.post(
            API_URL,
            headers={
                "x-api-key": config.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": config.LLM_MODEL,
                "max_tokens": 1024,
                "system": SYSTEM_PROMPT,
                "messages": messages,
            },
            timeout=60.0,
        )
        response.raise_for_status()
        blocks = response.json().get("content", [])
    except (httpx.HTTPError, ValueError) as exc:
        raise LLMError("AI service request failed") from exc

    text = "".join(block.get("text", "") for block in blocks if block.get("type") == "text").strip()
    if not text:
        raise LLMError("Empty reply from AI service")
    return text

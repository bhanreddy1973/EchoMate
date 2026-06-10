"""EchoMate API server — LiveKit token generation + text chat endpoint."""

import os
import ssl
import json
import asyncio
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

# Disable SSL verification if SSL_VERIFY is set to false
if os.getenv("SSL_VERIFY", "true").lower() == "false":
    os.environ["CURL_CA_BUNDLE"] = ""
    os.environ["REQUESTS_CA_BUNDLE"] = ""
    os.environ.pop("SSL_CERT_FILE", None)
    os.environ["LITELLM_SSL_VERIFY"] = "false"
    ssl._create_default_https_context = ssl._create_unverified_context

    import httpx

    _original_httpx_client_init = httpx.Client.__init__
    _original_httpx_async_client_init = httpx.AsyncClient.__init__

    def _patched_httpx_client_init(self, *args, **kwargs):
        kwargs.setdefault("verify", False)
        _original_httpx_client_init(self, *args, **kwargs)

    def _patched_httpx_async_client_init(self, *args, **kwargs):
        kwargs.setdefault("verify", False)
        _original_httpx_async_client_init(self, *args, **kwargs)

    httpx.Client.__init__ = _patched_httpx_client_init  # type: ignore
    httpx.AsyncClient.__init__ = _patched_httpx_async_client_init  # type: ignore

from livekit.api import AccessToken, VideoGrants

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "")

# System prompt for text chat
SYSTEM_PROMPT = (
    "You are EchoMate, a friendly and helpful voice-powered daily companion. "
    "You assist with daily tasks, reminders, habits, scheduling, and general questions. "
    "Be concise, warm, and conversational. Use markdown formatting for lists and emphasis."
)


def _get_chat_response_sync(messages: list[dict]) -> str:
    """Run the LLM call synchronously using the ModelRouter."""
    from echomate.model_router import ModelRouter

    router = ModelRouter(timeout_seconds=30, max_fallbacks=3)

    async def _run():
        full_response = ""
        async for token in router.route(messages):
            full_response += token
        return full_response

    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_run())
    finally:
        loop.close()


class TokenHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/token":
            self.send_token()
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/api/chat":
            self.handle_chat()
        else:
            self.send_response(404)
            self.end_headers()

    def handle_chat(self):
        """Handle text chat requests by routing through the LLM."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)

            user_messages = data.get("messages", [])
            if not user_messages:
                self._send_json(400, {"error": "No messages provided"})
                return

            # Build the full message list with system prompt
            messages = [{"role": "system", "content": SYSTEM_PROMPT}]
            messages.extend(user_messages)

            logger.info(f"[chat] Processing {len(user_messages)} message(s)")

            response_text = _get_chat_response_sync(messages)

            if not response_text:
                response_text = "I'm sorry, I couldn't generate a response. Please try again."

            self._send_json(200, {"response": response_text})

        except json.JSONDecodeError:
            self._send_json(400, {"error": "Invalid JSON body"})
        except Exception as e:
            logger.error(f"[chat] Error: {e}")
            self._send_json(500, {"error": f"LLM error: {str(e)}"})

    def send_token(self):
        try:
            import time
            room_name = f"echomate-room-{int(time.time())}"
            token = (
                AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
                .with_identity("echomate-user")
                .with_name("EchoMate User")
                .with_grants(VideoGrants(room_join=True, room=room_name))
            )
            jwt = token.to_jwt()
            self._send_json(200, {"token": jwt, "url": LIVEKIT_URL})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _send_json(self, status: int, data: dict):
        body = json.dumps(data)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode())

    def log_message(self, format, *args):
        print(f"[api-server] {args[0]}")


if __name__ == "__main__":
    port = 8081
    server = HTTPServer(("127.0.0.1", port), TokenHandler)
    print(f"EchoMate API server running on http://127.0.0.1:{port}")
    print(f"  POST /api/chat  — text chat (LLM-powered)")
    print(f"  GET  /api/token — LiveKit token")
    print(f"LiveKit URL: {LIVEKIT_URL}")
    server.serve_forever()

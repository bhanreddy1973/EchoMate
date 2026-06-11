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

# Initialize long-term memory (singleton for the server)
_ltm_instance = None

def _get_ltm():
    """Get or create the LongTermMemory singleton."""
    global _ltm_instance
    if _ltm_instance is None:
        try:
            from echomate.memory.long_term import LongTermMemory
            _ltm_instance = LongTermMemory(chroma_persist_dir="./data/chroma")
        except Exception as e:
            logger.error(f"Failed to init LongTermMemory: {e}")
    return _ltm_instance

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
        elif self.path == "/api/memories":
            self.handle_get_memories()
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/api/chat":
            self.handle_chat()
        elif self.path == "/api/connectors/test":
            self.handle_connector_test()
        elif self.path == "/api/memories":
            self.handle_store_memory()
        elif self.path == "/api/memories/search":
            self.handle_search_memories()
        elif self.path == "/api/memories/delete":
            self.handle_delete_memory()
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
            skill_context = data.get("skillContext")
            if not user_messages:
                self._send_json(400, {"error": "No messages provided"})
                return

            # Build the full message list with system prompt
            system_content = SYSTEM_PROMPT
            if skill_context:
                system_content += f"\n\n--- Skill Context (reference material) ---\n{skill_context}\n--- End Skill Context ---"

            messages = [{"role": "system", "content": system_content}]
            messages.extend(user_messages)

            logger.info(f"[chat] Processing {len(user_messages)} message(s)" + (" [with skill context]" if skill_context else ""))

            response_text = _get_chat_response_sync(messages)

            if not response_text:
                response_text = "I'm sorry, I couldn't generate a response. Please try again."

            self._send_json(200, {"response": response_text})

        except json.JSONDecodeError:
            self._send_json(400, {"error": "Invalid JSON body"})
        except Exception as e:
            logger.error(f"[chat] Error: {e}")
            self._send_json(500, {"error": f"LLM error: {str(e)}"})

    def handle_connector_test(self):
        """Validate a connector token against the real provider API."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)

            provider = data.get("provider", "custom")
            token = data.get("token", "")
            url = data.get("url", "")

            if not token and provider != "custom":
                self._send_json(400, {"valid": False, "error": "Token is required"})
                return

            import urllib.request
            import urllib.error

            user_info = None

            if provider == "github":
                # Validate GitHub Personal Access Token
                req = urllib.request.Request(
                    "https://api.github.com/user",
                    headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json", "User-Agent": "EchoMate"}
                )
                try:
                    ctx = ssl._create_unverified_context() if os.getenv("SSL_VERIFY", "true").lower() == "false" else None
                    resp = urllib.request.urlopen(req, context=ctx, timeout=10)
                    gh_user = json.loads(resp.read())
                    user_info = {
                        "name": gh_user.get("name") or gh_user.get("login", "GitHub User"),
                        "email": gh_user.get("email"),
                        "extra": f"{gh_user.get('public_repos', 0)} repos",
                        "avatar": gh_user.get("avatar_url"),
                    }
                except urllib.error.HTTPError as e:
                    if e.code == 401:
                        self._send_json(200, {"valid": False, "error": "Invalid token — check permissions"})
                    else:
                        self._send_json(200, {"valid": False, "error": f"GitHub API error: {e.code}"})
                    return

            elif provider == "notion":
                # Validate Notion Integration Token
                req = urllib.request.Request(
                    "https://api.notion.com/v1/users/me",
                    headers={"Authorization": f"Bearer {token}", "Notion-Version": "2022-06-28"}
                )
                try:
                    ctx = ssl._create_unverified_context() if os.getenv("SSL_VERIFY", "true").lower() == "false" else None
                    resp = urllib.request.urlopen(req, context=ctx, timeout=10)
                    notion_user = json.loads(resp.read())
                    user_info = {
                        "name": notion_user.get("name", "Notion User"),
                        "email": notion_user.get("person", {}).get("email"),
                        "avatar": notion_user.get("avatar_url"),
                    }
                except urllib.error.HTTPError as e:
                    if e.code == 401:
                        self._send_json(200, {"valid": False, "error": "Invalid token — check your integration"})
                    else:
                        self._send_json(200, {"valid": False, "error": f"Notion API error: {e.code}"})
                    return

            elif provider == "slack":
                # Validate Slack Bot Token
                req = urllib.request.Request(
                    "https://slack.com/api/auth.test",
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
                )
                try:
                    ctx = ssl._create_unverified_context() if os.getenv("SSL_VERIFY", "true").lower() == "false" else None
                    resp = urllib.request.urlopen(req, context=ctx, timeout=10)
                    slack_data = json.loads(resp.read())
                    if not slack_data.get("ok"):
                        self._send_json(200, {"valid": False, "error": slack_data.get("error", "Invalid token")})
                        return
                    user_info = {
                        "name": slack_data.get("user", "Slack User"),
                        "extra": slack_data.get("team", ""),
                    }
                except urllib.error.HTTPError as e:
                    self._send_json(200, {"valid": False, "error": f"Slack API error: {e.code}"})
                    return

            elif provider in ("google", "gmail", "calendar"):
                # Validate Google OAuth2 Access Token
                req = urllib.request.Request(
                    "https://www.googleapis.com/oauth2/v2/userinfo",
                    headers={"Authorization": f"Bearer {token}"}
                )
                try:
                    ctx = ssl._create_unverified_context() if os.getenv("SSL_VERIFY", "true").lower() == "false" else None
                    resp = urllib.request.urlopen(req, context=ctx, timeout=10)
                    google_user = json.loads(resp.read())
                    user_info = {
                        "name": google_user.get("name", "Google User"),
                        "email": google_user.get("email"),
                        "avatar": google_user.get("picture"),
                    }
                except urllib.error.HTTPError as e:
                    if e.code == 401:
                        self._send_json(200, {"valid": False, "error": "Token expired or invalid — try regenerating"})
                    else:
                        self._send_json(200, {"valid": False, "error": f"Google API error: {e.code}"})
                    return

            elif provider == "custom":
                # For custom connectors, just verify the URL is reachable
                if url:
                    test_url = url if url.startswith("http") else f"https://{url}"
                    req = urllib.request.Request(test_url, method="HEAD")
                    if token:
                        req.add_header("Authorization", f"Bearer {token}")
                    try:
                        ctx = ssl._create_unverified_context() if os.getenv("SSL_VERIFY", "true").lower() == "false" else None
                        urllib.request.urlopen(req, context=ctx, timeout=10)
                        user_info = {"name": "Connected", "extra": url}
                    except Exception:
                        # Try GET if HEAD fails
                        try:
                            req = urllib.request.Request(test_url)
                            if token:
                                req.add_header("Authorization", f"Bearer {token}")
                            urllib.request.urlopen(req, context=ctx, timeout=10)
                            user_info = {"name": "Connected", "extra": url}
                        except Exception as e2:
                            self._send_json(200, {"valid": False, "error": f"Cannot reach {url}"})
                            return
                else:
                    user_info = {"name": "Custom Connector"}

            else:
                self._send_json(200, {"valid": False, "error": f"Unknown provider: {provider}"})
                return

            logger.info(f"[connector] {provider} validated successfully: {user_info.get('name')}")
            self._send_json(200, {"valid": True, "user": user_info})

        except json.JSONDecodeError:
            self._send_json(400, {"valid": False, "error": "Invalid JSON body"})
        except Exception as e:
            logger.error(f"[connector] Error: {e}")
            self._send_json(500, {"valid": False, "error": f"Validation error: {str(e)}"})

    def handle_get_memories(self):
        """Return all memories from ChromaDB."""
        try:
            ltm = _get_ltm()

            if ltm is None or not ltm.is_available() or ltm.collection is None:
                self._send_json(200, {"memories": [], "available": False})
                return

            # Get all entries from the collection
            results = ltm.collection.get(
                limit=50,
                include=["documents", "metadatas"],
            )

            memories = []
            if results and results.get("documents"):
                docs = results["documents"]
                metas = results.get("metadatas", [])
                ids = results.get("ids", [])

                for i, doc in enumerate(docs):
                    meta = metas[i] if i < len(metas) else {}
                    memories.append({
                        "id": ids[i] if i < len(ids) else f"mem-{i}",
                        "content": doc,
                        "category": meta.get("category", "fact") if meta else "fact",
                        "timestamp": meta.get("timestamp", "") if meta else "",
                        "tags": [meta.get("category", "memory")] if meta else ["memory"],
                        "pinned": meta.get("pinned", False) if meta else False,
                    })

            self._send_json(200, {"memories": memories, "available": True})

        except Exception as e:
            logger.error(f"[memories] Get error: {e}")
            self._send_json(200, {"memories": [], "available": False, "error": str(e)})

    def handle_store_memory(self):
        """Store a new memory in ChromaDB."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)

            content = data.get("content", "").strip()
            if not content:
                self._send_json(400, {"error": "Content is required"})
                return

            tags = data.get("tags", [])
            category = data.get("category", "fact")

            ltm = _get_ltm()

            if ltm is None or not ltm.is_available():
                self._send_json(503, {"error": "Long-term memory unavailable"})
                return

            loop = asyncio.new_event_loop()
            try:
                loop.run_until_complete(ltm.store(content, {
                    "category": category,
                    "tags": ",".join(tags) if tags else "",
                    "pinned": data.get("pinned", False),
                }))
            finally:
                loop.close()

            logger.info(f"[memories] Stored: {content[:50]}")
            self._send_json(200, {"success": True})

        except json.JSONDecodeError:
            self._send_json(400, {"error": "Invalid JSON body"})
        except Exception as e:
            logger.error(f"[memories] Store error: {e}")
            self._send_json(500, {"error": str(e)})

    def handle_search_memories(self):
        """Search memories by semantic similarity."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)

            query = data.get("query", "").strip()
            if not query:
                self._send_json(400, {"error": "Query is required"})
                return

            ltm = _get_ltm()

            if ltm is None or not ltm.is_available():
                self._send_json(200, {"results": [], "available": False})
                return

            loop = asyncio.new_event_loop()
            try:
                entries = loop.run_until_complete(ltm.search(query, top_k=10, min_score=0.5))
            finally:
                loop.close()

            results = []
            for entry in entries:
                results.append({
                    "id": entry.id,
                    "content": entry.text,
                    "category": entry.category,
                    "timestamp": entry.timestamp,
                    "score": entry.similarity_score,
                })

            self._send_json(200, {"results": results, "available": True})

        except json.JSONDecodeError:
            self._send_json(400, {"error": "Invalid JSON body"})
        except Exception as e:
            logger.error(f"[memories] Search error: {e}")
            self._send_json(200, {"results": [], "available": False, "error": str(e)})

    def handle_delete_memory(self):
        """Delete a memory from ChromaDB by query."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)

            query = data.get("query", "").strip()
            if not query:
                self._send_json(400, {"error": "Query is required"})
                return

            ltm = _get_ltm()

            if ltm is None or not ltm.is_available():
                self._send_json(503, {"error": "Long-term memory unavailable"})
                return

            loop = asyncio.new_event_loop()
            try:
                removed = loop.run_until_complete(ltm.delete(query))
            finally:
                loop.close()

            self._send_json(200, {"removed": removed, "count": len(removed)})

        except json.JSONDecodeError:
            self._send_json(400, {"error": "Invalid JSON body"})
        except Exception as e:
            logger.error(f"[memories] Delete error: {e}")
            self._send_json(500, {"error": str(e)})

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
    print(f"  POST /api/chat            — text chat (LLM-powered)")
    print(f"  POST /api/connectors/test — validate connector tokens")
    print(f"  GET  /api/token           — LiveKit token")
    print(f"  GET  /api/memories        — list all memories from ChromaDB")
    print(f"  POST /api/memories        — store a new memory")
    print(f"  POST /api/memories/search — semantic search memories")
    print(f"  POST /api/memories/delete — delete memories by query")
    print(f"LiveKit URL: {LIVEKIT_URL}")
    server.serve_forever()

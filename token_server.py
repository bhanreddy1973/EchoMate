"""EchoMate API server — LiveKit token generation + text chat endpoint."""

import os
import ssl
import json
import asyncio
import logging
import time
from datetime import datetime, timezone
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

# ── Conversation Storage ─────────────────────────────────────────────────────
CONVERSATIONS_DIR = Path(__file__).parent / "data" / "conversations"
CONVERSATIONS_DIR.mkdir(parents=True, exist_ok=True)


def _load_conversation(conv_id: str) -> dict | None:
    """Load a conversation JSON file by its ID."""
    filepath = CONVERSATIONS_DIR / f"{conv_id}.json"
    if not filepath.exists():
        return None
    try:
        return json.loads(filepath.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        logger.error(f"[conversations] Failed to load {conv_id}: {e}")
        return None


def _save_conversation(conv: dict) -> None:
    """Save a conversation dict to its JSON file."""
    filepath = CONVERSATIONS_DIR / f"{conv['id']}.json"
    filepath.write_text(json.dumps(conv, indent=2, ensure_ascii=False), encoding="utf-8")


def _list_conversations() -> list[dict]:
    """List all conversations, newest first, with summary info."""
    conversations = []
    for f in CONVERSATIONS_DIR.glob("*.json"):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            conversations.append({
                "id": data["id"],
                "title": data.get("title", "Untitled"),
                "source": data.get("source", "chat"),
                "createdAt": data.get("createdAt", ""),
                "updatedAt": data.get("updatedAt", ""),
                "messageCount": len(data.get("messages", [])),
            })
        except (json.JSONDecodeError, OSError, KeyError) as e:
            logger.warning(f"[conversations] Skipping invalid file {f.name}: {e}")
    conversations.sort(key=lambda c: c.get("updatedAt", ""), reverse=True)
    return conversations


def _delete_conversation(conv_id: str) -> bool:
    """Delete a conversation JSON file."""
    filepath = CONVERSATIONS_DIR / f"{conv_id}.json"
    if filepath.exists():
        filepath.unlink()
        return True
    return False


def _generate_title(messages: list[dict]) -> str:
    """Generate a title from the first user message."""
    for msg in messages:
        if msg.get("role") == "user":
            content = msg.get("content", "").strip()
            if content:
                return content[:60] + ("…" if len(content) > 60 else "")
    return "New conversation"

LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "")

# System prompt for text chat
SYSTEM_PROMPT = (
    "You are EchoMate, a friendly and helpful voice-powered daily companion. "
    "You assist with daily tasks, reminders, habits, scheduling, and general questions. "
    "Be concise, warm, and conversational. Use markdown formatting for lists and emphasis."
)


def _get_chat_response_sync(messages: list[dict], force_tier: str | None = None) -> str:
    """Run the LLM call synchronously."""
    import litellm

    # Handle image generation separately
    if force_tier == "image":
        return _generate_image_sync(messages)

    # Map tier to model
    tier_model_map = {
        "fast": "nvidia_nim/meta/llama-3.1-8b-instruct",
        "reasoning": "nvidia_nim/deepseek-ai/deepseek-v4-pro",
        "creative": "nvidia_nim/meta/llama-3.1-70b-instruct",
        "technical": "nvidia_nim/moonshotai/kimi-k2.6",
        "voice": "nvidia_nim/nvidia/nemotron-voicechat",
    }

    # Auto-detect tier if not forced
    if not force_tier or force_tier not in tier_model_map:
        from echomate.model_router import classify_complexity
        complexity = classify_complexity(messages)
        tier_map = {"simple": "fast", "moderate": "fast", "complex": "reasoning", "creative": "creative", "technical": "technical"}
        force_tier = tier_map.get(complexity.value, "fast")

    model = tier_model_map.get(force_tier, tier_model_map["fast"])
    timeout = 45 if force_tier == "reasoning" else 20

    # Fallback models
    fallbacks = [
        "openrouter/google/gemini-2.0-flash-001",
        "openrouter/nex-agi/nex-n2-pro:free",
    ]

    async def _run():
        # Try primary model
        try:
            response = await asyncio.wait_for(
                litellm.acompletion(model=model, messages=messages, stream=True),
                timeout=timeout,
            )
            full = ""
            async for chunk in response:
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta and delta.content:
                    full += delta.content
            if full:
                return full
        except Exception as e:
            logger.warning(f"[chat] Primary model {model} failed: {e}")

        # Try fallbacks
        for fb_model in fallbacks:
            try:
                response = await asyncio.wait_for(
                    litellm.acompletion(model=fb_model, messages=messages, stream=True),
                    timeout=20,
                )
                full = ""
                async for chunk in response:
                    delta = chunk.choices[0].delta if chunk.choices else None
                    if delta and delta.content:
                        full += delta.content
                if full:
                    logger.info(f"[chat] Fallback {fb_model} succeeded")
                    return full
            except Exception as e:
                logger.warning(f"[chat] Fallback {fb_model} failed: {e}")

        return ""

    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_run())
    finally:
        loop.close()


def _generate_image_sync(messages: list[dict]) -> str:
    """Generate an image using NVIDIA NIM's image generation API."""
    import base64
    import urllib.request
    import urllib.error

    # Extract the prompt from the last user message
    prompt = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            prompt = msg.get("content", "")
            break

    if not prompt:
        return "Please provide a description of the image you'd like me to generate."

    nvidia_key = os.getenv("NVIDIA_NIM_API_KEY", "")
    if not nvidia_key:
        return "Image generation requires NVIDIA_NIM_API_KEY to be configured."

    try:
        # Use NVIDIA's Stable Diffusion XL via NIM
        payload = json.dumps({
            "text_prompts": [{"text": prompt, "weight": 1}],
            "cfg_scale": 7,
            "height": 1024,
            "width": 1024,
            "steps": 25,
            "samples": 1,
        })

        req = urllib.request.Request(
            "https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-xl",
            data=payload.encode(),
            headers={
                "Authorization": f"Bearer {nvidia_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )

        ctx = None
        if os.getenv("SSL_VERIFY", "true").lower() == "false":
            ctx = ssl._create_unverified_context()

        resp = urllib.request.urlopen(req, context=ctx, timeout=60)
        result = json.loads(resp.read())

        if result.get("artifacts") and len(result["artifacts"]) > 0:
            img_b64 = result["artifacts"][0].get("base64", "")
            if img_b64:
                # Save image and return markdown
                img_dir = Path(__file__).parent / "app" / "public" / "generated"
                img_dir.mkdir(parents=True, exist_ok=True)
                img_filename = f"img-{int(time.time())}.png"
                img_path = img_dir / img_filename
                img_path.write_bytes(base64.b64decode(img_b64))

                return f"![Generated Image](/generated/{img_filename})\n\n*Generated: {prompt[:80]}*"

        return "I generated the image but couldn't save it. Please try again."

    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else ""
        logger.error(f"[image] NVIDIA API error {e.code}: {error_body[:200]}")
        if e.code == 402:
            return "Image generation quota exceeded. The free tier has limited credits."
        return f"Image generation failed (HTTP {e.code}). Try a different prompt."
    except Exception as e:
        logger.error(f"[image] Generation error: {e}")
        return f"Image generation failed: {str(e)}"


class TokenHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/token":
            self.send_token()
        elif self.path == "/api/memories":
            self.handle_get_memories()
        elif self.path == "/api/conversations":
            self.handle_list_conversations()
        elif self.path.startswith("/api/conversations/"):
            conv_id = self.path.split("/api/conversations/")[1].strip("/")
            self.handle_get_conversation(conv_id)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/api/chat":
            self.handle_chat()
        elif self.path == "/api/connectors/test":
            self.handle_connector_test()
        elif self.path == "/api/coding/context":
            self.handle_coding_context()
        elif self.path == "/api/memories":
            self.handle_store_memory()
        elif self.path == "/api/memories/search":
            self.handle_search_memories()
        elif self.path == "/api/memories/delete":
            self.handle_delete_memory()
        elif self.path == "/api/conversations":
            self.handle_create_conversation()
        else:
            self.send_response(404)
            self.end_headers()

    def do_DELETE(self):
        if self.path.startswith("/api/conversations/"):
            conv_id = self.path.split("/api/conversations/")[1].strip("/")
            self.handle_delete_conversation(conv_id)
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
            session_id = data.get("sessionId")
            no_save = data.get("noSave", False)
            force_tier = data.get("forceTier")  # "fast", "reasoning", "creative", "technical", "image"
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

            response_text = _get_chat_response_sync(messages, force_tier=force_tier)

            if not response_text:
                response_text = "I'm sorry, I couldn't generate a response. Please try again."

            # Auto-save conversation (skip for internal/system calls)
            if not no_save:
                try:
                    now = datetime.now(timezone.utc).isoformat()
                    if not session_id:
                        session_id = f"conv-{int(time.time() * 1000)}"

                    existing = _load_conversation(session_id)
                    if existing:
                        # Append latest user message and assistant response
                        last_user_msg = user_messages[-1] if user_messages else None
                        if last_user_msg:
                            existing["messages"].append({
                                "role": "user",
                                "content": last_user_msg.get("content", ""),
                                "timestamp": now,
                            })
                        existing["messages"].append({
                            "role": "assistant",
                            "content": response_text,
                            "timestamp": now,
                        })
                        existing["updatedAt"] = now
                        _save_conversation(existing)
                    else:
                        # Create new conversation
                        conv_messages = []
                        for msg in user_messages:
                            conv_messages.append({
                                "role": msg.get("role", "user"),
                                "content": msg.get("content", ""),
                                "timestamp": now,
                            })
                        conv_messages.append({
                            "role": "assistant",
                            "content": response_text,
                            "timestamp": now,
                        })
                        conv = {
                            "id": session_id,
                            "title": _generate_title(user_messages),
                            "source": "chat",
                            "createdAt": now,
                            "updatedAt": now,
                            "messages": conv_messages,
                        }
                        _save_conversation(conv)
                except Exception as save_err:
                    logger.warning(f"[chat] Failed to auto-save conversation: {save_err}")

            self._send_json(200, {"response": response_text, "sessionId": session_id})

        except json.JSONDecodeError:
            self._send_json(400, {"error": "Invalid JSON body"})
        except Exception as e:
            logger.error(f"[chat] Error: {e}")
            self._send_json(500, {"error": f"LLM error: {str(e)}"})

    def handle_coding_context(self):
        """Receive coding context from the frontend to sync with the voice agent."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)

            # Save coding context for the voice agent to read
            context_dir = Path(__file__).parent / "data"
            context_dir.mkdir(parents=True, exist_ok=True)
            context_file = context_dir / "coding_context.json"
            context_file.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

            logger.info(f"[coding-context] Synced: problem={data.get('currentProblem', {}).get('title', 'none')}")
            self._send_json(200, {"ok": True})
        except Exception as e:
            logger.error(f"[coding-context] Error: {e}")
            self._send_json(500, {"error": str(e)})

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

    def handle_list_conversations(self):
        """Return all conversations (summary only), newest first."""
        try:
            conversations = _list_conversations()
            self._send_json(200, {"conversations": conversations})
        except Exception as e:
            logger.error(f"[conversations] List error: {e}")
            self._send_json(500, {"error": str(e)})

    def handle_get_conversation(self, conv_id: str):
        """Return full conversation with messages."""
        try:
            conv = _load_conversation(conv_id)
            if conv is None:
                self._send_json(404, {"error": "Conversation not found"})
                return
            self._send_json(200, conv)
        except Exception as e:
            logger.error(f"[conversations] Get error: {e}")
            self._send_json(500, {"error": str(e)})

    def handle_create_conversation(self):
        """Create or append to a conversation."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)

            session_id = data.get("sessionId")
            messages = data.get("messages", [])
            source = data.get("source", "chat")
            now = datetime.now(timezone.utc).isoformat()

            if not session_id:
                session_id = f"conv-{int(time.time() * 1000)}"

            existing = _load_conversation(session_id)
            if existing:
                # Append messages
                for msg in messages:
                    existing["messages"].append({
                        "role": msg.get("role", "user"),
                        "content": msg.get("content", ""),
                        "timestamp": msg.get("timestamp", now),
                    })
                existing["updatedAt"] = now
                if not existing.get("title") or existing["title"] == "New conversation":
                    existing["title"] = _generate_title(existing["messages"])
                _save_conversation(existing)
                self._send_json(200, {"id": session_id, "updated": True})
            else:
                # Create new conversation
                conv_messages = []
                for msg in messages:
                    conv_messages.append({
                        "role": msg.get("role", "user"),
                        "content": msg.get("content", ""),
                        "timestamp": msg.get("timestamp", now),
                    })
                conv = {
                    "id": session_id,
                    "title": _generate_title(messages),
                    "source": source,
                    "createdAt": now,
                    "updatedAt": now,
                    "messages": conv_messages,
                }
                _save_conversation(conv)
                self._send_json(201, {"id": session_id, "created": True})

        except json.JSONDecodeError:
            self._send_json(400, {"error": "Invalid JSON body"})
        except Exception as e:
            logger.error(f"[conversations] Create error: {e}")
            self._send_json(500, {"error": str(e)})

    def handle_delete_conversation(self, conv_id: str):
        """Delete a conversation by ID."""
        try:
            if _delete_conversation(conv_id):
                self._send_json(200, {"deleted": True})
            else:
                self._send_json(404, {"error": "Conversation not found"})
        except Exception as e:
            logger.error(f"[conversations] Delete error: {e}")
            self._send_json(500, {"error": str(e)})

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
    print(f"  GET  /api/conversations       — list all conversations")
    print(f"  GET  /api/conversations/:id   — get conversation by ID")
    print(f"  POST /api/conversations       — create/append conversation")
    print(f"  DELETE /api/conversations/:id  — delete a conversation")
    print(f"LiveKit URL: {LIVEKIT_URL}")
    server.serve_forever()

"""Simple token server for LiveKit frontend connection."""

import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

from dotenv import load_dotenv
from livekit.api import AccessToken, VideoGrants

load_dotenv()

LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "")


class TokenHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/token":
            self.send_token()
        else:
            self.send_response(404)
            self.end_headers()

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
            body = json.dumps({"token": jwt, "url": LIVEKIT_URL})
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body.encode())
        except Exception as e:
            body = json.dumps({"error": str(e)})
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body.encode())

    def log_message(self, format, *args):
        print(f"[token-server] {args[0]}")


if __name__ == "__main__":
    port = 8081
    server = HTTPServer(("127.0.0.1", port), TokenHandler)
    print(f"Token server running on http://127.0.0.1:{port}")
    print(f"LiveKit URL: {LIVEKIT_URL}")
    server.serve_forever()

# Judge0 — Self-Hosted Code Execution Engine

This directory contains the Docker Compose setup for a self-hosted [Judge0 CE](https://github.com/judge0/judge0) instance used by EchoMate's Coding Workspace.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose installed
- At least 2GB free RAM (Judge0 runs sandboxed containers for each submission)

## Quick Start

```bash
cd judge0/
docker-compose up -d
```

Judge0 will be available at `http://localhost:2358`. No API key is required for local use.

## Verify It's Running

```bash
# Check health
curl http://localhost:2358/system_info

# List available languages
curl http://localhost:2358/languages

# Test a Python submission
curl -X POST http://localhost:2358/submissions?wait=true \
  -H "Content-Type: application/json" \
  -d '{"source_code": "print(\"Hello from Judge0!\")", "language_id": 71}'
```

## Architecture

```
┌──────────────────────────────────────┐
│          Judge0 Server (:2358)       │
│  (Rails API - receives submissions) │
├──────────────────────────────────────┤
│          Judge0 Workers              │
│  (Execute code in isolate sandbox)   │
├─────────────────┬────────────────────┤
│   PostgreSQL    │       Redis        │
│  (submissions)  │  (queue/cache)     │
└─────────────────┴────────────────────┘
```

## Supported Languages

The self-hosted Judge0 CE image includes 60+ languages. Main ones used by EchoMate:

| Language   | ID  |
|-----------|-----|
| Python 3  | 71  |
| JavaScript| 63  |
| TypeScript| 74  |
| Java      | 62  |
| C++ (GCC) | 54  |
| Go        | 60  |
| Rust      | 73  |
| C#        | 51  |

## Configuration

Edit `judge0.conf` to adjust:
- `COUNT` — number of worker processes (more = more concurrent executions)
- `CPU_TIME_LIMIT` — max execution time in seconds
- `MEMORY_LIMIT` — max memory in KB
- `AUTHN_TOKEN` — set a token to require auth (empty = no auth)

## Stopping

```bash
docker-compose down
```

To also remove volumes (submission data):
```bash
docker-compose down -v
```

## Troubleshooting

- **Port 2358 in use**: Change the port mapping in `docker-compose.yml`
- **Privileged mode required**: Judge0 uses Linux isolate which needs `--privileged`
- **macOS/Apple Silicon**: Judge0 works on ARM via Docker Desktop's Rosetta emulation
- **Low memory**: Reduce `COUNT` in `judge0.conf` to 1

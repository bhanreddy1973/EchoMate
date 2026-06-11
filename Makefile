.PHONY: setup refresh-skills dev dev-all test test-frontend lint typecheck clean

setup:
	bash scripts/setup.sh

refresh-skills:
	bash scripts/refresh_skills.sh

dev:
	.venv/bin/python agent.py dev

dev-api:
	.venv/bin/python token_server.py

dev-app:
	cd app && npm run dev

dev-all:
	@echo "Starting all services..."
	@.venv/bin/python token_server.py &
	@cd app && npm run dev &
	@.venv/bin/python agent.py dev

test:
	.venv/bin/python -m pytest tests/ -v --tb=short

test-frontend:
	cd frontend && npm test

lint:
	.venv/bin/ruff check echomate/ tests/ agent.py

typecheck:
	.venv/bin/mypy echomate/ agent.py

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	rm -rf .pytest_cache dist build *.egg-info

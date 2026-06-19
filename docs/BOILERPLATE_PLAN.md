# Project Boilerplate & Developer Experience Plan

## Overview

Tujuan: Menyiapkan project boilerplate best-practice untuk Dalil App, memastikan kode tetap clean, konsisten, dan bebas tech debt dari hari pertama.

---

## Phase 1: Git Init & Project Structure

### 1.1 Initialize Git Repository
```
cd dalil-app && git init
```

### 1.2 Create Standard Directory Structure
```
dalil-app/
├── .github/                    # CI/CD workflows
│   └── workflows/
│       ├── ci.yml              # Lint + typecheck + test
├── backend/                    # FastAPI Python
│   ├── app/
│   ├── alembic/
│   ├── tests/
│   ├── pyproject.toml          # Python project config (ruff, mypy, pytest)
│   ├── .env.example
│   └── requirements.txt
├── frontend/                   # React + Vite + TypeScript
│   ├── src/
│   ├── biome.json              # Biome linter + formatter config
│   ├── package.json
│   └── tsconfig.json
├── data/                       # Raw data & scripts
│   ├── raw/quran/
│   ├── raw/hadith/
│   └── scripts/
├── docs/                       # Documentation
├── .github/                    # GitHub config
├── .gitignore
├── AGENTS.md                   # AI agent instructions
├── opencode.json               # OpenCode plugin/skill config
├── docker-compose.yml
└── README.md
```

---

## Phase 2: Biome — TypeScript Linting & Formatting

### 2.1 Install Biome
```bash
cd frontend
npm install --save-dev @biomejs/biome
```

### 2.2 Configuration (`frontend/biome.json`)
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": { "noUnusedVariables": "error" },
      "style": { "useConst": "error" }
    }
  }
}
```

### 2.3 Package.json scripts
```json
{
  "scripts": {
    "lint": "biome check src/",
    "lint:fix": "biome check --write src/",
    "format": "biome format --write src/"
  }
}
```

---

## Phase 3: Ruff — Python Linting & Formatting

### 3.1 Install Ruff
```bash
cd backend
pip install ruff
```

### 3.2 Configuration (`backend/pyproject.toml`)
```toml
[tool.ruff]
target-version = "py311"
line-length = 100

[tool.ruff.lint]
select = [
    "E", "F", "W",        # pyflakes + pycodestyle
    "I",                   # isort (import ordering)
    "UP",                  # pyupgrade
    "B",                   # flake8-bugbear
    "C4",                  # flake8-comprehensions
    "SIM",                 # flake8-simplify
    "N",                   # pep8-naming
]
ignore = ["N818"]  # exception names don't need "Error" suffix

[tool.ruff.format]
quote-style = "double"
indent-style = "space"

[tool.ruff.lint.isort]
known-first-party = ["app"]

[tool.mypy]
strict = true
ignore_missing_imports = true

[tool.pytest.ini_options]
testpaths = ["tests"]
```

---

## Phase 4: AGENTS.md — AI Agent Project Instructions

File `AGENTS.md` di root project berisi instruksi untuk AI coding agents:

```markdown
# AGENTS.md — Dalil App

## Project Overview
Semantic search platform for Islamic texts (Quran + Hadith).
Backend: FastAPI + PostgreSQL/pgvector
Frontend: React + Vite + TanStack Router + TypeScript

## Tech Stack
- Python 3.11+, FastAPI, SQLAlchemy, Alembic, Celery, pgvector
- TypeScript 5.x, React 18, Vite 5, TanStack Router, Tailwind CSS
- PostgreSQL 16 + pgvector, Redis 7
- Docker Compose for local dev

## Code Standards
- Backend: Ruff linting (E, F, W, I, UP, B, C4, SIM, N)
- Frontend: Biome linting + formatting
- TypeScript strict mode
- Python: type hints required (mypy strict)

## Conventions
- No comments in code unless absolutely necessary
- Use existing patterns from the codebase
- Arabic text always uses .arabic-text CSS class with RTL direction
- API routes follow /api/v1/ prefix
- Database migrations via Alembic (never edit tables directly)
- NEVER commit .env files

## Testing
- Backend: pytest
- Frontend: vitest (TBD)

## Before Committing
- `ruff check backend/`
- `biome check frontend/src/`
- `mypy backend/`
```

---

## Phase 5: Superpowers Installation

### 5.1 Create `opencode.json`
```json
{
  "plugin": ["superpowers@git+https://github.com/obra/superpowers.git"]
}
```

### 5.2 Install ponytail-style skills
Ponytail concept: a set of skills that ensure AI agents follow structured workflows. We'll configure the following skills from the existing skills library and Superpowers:

| Skill | Source | Purpose |
|---|---|---|
| code-review-excellence | Already installed | Code review standards |
| code-simplifier | Already installed | Simplify/refactor code |
| python-code-style | Already installed | Python style guide |
| brainstorming | Superpowers | Socratic design refinement |
| writing-plans | Superpowers | Detailed implementation plans |
| subagent-driven-development | Superpowers | Parallel agent task execution |
| test-driven-development | Superpowers | RED-GREEN-REFACTOR cycle |
| requesting-code-review | Superpowers | Pre-review checklist |
| systematic-debugging | Superpowers | Root cause analysis |

---

## Phase 6: GitHub CI/CD (.github/workflows/ci.yml)

```yaml
name: CI
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: ruff check backend/
      - run: mypy backend/ --ignore-missing-imports

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
        working-directory: frontend
      - run: npx biome ci src/
        working-directory: frontend
      - run: npx tsc --noEmit
        working-directory: frontend
```

---

## Phase 7: Pre-commit Hooks (Optional MVP)

```bash
# Install pre-commit
pip install pre-commit

# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.0
    hooks:
      - id: ruff
      - id: ruff-format
        args: [--check]

  - repo: https://github.com/biomejs/pre-commit
    rev: v1.9.0
    hooks:
      - id: biome-check
```

---

## Execution Order

| Step | Action | Time |
|---|---|---|
| 1 | Init git repo | 1 min |
| 2 | Create directory structure | 1 min |
| 3 | Write `AGENTS.md` | 5 min |
| 4 | Write `opencode.json` + install superpowers | 2 min |
| 5 | Install Biome in frontend + configure | 3 min |
| 6 | Install Ruff in backend + configure | 3 min |
| 7 | Create `.github/workflows/ci.yml` | 5 min |
| 8 | Run linters to verify everything passes | 3 min |
| 9 | Git add + initial commit | 1 min |

**Total: ~25 minutes**

---

## Success Criteria

- [ ] `ruff check backend/` passes with 0 errors
- [ ] `biome check frontend/src/` passes
- [ ] `git init` + initial commit done
- [ ] `AGENTS.md` present with project context
- [ ] `opencode.json` with superpowers plugin
- [ ] CI pipeline defined
- [ ] All 42,441 documents in `data/raw/`

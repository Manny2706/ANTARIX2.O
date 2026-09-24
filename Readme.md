# 🛰️ ANTARIX 2.O — Multi-Agent Satellite Imagery AI Platform

An end-to-end intelligent satellite analysis platform connecting a LangGraph-powered **Agentic AI Gateway**, a real-time **Node.js/Express Backend** with Socket.IO & Prisma ORM, and an interactive **React + Leaflet + Three.js Frontend**.

---

## 🏗️ Architecture & Communication Flow

```text
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React / Vite)                  │
│             Port: 3000 (Docker Host) / 80 (Container)       │
│           Interactive Leaflet Map + 3D Three.js UI          │
└──────────────┬──────────────────────────────▲───────────────┘
               │ HTTP REST (/api/auth, /api/history)          
               │ Socket.IO (message:send, location:send)      
               ▼                                              
┌─────────────────────────────────────────────────────────────┐
│                 Backend (Node.js + Express 5)               │
│                          Port: 7000                         │
│        - Authentication & JWT Session Management            │
│        - Real-Time Socket.IO Streaming                      │
│        - Prisma ORM (v7) Schema Synchronization             │
└──────────────┬──────────────────────────────▲───────────────┘
               │                              │
     SQL Query │                              │ Multipart SSE Stream
               ▼                              │ (/api/v1/analyze/stream)
┌──────────────────────────────┐ ┌────────────┴────────────────┐
│     PostgreSQL Database      │ │      Agentic AI Gateway     │
│           (v16-alpine)       │ │     (FastAPI + LangGraph)   │
│           Port: 5432         │ │          Port: 8000         │
│  - User Accounts             │ │  - Routing & Orchestration  │
│  - Analysis Conversations    │ │  - Groq / OpenRouter LLMs   │
│  - Message Logs & Metadata   │ │  - Qwen2-VL Local Vision    │
└──────────────────────────────┘ └─────────────────────────────┘
```

---

## 🚀 Quick Start with Docker

### Option 1: Docker Compose (Recommended)

To run the complete interconnected project with all microservices:

```bash
# 1. Clone repository (if not already done)
git clone https://github.com/Manny2706/ANTARIX2.O.git
cd ANTARIX2.O

# 2. (Optional) Provide your Groq or OpenRouter API key in .env
# Edit .env and set GROQ_API_KEY=your_key_here

# 3. Build and launch all services
docker compose up --build
```

To run in detached background mode:
```bash
docker compose up -d --build
```

To stop all services:
```bash
docker compose down
```

---

### Option 2: Single All-in-One Docker Container

If you prefer building and running the entire project within a single unified container:

```bash
docker build -t antarix-app .
docker run -p 3000:80 -p 7000:7000 -p 8000:8000 antarix-app
```

---

## 🌐 Service Ports & Access Points

| Service | Port (Host) | Description | Health Check |
| :--- | :--- | :--- | :--- |
| **Frontend Web App** | `http://localhost:3000` | React UI for satellite analysis & maps | `http://localhost:3000/health` |
| **Backend REST & Socket** | `http://localhost:7000` | Express REST API & Socket.IO server | `http://localhost:7000/health` |
| **Agentic AI Gateway** | `http://localhost:8000` | FastAPI Multi-Agent pipeline & Docs | `http://localhost:8000/health` |
| **Gateway Swagger Docs** | `http://localhost:8000/docs` | Interactive OpenAPI documentation | - |
| **PostgreSQL Database** | `localhost:5432` | Postgres 16 data store | `pg_isready` |

---

## 🔑 Key Environment Variables

Configurations are defined in [`.env`](file:///.env) (and sample in [`.env.example`](file:///.env.example)):

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `FRONTEND_PORT` | `3000` | Host port for the Frontend web application |
| `BACKEND_PORT` | `7000` | Host port for the Express backend |
| `GATEWAY_PORT` | `8000` | Host port for the Python AI Gateway |
| `DB_PORT` | `5432` | Host port for PostgreSQL |
| `DB_USER` | `postgres` | PostgreSQL username |
| `DB_PASSWORD` | `postgres` | PostgreSQL password |
| `DB_NAME` | `satquery` | PostgreSQL database name |
| `GROQ_API_KEY` | *(empty)* | Optional API key for Groq LLM inference |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Primary Groq model ID |
| `OPENROUTER_API_KEY` | *(empty)* | Optional fallback API key |
| `VLM_BACKEND` | `disabled` | `disabled` (CPU default) or `local` (GPU) |
| `SOCKET_KEY` | `bgvpit303269bgwb9nishant` | Shared authorization key for WebSocket events |
| `JWT_SECRET` | *(preset)* | Secret key used for signing authentication tokens |

---

## 🧪 Service Verification & Smoke Testing

### 1. Test Agentic AI Gateway
```bash
curl http://localhost:8000/health
```
Response:
```json
{"status":"ok","version":"0.1.0","vlm_backend":"disabled","vlm_model_id":"...","vlm_loaded":false,"segmenter_backend":"disabled"}
```

### 2. Test Backend Microservice
```bash
curl http://localhost:7000/health
```
Response:
```json
{"status":"ok","message":"server is Healthy"}
```

### 3. Test Frontend Application
Open your browser at [http://localhost:3000](http://localhost:3000) to view the application.

---

## 📁 Repository Structure

```text
ANTARIX2.O/
├── AGENTIC-AI_GATEWAY/       # Python FastAPI + LangGraph AI pipeline
│   ├── satquery/             # Multi-agent LangGraph workflow
│   ├── Dockerfile            # Gateway Dockerfile
│   └── requirements.txt      # Python dependencies
├── BACKEND/                  # Express 5 + TypeScript + Socket.IO + Prisma
│   ├── src/                  # Express controllers, routes, socket & services
│   ├── prisma/               # Prisma 7 schema and migrations
│   ├── Dockerfile            # Backend Dockerfile
│   └── docker-entrypoint.sh  # Auto db sync and server launcher
├── frontend/                 # React 19 + Vite + Leaflet + Three.js
│   ├── src/                  # Components, map viewer, socket client
│   ├── nginx.conf            # Nginx SPA & reverse proxy configuration
│   └── Dockerfile            # Multi-stage frontend Dockerfile
├── docker-compose.yml        # Multi-service container orchestrator
├── Dockerfile                # Root all-in-one unified container
├── .dockerignore             # Global build ignore rules
├── .env.example              # Template environment configuration
├── .env                      # Default local environment configuration
└── Readme.md                 # Project documentation
```

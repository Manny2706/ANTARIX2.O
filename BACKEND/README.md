# 🛰️ SatQuery-AI Backend

High-performance, real-time backend API and WebSocket microservice for **SatQuery-AI** — an intelligent satellite imagery analysis and multi-modal query platform.

The backend orchestrates user authentication, conversational history, image processing, real-time Socket.IO streaming, and seamless integration with downstream machine learning inference services via Server-Sent Events (SSE).

---

## 📑 Table of Contents

- [Overview & Architecture](#-overview--architecture)
- [Tech Stack](#-tech-stack)
- [Project Directory Structure](#-project-directory-structure)
- [Database Schema (Prisma)](#-database-schema-prisma)
- [Installation & Setup](#-installation--setup)
  - [Prerequisites](#prerequisites)
  - [1. Clone & Install Dependencies](#1-clone--install-dependencies)
  - [2. Environment Configuration](#2-environment-configuration)
  - [3. Database Setup (Docker or Cloud Postgres)](#3-database-setup-docker-or-cloud-postgres)
  - [4. Prisma Client Generation & Migrations](#4-prisma-client-generation--migrations)
  - [5. Run Development Server](#5-run-development-server)
  - [6. Production Build](#6-production-build)
- [REST API Reference](#-rest-api-reference)
  - [Health Check](#health-check)
  - [Authentication Endpoints (`/api/auth`)](#authentication-endpoints-apiauth)
  - [History Endpoints (`/api/history`)](#history-endpoints-apihistory)
- [Real-Time Socket.IO Protocol](#-real-time-socketio-protocol)
  - [Connection](#connection)
  - [Socket Events](#socket-events)
  - [Message Flow & SSE Streaming](#message-flow--sse-streaming)
  - [Frontend Socket Client Example](#frontend-socket-client-example)
- [Testing Socket Communication](#-testing-socket-communication)
- [Deployment (Vercel & Docker)](#-deployment-vercel--docker)

---

## 🏗 Overview & Architecture

SatQuery-AI Backend serves as the central orchestration bridge between client applications (Web / Mobile) and specialized downstream satellite computer vision / ML models.

```text
┌────────────────────────────────────────────────────────┐
│                   Frontend Client                      │
│        (React / Next.js / Vite / Mobile App)           │
└──────────────┬─────────────────────────▲───────────────┘
               │ HTTP REST               │ Socket.IO
               │ (Auth & History)        │ (Bidirectional / Streaming)
               ▼                         │
┌────────────────────────────────────────┴───────────────┐
│               SatQuery-AI Backend Server               │
│              Express 5 + TypeScript + Node.js          │
│                                                        │
│  ┌──────────────────────┐    ┌──────────────────────┐  │
│  │   Auth & History     │    │   Socket.IO Server   │  │
│  │   Controllers        │    │   (maxHttpBuffer 10MB)│  │
│  └──────────┬───────────┘    └──────────┬───────────┘  │
│             │                           │              │
│             ▼                           ▼              │
│  ┌──────────────────────────────────────────────────┐  │
│  │     Chat & Inference Orchestration Service       │  │
│  │  - Multipart Base64 Image Processing             │  │
│  │  - SSE Streaming Bridge                          │  │
│  └──────────┬───────────────────────────┬───────────┘  │
└─────────────┼───────────────────────────┼──────────────┘
              │ Prisma ORM (v7)           │ SSE / HTTP Stream
              ▼                           ▼
┌───────────────────────────┐ ┌──────────────────────────┐
│   PostgreSQL Database     │ │   Downstream ML Engine   │
│ (Neon Tech / Docker PG16) │ │ (Optical Satellite Model)│
│  - Users                  │ │  - Evidence Detection    │
│  - Conversations          │ │  - Reflection & Trace    │
│  - Messages & Metadata    │ │  - Temporal Analysis     │
└───────────────────────────┘ └──────────────────────────┘
```

### Key Capabilities
- **Robust Authentication**: Secure registration and login using [`bcryptjs`](file:///c:/Users/NISHANT%20SINGH/OneDrive/Desktop/SatQuery-AI/backend/src/service/auth.service.ts) salted password hashing and signed [`jsonwebtoken`](file:///c:/Users/NISHANT%20SINGH/OneDrive/Desktop/SatQuery-AI/backend/src/utils/Token.ts) with HTTP-only cookies.
- **Real-Time Streaming**: Socket.IO connection handling satellite analysis queries, consuming downstream ML Server-Sent Events (SSE) and streaming real-time status updates (`message:status`) to the user.
- **Deep Metadata Persistence**: Stores structured AI inference artifacts (confidence scores, reflection decisions, execution traces, evidence nodes, temporal change metrics) directly in PostgreSQL JSONB fields.
- **High-Throughput Image Ingestion**: Socket buffer configured up to 10MB to ingest high-resolution satellite imagery base64 payloads and convert them into streaming multipart form payloads.

---

## 💻 Tech Stack

| Category | Technology |
| :--- | :--- |
| **Runtime** | Node.js (v18+) |
| **Language** | TypeScript (v5.9+) |
| **Framework** | Express.js (v5.2+) |
| **ORM & Database** | Prisma ORM (v7.10) with `@prisma/adapter-pg`, PostgreSQL 16 / Neon Tech Serverless |
| **Real-Time Engine** | Socket.IO (v4.8+) |
| **Security & Auth** | JSON Web Token (JWT), `bcryptjs`, `cookie-parser`, CORS |
| **Asset Storage** | Cloudinary SDK (`cloudinary@^2.11.0`) |
| **Development** | `ts-node-dev`, `dotenv`, `nodemon` |
| **Containerization** | Docker & Docker Compose |
| **Deployment Target** | Vercel (`api/index.ts` serverless wrapper) / Node.js Server |

---

## 📁 Project Directory Structure

```text
backend/
├── api/
│   └── index.ts                 # Vercel serverless entry point
├── prisma/
│   ├── migrations/              # Database migration SQL files
│   │   ├── 20260906073639_init/
│   │   └── 20260906134443_add_conversations_messages/
│   └── schema.prisma            # Prisma schema models (User, Conversation, Message)
├── src/
│   ├── config/
│   │   ├── claudinary.ts        # Cloudinary client configuration
│   │   └── db.ts                # PrismaClient initialization with PostgreSQL adapter
│   ├── controllers/
│   │   ├── auth.controller.ts   # Register, Login, Logout controller handlers
│   │   └── history.controller.ts# Conversation list & Message history controllers
│   ├── generated/               # Prisma custom generated client output
│   ├── middleware/
│   │   └── auth.middleware.ts   # JWT authentication verification middleware
│   ├── routes/
│   │   ├── auth.route.ts        # Express router for authentication endpoints
│   │   └── history.route.ts     # Express router for chat history endpoints
│   ├── service/
│   │   ├── auth.service.ts      # User lookup, hashing, and token issuing
│   │   ├── chat.service.ts      # Message persistence, ML SSE consumption & streaming
│   │   └── history.service.ts   # Conversation & message database queries
│   ├── socket/
│   │   └── socket.ts            # Socket.IO connection & event dispatchers
│   ├── test/
│   │   ├── image1.png           # Sample satellite test image 1
│   │   ├── image2.png           # Sample satellite test image 2
│   │   └── socket-test.ts       # Socket.IO client automated integration test
│   ├── types/
│   │   ├── auth.type.ts         # User & Auth TypeScript interfaces
│   │   └── socket.types.ts      # Socket payloads & ML response interfaces
│   ├── utils/
│   │   ├── ApiError.ts          # Standardized custom API error class
│   │   └── Token.ts             # JWT token sign utility
│   ├── app.ts                   # Express application setup, middlewares, and routes
│   └── index.ts                 # HTTP & Socket.IO server startup script
├── .env                         # Environment variables (local)
├── docker-compose.yml           # Local PostgreSQL service container
├── package.json                 # Project dependencies and npm scripts
├── prisma7.config.ts            # Prisma 7 configuration file
├── tsconfig.json                # TypeScript compiler configuration
└── vercel.json                  # Vercel deployment configuration
```

---

## 🗄 Database Schema (Prisma)

The database schema is defined in [`prisma/schema.prisma`](file:///c:/Users/NISHANT%20SINGH/OneDrive/Desktop/SatQuery-AI/backend/prisma/schema.prisma):

```prisma
enum MessageRole {
  USER
  ASSISTANT
}

model User {
  id        String   @id @default(uuid())
  fullName  String
  email     String   @unique
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  conversations Conversation[]
}

model Conversation {
  id        String   @id @default(uuid())
  userId    String
  title     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages Message[]

  @@index([userId])
}

model Message {
  id             String      @id @default(uuid())
  conversationId String
  role           MessageRole
  content        String?
  imageUrl       String?
  metadata       Json?
  createdAt      DateTime    @default(now())

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
}
```

### Relational Hierarchy
- **User 1 : N Conversation**: A user can create multiple analysis sessions.
- **Conversation 1 : N Message**: Every conversation holds ordered `USER` prompts and `ASSISTANT` responses.
- **Cascade Deletes**: Removing a user cascades down to clean up all conversations and associated message logs.
- **Metadata**: Stores the rich AI response diagnostics including confidence, reflection decisions, execution traces, and temporal reasoning metrics.


---

## 🌐 REST API Reference

Base URL: `http://localhost:7000`

### Health Check

#### `GET /health`
Returns system status.
- **Response `200 OK`**:
```json
{
  "status": "ok",
  "message": "server is Healthy"
}
```

---

### Authentication Endpoints (`/api/auth`)

#### `POST /api/auth/register`
Register a new user account.
- **Request Body**:
```json
{
  "fullName": "Jane Doe",
  "email": "jane@example.com",
  "password": "secretpassword",
  "confirmPassword": "secretpassword"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "70fa21d1-c6c0-4766-a264-9c2d418352c2",
      "fullName": "Jane Doe",
      "email": "jane@example.com",
      "createdAt": "2026-09-06T12:00:00.000Z",
      "updatedAt": "2026-09-06T12:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```
*Note: Also sets an HTTP-only cookie `token`.*

---

#### `POST /api/auth/login`
Authenticate an existing user.
- **Request Body**:
```json
{
  "email": "jane@example.com",
  "password": "secretpassword"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "70fa21d1-c6c0-4766-a264-9c2d418352c2",
      "fullName": "Jane Doe",
      "email": "jane@example.com",
      "createdAt": "2026-09-06T12:00:00.000Z",
      "updatedAt": "2026-09-06T12:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

#### `POST /api/auth/logout`
Clears the authentication token cookie.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### History Endpoints (`/api/history`)

#### `GET /api/history/conversations`
Fetch past conversations for the current session.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Conversations fetched successfully",
  "data": [
    {
      "id": "c7a8b941-8f59-4b68-b7db-0138d38628bc",
      "title": "Analyze flood changes in sector",
      "messages": [
        {
          "id": "18fa3008-cb6a-4934-be5e-63f28dcfef12",
          "conversationId": "c7a8b941-8f59-4b68-b7db-0138d38628bc",
          "role": "ASSISTANT",
          "content": "Water body boundary expanded by 18.4%...",
          "imageUrl": null,
          "metadata": {},
          "createdAt": "2026-09-06T13:45:00.000Z"
        }
      ]
    }
  ]
}
```

---

#### `GET /api/history/messages/:conversationId`
Fetch all chronological messages of a specific conversation.
- **URL Parameters**:
  - `conversationId`: UUID of the conversation
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Messages fetched successfully",
  "data": [
    {
      "id": "01fb...",
      "conversationId": "c7a8b941-8f59-4b68-b7db-0138d38628bc",
      "role": "USER",
      "content": "What changed between these two images?",
      "imageUrl": null,
      "metadata": null,
      "createdAt": "2026-09-06T13:44:00.000Z"
    },
    {
      "id": "02fc...",
      "conversationId": "c7a8b941-8f59-4b68-b7db-0138d38628bc",
      "role": "ASSISTANT",
      "content": "Significant deforestation observed on northern quadrant...",
      "imageUrl": null,
      "metadata": {
        "confidence": 0.94,
        "current_task": "change_detection",
        "temporal_mode": "bi_temporal"
      },
      "createdAt": "2026-09-06T13:44:12.000Z"
    }
  ]
}
```

---

## ⚡ Real-Time Socket.IO Protocol

The backend runs a Socket.IO server at the root endpoint with CORS enabled and maximum payload buffer set to **10MB** to allow high-resolution satellite imagery base64 transfer.

### Connection
```typescript
import { io } from "socket.io-client";

const socket = io("http://localhost:7000", {
  autoConnect: true,
});
```

---

### Socket Events

| Event | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `message:send` | Client → Server | [`SocketSendMessage`](file:///c:/Users/NISHANT%20SINGH/OneDrive/Desktop/SatQuery-AI/backend/src/types/socket.types.ts#L1-L7) | Submits prompt and satellite images for analysis |
| `message:status` | Server → Client | `{ conversationId, event, data }` | Emitted when downstream ML pipeline sends SSE progress/start events |
| `message:response` | Server → Client | `{ conversationId, userMessage, assistantMessage }` | Emitted when ML analysis is complete with saved DB messages |
| `message:error` | Server → Client | `{ message: string }` | Emitted on validation errors, auth failures, or model timeouts |
| `error` | Server → Client | `string` | Missing key or message payload |

---

### Message Flow & SSE Streaming

1. **Client Sends `message:send`**:
   ```typescript
   socket.emit("message:send", {
     key: "your_secret_socket_key",
     userId: "70fa21d1-c6c0-4766-a264-9c2d418352c2",
     conversationId: null, // null for new conversation, or UUID to continue
     message: "Identify water bodies and calculate total surface area",
     images: ["data:image/png;base64,..."] // Array of Base64 strings (1 or more)
   });
   ```

2. **Validation & Session Initialization**:
   - Backend checks `key === process.env.SOCKET_KEY`.
   - Validates that `images` array has at least one valid base64 image.
   - Finds existing conversation or creates a new one titled with the first 30 chars of the message.
   - Stores `USER` message in the database.

3. **Downstream ML SSE Streaming**:
   - Converts base64 image strings to binary blobs (`optical_0.png`, `optical_1.png`).
   - Dispatches `multipart/form-data` POST request to `ML_API_URL`.
   - Parses the SSE stream in real-time. When `start` or `progress` events arrive from ML, backend immediately emits `message:status` to the client.

4. **Response Assembly**:
   - When the `result` event is read from the SSE stream, backend extracts:
     - `final_answer`
     - `confidence`
     - `current_task`
     - `temporal_mode`
     - `modalities`
     - `reflection` (reason, confidence, required actions)
     - `evidence` & `execution_trace`
     - `duration_seconds`
   - Stores the `ASSISTANT` message and rich metadata in PostgreSQL.
   - Emits `message:response` to the client socket.

---

## 🧪 Testing Socket Communication

A test script is provided in [`src/test/socket-test.ts`](file:///c:/Users/NISHANT%20SINGH/OneDrive/Desktop/SatQuery-AI/backend/src/test/socket-test.ts) to verify end-to-end multi-image inference without needing the frontend.

Run the test with `ts-node`:
```bash
npx ts-node src/test/socket-test.ts
```

It reads [`image1.png`](file:///c:/Users/NISHANT%20SINGH/OneDrive/Desktop/SatQuery-AI/backend/src/test/image1.png) and [`image2.png`](file:///c:/Users/NISHANT%20SINGH/OneDrive/Desktop/SatQuery-AI/backend/src/test/image2.png), base64-encodes them, emits `message:send` with a change-detection query, and logs the returned response structure.

---



This project is licensed under the **ISC License**.

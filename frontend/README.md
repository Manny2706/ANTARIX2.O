# 🗺️ ANTARIX 2.O — Frontend Application

Interactive **React 19 + Vite** Web Application featuring dual **Leaflet 2D maps**, **Three.js 3D terrain canvas**, real-time **Server-Sent Events (SSE)** thinking stream UI, and **Socket.IO** integration for satellite imagery analysis.

---

## 🚀 Key Features

- **Interactive Leaflet Map Canvas**: Select satellite regions, draw bounding boxes, and view object grounding bounding overlays.
- **Three.js 3D Canvas**: Visualize terrain and spatial target highlights.
- **Real-Time Agent Thinking Stream**: Receive step-by-step reasoning progress directly from the Agentic AI Gateway via SSE.
- **Multi-Modal Image Upload**: Upload Sentinel-2 Optical (RGB) and Sentinel-1 SAR imagery alongside $T_1$ vs $T_2$ bi-temporal comparison frames.
- **Socket.IO Chat Sync**: Live session history synchronization with the Express backend.

---

## 🛠️ Tech Stack

- **Framework**: React 19 + Vite 6
- **Maps & 3D**: Leaflet, React-Leaflet, Three.js, Lucide-React
- **Styling**: CSS Modules / Custom Responsive Design System
- **Networking**: Axios, Fetch API (SSE Stream Reader), Socket.IO-client

---

## 💻 Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will run at `http://localhost:3000`.

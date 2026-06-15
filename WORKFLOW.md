# EchoMate — System Workflow

This document is the authoritative reference for how every subsystem in EchoMate works, section by section, with end-to-end data flow diagrams.

---

## Table of Contents

1. [Application Bootstrap](#1-application-bootstrap)
2. [Frontend — Spatial Dashboard & View Router](#2-frontend--spatial-dashboard--view-router)
3. [Emotion Context System](#3-emotion-context-system)
4. [Voice Mode — LiveKit Pipeline](#4-voice-mode--livekit-pipeline)
5. [Voice Mode — NVIDIA Direct Pipeline](#5-voice-mode--nvidia-direct-pipeline)
6. [Chat Mode](#6-chat-mode)
7. [Coding Workspace](#7-coding-workspace)
8. [Career Intelligence Workspace](#8-career-intelligence-workspace)
9. [Python Agent Internals](#9-python-agent-internals)
10. [Memory System](#10-memory-system)
11. [Model Router](#11-model-router)
12. [MCP Tool System](#12-mcp-tool-system)
13. [Spatial Dashboard Panels](#13-spatial-dashboard-panels)
14. [State Management Architecture](#14-state-management-architecture)

---

## 1. Application Bootstrap

### Python Agent Startup

![workflow-01](docs/diagrams/workflow-01.svg)

### Per-Session Initialization

![workflow-02](docs/diagrams/workflow-02.svg)

### Next.js Frontend Startup

![workflow-03](docs/diagrams/workflow-03.svg)

---

## 2. Frontend — Spatial Dashboard & View Router

The `SpatialDashboard` component is the root of the entire UI. It owns the view state and renders one of four views.

![workflow-04](docs/diagrams/workflow-04.svg)

### View Component Map

![workflow-05](docs/diagrams/workflow-05.svg)

---

## 3. Emotion Context System

The `EmotionContext` drives all accent colors, glow effects, and animation states globally across the app.

![workflow-06](docs/diagrams/workflow-06.svg)

---

## 4. Voice Mode — LiveKit Pipeline

This is the full real-time voice path through the LiveKit infrastructure.

![workflow-07](docs/diagrams/workflow-07.svg)

### LiveKit Event → Emotion Mapping

![workflow-08](docs/diagrams/workflow-08.svg)

---

## 5. Voice Mode — NVIDIA Direct Pipeline

`NvidiaVoiceChat` is the second voice mode — it bypasses LiveKit and calls NVIDIA's API directly.

![workflow-09](docs/diagrams/workflow-09.svg)

---

## 6. Chat Mode

The `ChatOverlay` provides a text-based multi-model AI chat interface.

![workflow-10](docs/diagrams/workflow-10.svg)

### Chat Toolbar Features

![workflow-11](docs/diagrams/workflow-11.svg)

---

## 7. Coding Workspace

`CodingWorkspace` is a full LeetCode-style coding environment with AI coaching.

![workflow-12](docs/diagrams/workflow-12.svg)

### Problem Import Flow

![workflow-13](docs/diagrams/workflow-13.svg)

### Code Execution Flow

![workflow-14](docs/diagrams/workflow-14.svg)

### AI Coach Skill Routing

![workflow-15](docs/diagrams/workflow-15.svg)

---

## 8. Career Intelligence Workspace

`CareerWorkspace` is a multi-panel job application assistant with full resume intelligence.

![workflow-16](docs/diagrams/workflow-16.svg)

### Full Career Workflow

![workflow-17](docs/diagrams/workflow-17.svg)

### ATS Resume Generation Pipeline

![workflow-18](docs/diagrams/workflow-18.svg)

### Auto-Generate Flow (Multi-Model)

![workflow-19](docs/diagrams/workflow-19.svg)

---

## 9. Python Agent Internals

### Core Voice Processing Loop

![workflow-20](docs/diagrams/workflow-20.svg)

### Barge-in Handler

![workflow-21](docs/diagrams/workflow-21.svg)

### Session End Flow

![workflow-22](docs/diagrams/workflow-22.svg)

---

## 10. Memory System

![workflow-23](docs/diagrams/workflow-23.svg)

### Memory Retrieval Decision

![workflow-24](docs/diagrams/workflow-24.svg)

---

## 11. Model Router

![workflow-25](docs/diagrams/workflow-25.svg)

### Model Registry

![workflow-26](docs/diagrams/workflow-26.svg)

---

## 12. MCP Tool System

![workflow-27](docs/diagrams/workflow-27.svg)

---

## 13. Spatial Dashboard Panels

### Left Column

![workflow-28](docs/diagrams/workflow-28.svg)

### Right Column

![workflow-29](docs/diagrams/workflow-29.svg)

### Center

![workflow-30](docs/diagrams/workflow-30.svg)

---

## 14. State Management Architecture

All three Zustand stores own their domain, and SpatialDashboard consumes the EmotionContext.

![workflow-31](docs/diagrams/workflow-31.svg)

### CareerStore Action Graph

![workflow-32](docs/diagrams/workflow-32.svg)

---

*This document reflects the codebase state as of June 2026. For setup instructions, see [SETUP.md](SETUP.md).*

"""Session and multi-turn conversational memory management backed by SQLite.

Maintains conversation history and cached visual / geospatial assets per session,
allowing follow-up questions without re-uploading imagery, and persisting across
server restarts in a local SQLite database (default: var/sessions.db).
"""

from __future__ import annotations

import json
import logging
import sqlite3
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from satquery.config import get_settings

logger = logging.getLogger(__name__)


@dataclass
class ConversationTurn:
    turn_id: int
    query: str
    resolved_query: str
    final_answer: str
    task: str | None = None
    evidence_summary: str | None = None
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return {
            "turn_id": self.turn_id,
            "query": self.query,
            "resolved_query": self.resolved_query,
            "final_answer": self.final_answer,
            "task": self.task,
            "evidence_summary": self.evidence_summary,
            "timestamp": self.timestamp,
        }


@dataclass
class SessionData:
    session_id: str
    created_at: float = field(default_factory=time.time)
    last_accessed: float = field(default_factory=time.time)
    turns: list[ConversationTurn] = field(default_factory=list)

    # Cached visual / geospatial assets so follow-ups don't need re-uploads
    images: list[str] = field(default_factory=list)
    optical_image: str | None = None
    sar_image: str | None = None
    image_t1: str | None = None
    image_t2: str | None = None
    roi: Any = None
    bbox: list[float] | None = None
    stac_metadata: dict[str, Any] | None = None
    output_image_b64: str | None = None
    artifacts: list[dict[str, Any]] = field(default_factory=list)

    def touch(self) -> None:
        self.last_accessed = time.time()

    def has_assets(self) -> bool:
        return bool(
            self.images
            or self.optical_image
            or self.sar_image
            or self.image_t1
            or self.image_t2
            or self.bbox
            or self.output_image_b64
        )


class SessionManager:
    """Thread-safe session manager with local SQLite database persistence."""

    def __init__(self, db_path: Path | str | None = None, ttl_seconds: float = 86400.0) -> None:
        if db_path is None:
            self.db_path = get_settings().session_db_path
        else:
            self.db_path = Path(db_path) if isinstance(db_path, str) and db_path != ":memory:" else db_path

        self.ttl_seconds = ttl_seconds
        self._sessions: dict[str, SessionData] = {}
        self._lock = threading.Lock()
        if self.db_path == ":memory:":
            self._mem_conn = sqlite3.connect(":memory:", check_same_thread=False)
            self._mem_conn.row_factory = sqlite3.Row
        else:
            self._mem_conn = None
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        if self._mem_conn is not None:
            return self._mem_conn
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        if self.db_path != ":memory:":
            Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)

        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    created_at REAL,
                    last_accessed REAL,
                    images TEXT,
                    optical_image TEXT,
                    sar_image TEXT,
                    image_t1 TEXT,
                    image_t2 TEXT,
                    roi TEXT,
                    bbox TEXT,
                    stac_metadata TEXT,
                    output_image_b64 TEXT,
                    artifacts TEXT
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS turns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT,
                    turn_id INTEGER,
                    query TEXT,
                    resolved_query TEXT,
                    final_answer TEXT,
                    task TEXT,
                    evidence_summary TEXT,
                    timestamp REAL,
                    FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
                )
            """)
            conn.commit()

    def _load_session_from_db_locked(self, session_id: str) -> SessionData | None:
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
            ).fetchone()
            if not row:
                return None

            turn_rows = conn.execute(
                "SELECT * FROM turns WHERE session_id = ? ORDER BY turn_id ASC", (session_id,)
            ).fetchall()

            turns = [
                ConversationTurn(
                    turn_id=t["turn_id"],
                    query=t["query"],
                    resolved_query=t["resolved_query"] or t["query"],
                    final_answer=t["final_answer"],
                    task=t["task"],
                    evidence_summary=t["evidence_summary"],
                    timestamp=t["timestamp"],
                )
                for t in turn_rows
            ]

            images = json.loads(row["images"]) if row["images"] else []
            roi = json.loads(row["roi"]) if row["roi"] else None
            bbox = json.loads(row["bbox"]) if row["bbox"] else None
            stac_metadata = json.loads(row["stac_metadata"]) if row["stac_metadata"] else None
            artifacts = json.loads(row["artifacts"]) if row["artifacts"] else []

            session = SessionData(
                session_id=row["session_id"],
                created_at=row["created_at"],
                last_accessed=row["last_accessed"],
                turns=turns,
                images=images,
                optical_image=row["optical_image"],
                sar_image=row["sar_image"],
                image_t1=row["image_t1"],
                image_t2=row["image_t2"],
                roi=roi,
                bbox=bbox,
                stac_metadata=stac_metadata,
                output_image_b64=row["output_image_b64"],
                artifacts=artifacts,
            )
            self._sessions[session_id] = session
            return session

    def _persist_session_to_db_locked(self, session: SessionData) -> None:
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO sessions (
                    session_id, created_at, last_accessed, images, optical_image,
                    sar_image, image_t1, image_t2, roi, bbox, stac_metadata,
                    output_image_b64, artifacts
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                    last_accessed = excluded.last_accessed,
                    images = excluded.images,
                    optical_image = excluded.optical_image,
                    sar_image = excluded.sar_image,
                    image_t1 = excluded.image_t1,
                    image_t2 = excluded.image_t2,
                    roi = excluded.roi,
                    bbox = excluded.bbox,
                    stac_metadata = excluded.stac_metadata,
                    output_image_b64 = excluded.output_image_b64,
                    artifacts = excluded.artifacts
                """,
                (
                    session.session_id,
                    session.created_at,
                    session.last_accessed,
                    json.dumps(session.images) if session.images else None,
                    session.optical_image,
                    session.sar_image,
                    session.image_t1,
                    session.image_t2,
                    json.dumps(session.roi) if session.roi else None,
                    json.dumps(session.bbox) if session.bbox else None,
                    json.dumps(session.stac_metadata) if session.stac_metadata else None,
                    session.output_image_b64,
                    json.dumps(session.artifacts) if session.artifacts else None,
                ),
            )
            conn.commit()

    def get_or_create(self, session_id: str | None = None) -> SessionData:
        with self._lock:
            self._cleanup_expired_locked()
            if session_id:
                if session_id in self._sessions:
                    session = self._sessions[session_id]
                    session.touch()
                    self._persist_session_to_db_locked(session)
                    return session

                # Check SQLite
                session = self._load_session_from_db_locked(session_id)
                if session:
                    session.touch()
                    self._persist_session_to_db_locked(session)
                    return session

            new_id = session_id or str(uuid.uuid4())
            session = SessionData(session_id=new_id)
            self._sessions[new_id] = session
            self._persist_session_to_db_locked(session)
            return session

    def get(self, session_id: str) -> SessionData | None:
        with self._lock:
            self._cleanup_expired_locked()
            if session_id in self._sessions:
                session = self._sessions[session_id]
                session.touch()
                return session

            # Try loading from SQLite
            session = self._load_session_from_db_locked(session_id)
            if session:
                session.touch()
            return session

    def update_assets(
        self,
        session_id: str,
        *,
        images: list[str] | None = None,
        optical_image: str | None = None,
        sar_image: str | None = None,
        image_t1: str | None = None,
        image_t2: str | None = None,
        roi: Any = None,
        bbox: list[float] | None = None,
        stac_metadata: dict[str, Any] | None = None,
        output_image_b64: str | None = None,
        artifacts: list[dict[str, Any]] | None = None,
        replace: bool = False,
    ) -> None:
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                session = self._load_session_from_db_locked(session_id)
            if not session:
                session = SessionData(session_id=session_id)
                self._sessions[session_id] = session

            session.touch()
            if replace:
                session.images = list(images) if images else []
                session.optical_image = optical_image
                session.sar_image = sar_image
                session.image_t1 = image_t1
                session.image_t2 = image_t2
                session.roi = roi
                session.bbox = bbox
                session.stac_metadata = stac_metadata
                session.output_image_b64 = output_image_b64
                session.artifacts = list(artifacts) if artifacts else []
            else:
                if images:
                    session.images = list(images)
                if optical_image is not None:
                    session.optical_image = optical_image
                if sar_image is not None:
                    session.sar_image = sar_image
                if image_t1 is not None:
                    session.image_t1 = image_t1
                if image_t2 is not None:
                    session.image_t2 = image_t2
                if roi is not None:
                    session.roi = roi
                if bbox is not None:
                    session.bbox = bbox
                if stac_metadata is not None:
                    session.stac_metadata = stac_metadata
                if output_image_b64 is not None:
                    session.output_image_b64 = output_image_b64
                if artifacts:
                    session.artifacts = list(artifacts)

            self._persist_session_to_db_locked(session)

    def save_turn(
        self,
        session_id: str,
        *,
        query: str,
        resolved_query: str,
        final_answer: str,
        task: str | None = None,
        evidence: list[dict[str, Any]] | None = None,
    ) -> ConversationTurn:
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                session = self._load_session_from_db_locked(session_id)
            if not session:
                session = SessionData(session_id=session_id)
                self._sessions[session_id] = session

            session.touch()
            turn_id = len(session.turns) + 1

            summary_parts: list[str] = []
            if evidence:
                for item in evidence:
                    finding = item.get("verified_finding") or item.get("finding")
                    if finding and item.get("status") != "failed":
                        summary_parts.append(str(finding)[:200])
            evidence_summary = "; ".join(summary_parts) if summary_parts else None

            turn = ConversationTurn(
                turn_id=turn_id,
                query=query,
                resolved_query=resolved_query,
                final_answer=final_answer,
                task=task,
                evidence_summary=evidence_summary,
            )
            session.turns.append(turn)

            # Persist to SQLite
            with self._get_connection() as conn:
                conn.execute(
                    """
                    INSERT INTO turns (
                        session_id, turn_id, query, resolved_query, final_answer, task, evidence_summary, timestamp
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        session_id,
                        turn.turn_id,
                        turn.query,
                        turn.resolved_query,
                        turn.final_answer,
                        turn.task,
                        turn.evidence_summary,
                        turn.timestamp,
                    ),
                )
                conn.execute(
                    "UPDATE sessions SET last_accessed = ? WHERE session_id = ?",
                    (session.last_accessed, session_id),
                )
                conn.commit()

            return turn

    def hydrate_state(self, state: dict[str, Any]) -> dict[str, Any]:
        """Hydrate state with session images and history if missing."""
        session_id = state.get("session_id")
        if not session_id:
            return state

        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                session = self._load_session_from_db_locked(session_id)
            if not session:
                return state

            session.touch()

            # Carry over visual assets if not provided in the current turn
            if not state.get("images") and session.images:
                state["images"] = list(session.images)
            if state.get("optical_image") is None and session.optical_image:
                state["optical_image"] = session.optical_image
            if state.get("sar_image") is None and session.sar_image:
                state["sar_image"] = session.sar_image
            if state.get("image_t1") is None and session.image_t1:
                state["image_t1"] = session.image_t1
            if state.get("image_t2") is None and session.image_t2:
                state["image_t2"] = session.image_t2
            if state.get("roi") is None and session.roi:
                state["roi"] = session.roi
            if state.get("bbox") is None and session.bbox:
                state["bbox"] = session.bbox
            if state.get("stac_metadata") is None and session.stac_metadata:
                state["stac_metadata"] = session.stac_metadata
            if state.get("output_image_b64") is None and session.output_image_b64:
                state["output_image_b64"] = session.output_image_b64
            if not state.get("artifacts") and session.artifacts:
                state["artifacts"] = list(session.artifacts)

            # Populate conversation history
            state["conversation_history"] = [t.to_dict() for t in session.turns]

        return state

    def format_history_text(self, session_id: str, max_turns: int = 4) -> str:
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                session = self._load_session_from_db_locked(session_id)
            if not session or not session.turns:
                return ""
            recent = session.turns[-max_turns:]
            lines: list[str] = []
            for t in recent:
                lines.append(f"User: {t.query}")
                lines.append(f"Assistant: {t.final_answer}")
            return "\n".join(lines)

    def delete(self, session_id: str) -> bool:
        with self._lock:
            in_memory = bool(self._sessions.pop(session_id, None))
            with self._get_connection() as conn:
                cursor = conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
                conn.execute("DELETE FROM turns WHERE session_id = ?", (session_id,))
                conn.commit()
                in_db = cursor.rowcount > 0
            return in_memory or in_db

    def clear(self) -> None:
        with self._lock:
            self._sessions.clear()
            with self._get_connection() as conn:
                conn.execute("DELETE FROM turns")
                conn.execute("DELETE FROM sessions")
                conn.commit()

    def list_sessions(self) -> list[dict[str, Any]]:
        with self._lock:
            self._cleanup_expired_locked()
            with self._get_connection() as conn:
                rows = conn.execute("""
                    SELECT s.session_id, s.created_at, s.last_accessed,
                           COUNT(t.id) as turn_count,
                           s.images, s.optical_image, s.sar_image, s.image_t1, s.image_t2, s.bbox, s.output_image_b64
                    FROM sessions s
                    LEFT JOIN turns t ON s.session_id = t.session_id
                    GROUP BY s.session_id
                    ORDER BY s.last_accessed DESC
                """).fetchall()

                result = []
                for r in rows:
                    has_assets = bool(
                        (r["images"] and r["images"] != "[]")
                        or r["optical_image"]
                        or r["sar_image"]
                        or r["image_t1"]
                        or r["image_t2"]
                        or r["bbox"]
                        or r["output_image_b64"]
                    )
                    result.append(
                        {
                            "session_id": r["session_id"],
                            "created_at": r["created_at"],
                            "last_accessed": r["last_accessed"],
                            "turn_count": r["turn_count"],
                            "has_assets": has_assets,
                        }
                    )
                return result

    def _cleanup_expired_locked(self) -> int:
        now = time.time()
        expired_cutoff = now - self.ttl_seconds
        # Remove from memory
        expired_sids = [sid for sid, s in self._sessions.items() if (now - s.last_accessed) > self.ttl_seconds]
        for sid in expired_sids:
            del self._sessions[sid]

        # Remove from SQLite
        with self._get_connection() as conn:
            cursor = conn.execute("DELETE FROM sessions WHERE last_accessed < ?", (expired_cutoff,))
            conn.execute("DELETE FROM turns WHERE session_id NOT IN (SELECT session_id FROM sessions)")
            conn.commit()
            return cursor.rowcount


_SESSION_MANAGER: SessionManager | None = None


def get_session_manager() -> SessionManager:
    global _SESSION_MANAGER
    if _SESSION_MANAGER is None:
        _SESSION_MANAGER = SessionManager()
    return _SESSION_MANAGER


def reset_session_manager() -> None:
    global _SESSION_MANAGER
    if _SESSION_MANAGER is not None:
        _SESSION_MANAGER.clear()
    _SESSION_MANAGER = SessionManager(db_path=":memory:")

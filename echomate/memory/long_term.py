"""Long-term memory module for EchoMate using LlamaIndex + Chroma.

Provides persistent RAG-based memory storage and retrieval using Chroma as the
vector database and LlamaIndex for orchestrating embeddings and search. Memory
entries are stored with metadata and timestamps, and can be retrieved via
semantic similarity search.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import chromadb
from chromadb.config import Settings as ChromaSettings
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
from llama_index.core import Document, Settings, StorageContext, VectorStoreIndex
from llama_index.core.base.embeddings.base import BaseEmbedding
from llama_index.core.schema import NodeWithScore
from llama_index.vector_stores.chroma import ChromaVectorStore

from echomate.models import MemoryEntry

logger = logging.getLogger(__name__)


class _ChromaDefaultEmbedding(BaseEmbedding):
    """LlamaIndex-compatible embedding using Chroma's default ONNX model.

    Wraps Chroma's built-in all-MiniLM-L6-v2 ONNX embedding function so
    LlamaIndex can use it without requiring OpenAI or HuggingFace packages.
    """

    model_name: str = "all-MiniLM-L6-v2"

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._ef = DefaultEmbeddingFunction()

    def _get_query_embedding(self, query: str) -> list[float]:
        """Get embedding for a single query string."""
        return self._ef([query])[0]

    def _get_text_embedding(self, text: str) -> list[float]:
        """Get embedding for a single text string."""
        return self._ef([text])[0]

    def _get_text_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Get embeddings for multiple texts in a batch."""
        return self._ef(texts)

    async def _aget_query_embedding(self, query: str) -> list[float]:
        """Async get embedding for a single query string."""
        return self._get_query_embedding(query)

    async def _aget_text_embedding(self, text: str) -> list[float]:
        """Async get embedding for a single text string."""
        return self._get_text_embedding(text)


class LongTermMemory:
    """Persistent RAG memory using LlamaIndex + Chroma.

    Stores, searches, and deletes memory entries in a Chroma vector database
    with semantic similarity search powered by LlamaIndex embeddings.

    Args:
        chroma_persist_dir: Filesystem path for Chroma persistence.
            Defaults to "./data/chroma".
        collection_name: Name of the Chroma collection to use.
            Defaults to "echomate_memories".

    Attributes:
        chroma_client: The ChromaDB persistent client instance.
        collection: The Chroma collection storing memory vectors.
        index: The LlamaIndex VectorStoreIndex for search operations.
    """

    def __init__(
        self,
        chroma_persist_dir: str = "./data/chroma",
        collection_name: str = "echomate_memories",
    ) -> None:
        """Initialize long-term memory with Chroma backend.

        Creates or connects to an existing Chroma collection. If Chroma
        is unavailable, the instance is created in a degraded state where
        is_available() returns False and operations are no-ops.

        Args:
            chroma_persist_dir: Filesystem path for Chroma persistence.
            collection_name: Name of the Chroma collection to use.
        """
        self._available = False
        self._collection_name = collection_name
        self.chroma_client: chromadb.ClientAPI | None = None
        self.collection: chromadb.Collection | None = None
        self.index: VectorStoreIndex | None = None

        try:
            # Use local ONNX embedding model (no API key required)
            embed_model = _ChromaDefaultEmbedding()
            Settings.embed_model = embed_model
            Settings.llm = None  # No LLM needed for memory operations

            self.chroma_client = chromadb.PersistentClient(
                path=chroma_persist_dir,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            self.collection = self.chroma_client.get_or_create_collection(
                name=collection_name,
            )

            vector_store = ChromaVectorStore(chroma_collection=self.collection)
            storage_context = StorageContext.from_defaults(vector_store=vector_store)
            self.index = VectorStoreIndex.from_vector_store(
                vector_store=vector_store,
                storage_context=storage_context,
            )

            self._available = True
            logger.info(
                "Long-term memory initialized",
                extra={
                    "chroma_persist_dir": chroma_persist_dir,
                    "collection_name": collection_name,
                },
            )
        except Exception as exc:
            logger.error(
                "Failed to initialize long-term memory: %s",
                str(exc),
                extra={"chroma_persist_dir": chroma_persist_dir},
            )

    async def store(self, text: str, metadata: dict[str, Any]) -> None:
        """Embed and persist a memory entry in Chroma.

        Creates a new document with a unique ID and timestamps, embeds it
        using LlamaIndex, and persists it in the Chroma collection.

        Args:
            text: The fact, preference, or event text to store.
            metadata: Additional context including category, source session, etc.
                Expected keys: "category" (str), plus any additional context.

        Returns:
            None. Silently returns if Chroma is unavailable.
        """
        if not self._available or self.index is None:
            logger.warning("Long-term memory unavailable; skipping store operation")
            return

        entry_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()

        doc_metadata: dict[str, Any] = {
            "entry_id": entry_id,
            "timestamp": timestamp,
            "category": metadata.get("category", "fact"),
        }
        # Merge additional metadata (flatten for Chroma compatibility)
        for key, value in metadata.items():
            if key != "category" and isinstance(value, (str, int, float, bool)):
                doc_metadata[key] = value

        document = Document(
            text=text,
            doc_id=entry_id,
            metadata=doc_metadata,
        )

        try:
            self.index.insert(document)
            logger.info(
                "Stored memory entry",
                extra={"entry_id": entry_id, "category": doc_metadata["category"]},
            )
        except Exception as exc:
            logger.error("Failed to store memory entry: %s", str(exc))

    async def search(
        self,
        query: str,
        top_k: int = 5,
        min_score: float = 0.7,
    ) -> list[MemoryEntry]:
        """Perform semantic search over long-term memory.

        Retrieves the top-k most similar entries that meet the minimum
        similarity score threshold.

        Args:
            query: The search query text for semantic matching.
            top_k: Maximum number of results to return. Defaults to 5.
            min_score: Minimum similarity score threshold (0.0 to 1.0).
                Entries below this score are excluded. Defaults to 0.7.

        Returns:
            List of MemoryEntry objects sorted by similarity score (descending).
            Returns an empty list if Chroma is unavailable or no results meet
            the threshold.
        """
        if not self._available or self.index is None:
            logger.warning("Long-term memory unavailable; skipping search operation")
            return []

        try:
            retriever = self.index.as_retriever(similarity_top_k=top_k)
            nodes: list[NodeWithScore] = retriever.retrieve(query)

            entries: list[MemoryEntry] = []
            for node in nodes:
                score = node.score if node.score is not None else 0.0
                if score < min_score:
                    continue

                node_metadata = node.node.metadata if node.node.metadata else {}
                entry = MemoryEntry(
                    id=node_metadata.get("entry_id", str(uuid.uuid4())),
                    text=node.node.get_content(),
                    category=node_metadata.get("category", "fact"),
                    timestamp=datetime.fromisoformat(
                        node_metadata.get(
                            "timestamp",
                            datetime.now(timezone.utc).isoformat(),
                        )
                    ),
                    metadata={
                        k: v
                        for k, v in node_metadata.items()
                        if k not in ("entry_id", "timestamp", "category")
                    },
                    similarity_score=score,
                )
                entries.append(entry)

            entries.sort(key=lambda e: e.similarity_score, reverse=True)
            logger.debug(
                "Memory search completed",
                extra={"query": query, "results_count": len(entries)},
            )
            return entries

        except Exception as exc:
            logger.error("Failed to search memory: %s", str(exc))
            return []

    async def delete(self, query: str) -> list[str]:
        """Find and delete matching entries by semantic similarity.

        Performs a semantic search to identify relevant entries, then removes
        them from the Chroma collection.

        Args:
            query: The search query to find entries to delete.

        Returns:
            List of text descriptions of removed entries. Returns an empty
            list if Chroma is unavailable or no matches are found.
        """
        if not self._available or self.collection is None or self.index is None:
            logger.warning("Long-term memory unavailable; skipping delete operation")
            return []

        try:
            # Search for matching entries with a lower threshold for deletion
            # since the user explicitly requests deletion
            entries = await self.search(query, top_k=5, min_score=0.5)

            if not entries:
                return []

            removed_descriptions: list[str] = []
            for entry in entries:
                try:
                    # Delete from Chroma collection by entry_id
                    self.collection.delete(
                        where={"entry_id": entry.id},
                    )
                    removed_descriptions.append(entry.text)
                    logger.info(
                        "Deleted memory entry",
                        extra={"entry_id": entry.id, "text_preview": entry.text[:50]},
                    )
                except Exception as del_exc:
                    logger.error(
                        "Failed to delete entry %s: %s", entry.id, str(del_exc)
                    )

            # Refresh the index after deletions
            if removed_descriptions:
                vector_store = ChromaVectorStore(chroma_collection=self.collection)
                storage_context = StorageContext.from_defaults(
                    vector_store=vector_store
                )
                self.index = VectorStoreIndex.from_vector_store(
                    vector_store=vector_store,
                    storage_context=storage_context,
                )

            return removed_descriptions

        except Exception as exc:
            logger.error("Failed to delete memory entries: %s", str(exc))
            return []

    def is_available(self) -> bool:
        """Check if Chroma connection is healthy.

        Performs a lightweight heartbeat check on the Chroma client to
        verify the connection is still active.

        Returns:
            True if Chroma is connected and responsive, False otherwise.
        """
        if not self._available or self.chroma_client is None:
            return False

        try:
            # Heartbeat check - this contacts the Chroma backend
            self.chroma_client.heartbeat()
            return True
        except Exception:
            logger.warning("Chroma health check failed")
            return False

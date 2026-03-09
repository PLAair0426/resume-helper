"""RAG知识库服务 - 基于TF-IDF的轻量检索（纯Python，无原生依赖）"""
import json
import logging
import pickle
from pathlib import Path
from typing import Optional

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from backend.core.config import settings

logger = logging.getLogger(__name__)

KNOWLEDGE_DIR = settings.knowledge_dir


class KnowledgeCollection:
    """单个知识集合：文档 + TF-IDF索引"""

    def __init__(self, name: str):
        self.name = name
        self.documents: list[str] = []
        self.metadatas: list[dict] = []
        self.ids: list[str] = []
        self.vectorizer: Optional[TfidfVectorizer] = None
        self.tfidf_matrix = None

    def add(self, documents: list[str], ids: list[str], metadatas: list[dict]):
        self.documents.extend(documents)
        self.ids.extend(ids)
        self.metadatas.extend(metadatas)
        self._rebuild_index()

    def _rebuild_index(self):
        if not self.documents:
            return
        self.vectorizer = TfidfVectorizer(
            analyzer="char_wb",
            ngram_range=(2, 4),
            max_features=5000,
        )
        self.tfidf_matrix = self.vectorizer.fit_transform(self.documents)

    def query(self, query_text: str, n_results: int = 5) -> list[dict]:
        if not self.documents or self.vectorizer is None:
            return []
        query_vec = self.vectorizer.transform([query_text])
        scores = cosine_similarity(query_vec, self.tfidf_matrix).flatten()
        top_indices = np.argsort(scores)[::-1][:n_results]

        results = []
        for idx in top_indices:
            if scores[idx] > 0.01:
                results.append({
                    "text": self.documents[idx],
                    "metadata": self.metadatas[idx],
                    "score": float(scores[idx]),
                })
        return results

    def count(self) -> int:
        return len(self.documents)


class KnowledgeService:
    """知识库管理与RAG检索"""

    def __init__(self):
        self._collections: dict[str, KnowledgeCollection] = {}
        self._initialized = False

    async def initialize(self):
        """初始化知识库：加载规则、词表"""
        if self._initialized:
            return

        self._load_ats_rules()
        self._load_action_verbs()
        self._load_industry_terms()
        self._load_writing_guides()

        self._initialized = True
        total = sum(c.count() for c in self._collections.values())
        logger.info(f"Knowledge base initialized: {len(self._collections)} collections, {total} documents")

    def _get_or_create(self, name: str) -> KnowledgeCollection:
        if name not in self._collections:
            self._collections[name] = KnowledgeCollection(name)
        return self._collections[name]

    def _load_ats_rules(self):
        rules_file = KNOWLEDGE_DIR / "ats_rules" / "rules.md"
        if not rules_file.exists():
            return
        content = rules_file.read_text(encoding="utf-8")
        chunks = self._split_markdown(content)
        if chunks:
            col = self._get_or_create("ats_rules")
            col.add(
                documents=[c["text"] for c in chunks],
                ids=[f"ats_rule_{i}" for i in range(len(chunks))],
                metadatas=[{"section": c.get("section", ""), "source": "ats_rules"} for c in chunks],
            )

    def _load_action_verbs(self):
        verbs_file = KNOWLEDGE_DIR / "action_verbs" / "verbs.json"
        if not verbs_file.exists():
            return
        data = json.loads(verbs_file.read_text(encoding="utf-8"))
        docs, ids, metas = [], [], []
        for lang, categories in data.items():
            for category, verbs in categories.items():
                docs.append(f"{category} ({lang}): {', '.join(verbs)}")
                ids.append(f"verb_{lang}_{category}")
                metas.append({"language": lang, "category": category, "source": "action_verbs"})
        if docs:
            col = self._get_or_create("action_verbs")
            col.add(documents=docs, ids=ids, metadatas=metas)

    def _load_industry_terms(self):
        terms_dir = KNOWLEDGE_DIR / "industry_terms"
        if not terms_dir.exists():
            return
        docs, ids, metas = [], [], []
        for f in terms_dir.glob("*.json"):
            data = json.loads(f.read_text(encoding="utf-8"))
            industry = f.stem
            for role, terms in data.items():
                if isinstance(terms, list):
                    docs.append(f"{industry} - {role}: {', '.join(terms)}")
                    ids.append(f"term_{industry}_{role}")
                    metas.append({"industry": industry, "role": role, "source": "industry_terms"})
        if docs:
            col = self._get_or_create("industry_terms")
            col.add(documents=docs, ids=ids, metadatas=metas)

    def _load_writing_guides(self):
        guides_dir = KNOWLEDGE_DIR / "writing_guides"
        if not guides_dir.exists():
            return
        for f in guides_dir.glob("*.md"):
            content = f.read_text(encoding="utf-8")
            chunks = self._split_markdown(content)
            if chunks:
                col = self._get_or_create("writing_guides")
                col.add(
                    documents=[c["text"] for c in chunks],
                    ids=[f"guide_{f.stem}_{i}" for i in range(len(chunks))],
                    metadatas=[{"section": c.get("section", ""), "source": f.stem} for c in chunks],
                )

    async def query(self, query: str, collection_name: str = None, n_results: int = 5) -> list[dict]:
        """检索知识库"""
        if collection_name:
            col = self._collections.get(collection_name)
            if col:
                return col.query(query, n_results)
            return []

        # 跨所有集合检索
        all_results = []
        for col in self._collections.values():
            all_results.extend(col.query(query, n_results))
        all_results.sort(key=lambda x: x.get("score", 0), reverse=True)
        return all_results[:n_results]

    async def query_multi(self, query: str, collections: list[str] = None, n_results: int = 5) -> dict[str, list[dict]]:
        """跨多个集合检索，按集合分组返回"""
        targets = collections or list(self._collections.keys())
        results = {}
        for name in targets:
            col = self._collections.get(name)
            if col:
                results[name] = col.query(query, n_results)
        return results

    def query_ats_rules(self, query: str, n_results: int = 3) -> list[dict]:
        """检索ATS规则"""
        col = self._collections.get("ats_rules")
        return col.query(query, n_results) if col else []

    def query_action_verbs(self, query: str, n_results: int = 3) -> list[dict]:
        """检索动词词库"""
        col = self._collections.get("action_verbs")
        return col.query(query, n_results) if col else []

    def query_industry_terms(self, query: str, n_results: int = 3) -> list[dict]:
        """检索行业词表"""
        col = self._collections.get("industry_terms")
        return col.query(query, n_results) if col else []

    def query_writing_guides(self, query: str, n_results: int = 3) -> list[dict]:
        """检索写作指南"""
        col = self._collections.get("writing_guides")
        return col.query(query, n_results) if col else []

    def get_stats(self) -> dict:
        """获取知识库统计"""
        return {
            "initialized": self._initialized,
            "collections": {
                name: {"count": col.count()}
                for name, col in self._collections.items()
            },
            "total_documents": sum(c.count() for c in self._collections.values()),
        }

    def _split_markdown(self, content: str) -> list[dict]:
        """将Markdown按标题分块"""
        chunks = []
        current_section = ""
        current_text = []
        for line in content.split("\n"):
            if line.startswith("## ") or line.startswith("### "):
                if current_text:
                    text = "\n".join(current_text).strip()
                    if text:
                        chunks.append({"section": current_section, "text": text})
                current_section = line.lstrip("#").strip()
                current_text = [line]
            else:
                current_text.append(line)
        if current_text:
            text = "\n".join(current_text).strip()
            if text:
                chunks.append({"section": current_section, "text": text})
        return chunks


# 全局单例
knowledge_service = KnowledgeService()

"""Local CPU embeddings with bounded text caching, hybrid scoring and suggested topic tags."""
import re
from collections import OrderedDict
from threading import RLock

# Multilingual model: handles English, Arabic, French, etc.
# (all-MiniLM-L6-v2 is English-only and gives near-random results on other languages)
MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

TOPICS = {
    "Business stationery": "business cards letterheads envelopes corporate stationery",
    "Marketing": "advertising promotional flyers brochures posters marketing",
    "Large format": "large format banners signage outdoor displays",
    "Packaging": "packaging boxes labels stickers product wrapping",
    "Personalized gifts": "personalized gifts mugs shirts custom presents",
    "Books & documents": "books documents photocopies binding reports notebooks",
    "Events": "wedding invitations event tickets celebration cards",
    "Print supplies": "printing supplies paper ink toner materials",
}

SEMANTIC_WEIGHT = 0.75
LEXICAL_WEIGHT = 0.25
TAG_THRESHOLD = 0.3

_model = None
_cache = OrderedDict()
_lock = RLock()


class SemanticSearchUnavailable(RuntimeError):
    pass


def _tokens(text: str) -> set:
    """Lowercased word tokens (unicode-aware, so Arabic/French work too)."""
    return set(re.findall(r"\w{2,}", (text or "").lower()))


def _embeddings(texts):
    global _model
    try:
        if _model is None:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer(MODEL_NAME, device="cpu")
        missing = list(dict.fromkeys(text for text in texts if text not in _cache))
        if missing:
            vectors = _model.encode(missing, normalize_embeddings=True, show_progress_bar=False)
            _cache.update(zip(missing, vectors))
        result = [_cache[text] for text in texts]
        for text in texts:
            _cache.move_to_end(text)
        while len(_cache) > 10000:
            _cache.popitem(last=False)
        return result
    except Exception as exc:
        raise SemanticSearchUnavailable("The local embedding model could not be loaded or run.") from exc


def perform_semantic_search(query: str, items: list[dict], text_key: str = "search_text",
                            top_k: int = 20, min_score: float = 0.3) -> list[dict]:
    if not items or not query.strip() or top_k <= 0:
        return []

    with _lock:
        vectors = _embeddings(
            [query] + [item.get(text_key, "") for item in items] + list(TOPICS.values())
        )

    query_vector = vectors[0]
    corpus = vectors[1:len(items) + 1]
    topics = vectors[len(items) + 1:]
    q_tokens = _tokens(query)

    # Hybrid score: semantic similarity + keyword overlap (helps with names / invoice numbers)
    scored = []
    for idx, item in enumerate(items):
        semantic = float(query_vector @ corpus[idx])
        doc_tokens = _tokens(item.get(text_key, "") + " " + item.get("title", ""))
        lexical = len(q_tokens & doc_tokens) / len(q_tokens) if q_tokens else 0.0
        scored.append((SEMANTIC_WEIGHT * semantic + LEXICAL_WEIGHT * lexical, idx))

    scored.sort(reverse=True)

    results = []
    for score, idx in scored[:top_k]:
        if score < min_score:
            continue
        tags = sorted(
            zip(TOPICS, (float(corpus[idx] @ topic) for topic in topics)),
            key=lambda pair: pair[1],
            reverse=True,
        )
        results.append({
            **items[idx],
            "similarity_score": round(score, 4),
            "tags": [name for name, s in tags[:3] if s >= TAG_THRESHOLD],
        })
    return results
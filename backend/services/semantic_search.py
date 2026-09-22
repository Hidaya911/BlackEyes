# from sentence_transformers import SentenceTransformer, util
# import torch

# # Load a lightweight, free, open-source embedding model locally (runs on CPU)
# model = SentenceTransformer('all-MiniLM-L6-v2')

# def perform_semantic_search(query: str, items: list[dict], text_key: str = "description", top_k: int = 5) -> list[dict]:
#     """
#     Searches a list of dictionaries using semantic natural language matching.
#     :param query: Natural language search string from the user.
#     :param items: List of dict records from your database (e.g., products, invoices).
#     :param text_key: The dictionary key containing the text to match against.
#     :param top_k: Number of top matching results to return.
#     """
#     if not items or not query:
#         return []

#     # Extract text fields from records
#     corpus = [item.get(text_key, "") for item in items]
    
#     # Encode query and corpus text into embeddings
#     query_embedding = model.encode(query, convert_to_tensor=True)
#     corpus_embeddings = model.encode(corpus, convert_to_tensor=True)

#     # Compute cosine similarities
#     cos_scores = util.cos_sim(query_embedding, corpus_embeddings)[0]
    
#     # Get top_k matching indices
#     top_results = torch.topk(cos_scores, k=min(top_k, len(items)))

#     results = []
#     for score, idx in zip(top_results.values, top_results.indices):
#         item_copy = items[idx].copy()
#         item_copy["similarity_score"] = round(float(score), 4)
#         results.append(item_copy)

#     return results
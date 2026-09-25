Smart Search uses the local CPU model `sentence-transformers/all-MiniLM-L6-v2`.
Install backend requirements, then run the backend normally. The first nonempty
search downloads the model from Hugging Face and caches it for subsequent use.
For deployment, pre-download the model under the service account with:

    python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2', device='cpu')"

Provision a persistent model cache and sufficient memory for PyTorch. This feature
is intended for the persistent Python backend; a constrained serverless runtime
may need a separately hosted search service. No paid API key is required.

GET `/api/search/semantic?q=business+stationery&record_type=all&limit=30`
requires the existing session cookie and an admin or staff role. Products and
customer invoices are available to both; vendor invoices retain admin-only access.
Results include USD amounts, cosine similarity, and up to three suggested topic
tags. Tags are generated from a fixed print-domain taxonomy and are not persisted
or written back to records. Similarity is not confidence or a probability.

Text vectors are cached in a bounded, process-local cache. Source text is fetched
fresh each request, so edits and deletions are reflected immediately. For large
datasets, replace full-corpus reads and scoring with a persistent vector index.
The model has a finite text window, so very long invoice descriptions may be
truncated during embedding. Model failures return a retryable 503 response.

Run isolated regressions with:

    python -B -m unittest discover -s tests -p test_smart_search.py -v

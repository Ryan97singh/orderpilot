"""Create/refresh the Azure AI Search index from knowledge/*.md (same chunks as local BM25).

Usage: AZURE_SEARCH_ENDPOINT=... AZURE_SEARCH_KEY=<admin key> python -m scripts.index_knowledge
"""

from dataclasses import asdict

from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    SearchableField,
    SearchIndex,
    SimpleField,
)

from app.config import get_settings
from app.search.chunking import load_chunks


def main() -> None:
    settings = get_settings()
    credential = AzureKeyCredential(settings.azure_search_key)
    index = SearchIndex(
        name=settings.azure_search_index,
        fields=[
            SimpleField(name="id", type="Edm.String", key=True),
            SimpleField(name="doc", type="Edm.String", filterable=True),
            SearchableField(name="title", type="Edm.String", analyzer_name="en.microsoft"),
            SearchableField(name="content", type="Edm.String", analyzer_name="en.microsoft"),
        ],
    )
    SearchIndexClient(settings.azure_search_endpoint, credential).create_or_update_index(index)

    chunks = [asdict(chunk) for chunk in load_chunks(settings.knowledge_dir)]
    client = SearchClient(settings.azure_search_endpoint, settings.azure_search_index, credential)
    results = client.merge_or_upload_documents(chunks)
    print(f"Indexed {sum(r.succeeded for r in results)}/{len(chunks)} chunks into {index.name}")


if __name__ == "__main__":
    main()

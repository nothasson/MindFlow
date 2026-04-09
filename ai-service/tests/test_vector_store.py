from app.services import vector_store


class FakeClient:
    def __init__(self):
        self.calls = []

    def upsert(self, collection_name, points):
        self.calls.append((collection_name, points))


def test_upsert_vectors_writes_payload(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(vector_store, "get_client", lambda: client)

    inserted = vector_store.upsert_vectors(
        collection="documents",
        texts=["向量空间"],
        embeddings=[[0.1, 0.2, 0.3]],
        metadata={"resource_id": "res-1", "chunk_index": "0"},
    )

    assert inserted == 1
    assert len(client.calls) == 1
    collection_name, points = client.calls[0]
    assert collection_name == "documents"
    assert points[0].payload["text"] == "向量空间"
    assert points[0].payload["resource_id"] == "res-1"

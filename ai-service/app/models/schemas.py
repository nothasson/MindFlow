from pydantic import BaseModel


class ParseResponse(BaseModel):
    text: str
    pages: int
    filename: str


class EmbedRequest(BaseModel):
    texts: list[str]


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]
    dimension: int


class SearchRequest(BaseModel):
    query: str
    collection: str = "documents"
    limit: int = 5


class SearchResult(BaseModel):
    text: str
    score: float
    metadata: dict = {}


class SearchResponse(BaseModel):
    results: list[SearchResult]


class ExtractRequest(BaseModel):
    text: str


class KnowledgePoint(BaseModel):
    concept: str
    description: str
    prerequisites: list[str] = []


class ExtractResponse(BaseModel):
    points: list[KnowledgePoint]

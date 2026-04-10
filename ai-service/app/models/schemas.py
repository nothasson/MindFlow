from pydantic import BaseModel, Field


class ParseResponse(BaseModel):
    text: str
    pages: int
    filename: str


class EmbedRequest(BaseModel):
    texts: list[str]


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]
    dimension: int


class UpsertRequest(BaseModel):
    collection: str = "documents"
    texts: list[str]
    embeddings: list[list[float]]
    metadata: dict[str, str] = Field(default_factory=dict)


class UpsertResponse(BaseModel):
    inserted: int


class URLParseRequest(BaseModel):
    url: str


class URLParseResponse(BaseModel):
    text: str
    title: str
    source_url: str


class SearchRequest(BaseModel):
    query: str
    collection: str = "documents"
    limit: int = 5


class SearchResult(BaseModel):
    text: str
    score: float
    metadata: dict = Field(default_factory=dict)


class SearchResponse(BaseModel):
    results: list[SearchResult]


class ExtractRequest(BaseModel):
    text: str
    existing_concepts: list[str] = Field(default_factory=list)  # 已有概念名，用于去重


class KnowledgeRelation(BaseModel):
    target: str
    type: str = "prerequisite"  # prerequisite/similar/application/part_of/causal
    strength: float = 0.5


class KnowledgePoint(BaseModel):
    concept: str
    description: str = ""
    prerequisites: list[str] = Field(default_factory=list)
    bloom_level: str = "remember"  # remember/understand/apply/analyze/evaluate/create
    importance: float = 0.5
    granularity: int = 3  # L1-L4
    relations: list[KnowledgeRelation] = Field(default_factory=list)


class ExtractResponse(BaseModel):
    points: list[KnowledgePoint]

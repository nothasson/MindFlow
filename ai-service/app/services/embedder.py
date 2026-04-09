import hashlib
import math
import re

_DIMENSION = 256
_TOKEN_PATTERN = re.compile(r"\w+|[\u4e00-\u9fff]", re.UNICODE)


def _tokenize(text: str) -> list[str]:
    return [token.lower() for token in _TOKEN_PATTERN.findall(text)]


def _hash_token(token: str) -> int:
    digest = hashlib.sha256(token.encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big") % _DIMENSION


def _normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vector))
    if norm == 0:
        return vector
    return [v / norm for v in vector]


def embed_texts(texts: list[str]) -> tuple[list[list[float]], int]:
    """生成轻量本地嵌入向量。

    使用基于 token hashing 的确定性向量，避免引入 sentence-transformers/torch
    这类超重依赖，优先满足个人产品、本地优先的启动体验。
    """
    embeddings: list[list[float]] = []

    for text in texts:
        vector = [0.0] * _DIMENSION
        tokens = _tokenize(text)

        if not tokens and text:
            tokens = list(text)

        for token in tokens:
            index = _hash_token(token)
            vector[index] += 1.0

        embeddings.append(_normalize(vector))

    return embeddings, _DIMENSION

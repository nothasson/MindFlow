import logging
import os

import httpx

logger = logging.getLogger(__name__)

_DIMENSION = 1024
_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
_API_URL = os.getenv("EMBEDDING_API_URL", "https://api.siliconflow.cn/v1/embeddings")
_API_KEY = os.getenv("EMBEDDING_API_KEY", "")
_LLM_API_KEY = os.getenv("LLM_API_KEY", "")


async def embed_texts(texts: list[str]) -> tuple[list[list[float]], int]:
    """使用 SiliconFlow Embedding API 生成语义向量。

    模型默认 BAAI/bge-m3（1024 维，多语言，免费）。
    API Key 优先使用 EMBEDDING_API_KEY，回退到 LLM_API_KEY。
    """
    api_key = _API_KEY or _LLM_API_KEY
    if not api_key:
        raise ValueError("未配置 EMBEDDING_API_KEY 或 LLM_API_KEY，无法调用 Embedding API")

    if not texts:
        return [], _DIMENSION

    # SiliconFlow 支持批量 input，但建议单次不超过 64 条
    batch_size = 64
    all_embeddings: list[list[float]] = []

    # 复用 httpx client 避免每次批量重建连接
    async with httpx.AsyncClient(timeout=60.0) as client:
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            resp = await client.post(
                _API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": _MODEL,
                    "input": batch,
                    "encoding_format": "float",
                },
            )

            if resp.status_code != 200:
                logger.error("Embedding API 调用失败: status=%d body=%s", resp.status_code, resp.text)
                resp.raise_for_status()

            data = resp.json()
            # 按 index 排序确保顺序与输入一致
            items = sorted(data["data"], key=lambda x: x["index"])
            # 从 API 响应动态获取实际维度，避免硬编码不一致
            actual_dim = len(items[0]["embedding"]) if items else _DIMENSION
            all_embeddings.extend([item["embedding"] for item in items])

    return all_embeddings, actual_dim

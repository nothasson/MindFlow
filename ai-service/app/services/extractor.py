import json
import os
import re
from urllib import error, request


def extract_knowledge_points(text: str) -> list[dict]:
    """从资料文本中提取知识点。

    优先使用 OpenAI 兼容接口调用 LLM；若未配置密钥或调用失败，则回退到启发式提取。
    """
    cleaned = text.strip()
    if not cleaned:
        return []

    llm_points = _extract_with_llm(cleaned)
    if llm_points:
        return llm_points

    return _extract_with_fallback(cleaned)


def _extract_with_llm(text: str) -> list[dict]:
    api_key = os.getenv("LLM_API_KEY", "")
    if not api_key:
        return []

    base_url = os.getenv("LLM_BASE_URL", "https://api.siliconflow.cn/v1").rstrip("/")
    model = os.getenv("LLM_MODEL", "Pro/MiniMaxAI/MiniMax-M2.5")
    prompt = (
        "你是知识点提取助手。请从学习资料中提取 3-8 个核心知识点，"
        "返回 JSON 数组，每项包含 concept、description、prerequisites。"
        "如果某知识点没有前置知识，prerequisites 返回空数组。"
        "不要输出 JSON 以外的任何文字。"
    )
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": text[:12000]},
        ],
        "temperature": 0.2,
    }

    req = request.Request(
        url=f"{base_url}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except Exception:
        return []

    try:
        content = body["choices"][0]["message"]["content"]
        parsed = json.loads(_extract_json_array(content))
    except (KeyError, IndexError, TypeError, json.JSONDecodeError):
        return []

    normalized = []
    for item in parsed:
        concept = str(item.get("concept", "")).strip()
        if not concept:
            continue
        prerequisites = item.get("prerequisites", [])
        if not isinstance(prerequisites, list):
            prerequisites = []
        normalized.append(
            {
                "concept": concept,
                "description": str(item.get("description", "")).strip(),
                "prerequisites": [str(v).strip() for v in prerequisites if str(v).strip()],
            }
        )
    return normalized


def _extract_with_fallback(text: str) -> list[dict]:
    candidates = []
    parts = re.split(r"[。！？\n]+", text)
    for raw in parts:
        sentence = raw.strip(" -:：、，,；;")
        if len(sentence) < 4:
            continue

        concept = sentence
        if "是" in sentence:
            concept = sentence.split("是", 1)[0].strip()
        elif "指" in sentence:
            concept = sentence.split("指", 1)[0].strip()
        elif len(sentence) > 18:
            concept = sentence[:18].strip()

        if 2 <= len(concept) <= 20 and concept not in candidates:
            candidates.append(concept)
        if len(candidates) >= 6:
            break

    return [
        {"concept": concept, "description": f"资料涉及“{concept}”这一知识点。", "prerequisites": []}
        for concept in candidates
    ]


def _extract_json_array(content: str) -> str:
    match = re.search(r"\[[\s\S]*\]", content)
    if match:
        return match.group(0)
    return content

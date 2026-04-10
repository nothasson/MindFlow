import json
import logging
import os
import re
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)


def extract_knowledge_points(text: str, existing_concepts: list[str] | None = None) -> list[dict]:
    """从资料文本中提取知识点（仅使用 LLM，不做启发式 fallback）。"""
    cleaned = text.strip()
    if not cleaned:
        return []

    return _extract_with_llm(cleaned, existing_concepts or [])


def _build_prompt(existing_concepts: list[str]) -> str:
    """构建知识点提取 Prompt。"""
    prompt = """你是知识点提取专家。从学习资料中提取知识点，返回 JSON 数组。

## 粒度标准
- L2（主题）：如"矩阵运算"，一般占 1-2 课时
- L3（知识点）：如"矩阵乘法"，可独立教学和考核 ← 主要提取这一级
- L4（细节）：如"矩阵乘法结合律"，L3 的子知识

## 每个知识点字段
{
  "concept": "知识点名称（简洁，4-10 字）",
  "description": "一句话定义",
  "bloom_level": "remember/understand/apply/analyze/evaluate/create",
  "importance": 0.8,
  "granularity": 3,
  "relations": [
    {"target": "前置概念", "type": "prerequisite", "strength": 0.9},
    {"target": "相似概念", "type": "similar", "strength": 0.7}
  ],
  "prerequisites": ["前置概念A"]
}

## 关系类型
- prerequisite：前置依赖
- similar：相似/易混淆
- application：应用场景
- part_of：从属关系
- causal：因果关系

## 规则
1. 主要提取 L3 级知识点
2. 每个知识点必须标注 bloom_level 和 importance（0.0-1.0）
3. concept 名称要简洁规范（4-10 字），不要带"的概念""的定义"等后缀
4. 不要输出 JSON 以外的任何文字
"""

    if existing_concepts:
        concepts_str = "、".join(existing_concepts[:200])
        prompt += f"""
## 重要：去重规则
知识图谱中已有以下概念：[{concepts_str}]
1. 如果要提取的知识点与已有概念含义相同或高度相似，**必须使用已有的概念名称**
2. 只提取**新出现的、已有概念中不存在的**核心知识点
3. 如果内容完全在已有概念范围内，返回空数组 []
4. 提取数量控制在 1-3 个，宁少勿多
"""
    else:
        text_len = 0  # will be set by caller context
        prompt += "\n根据资料长度提取：短文 3-5 个，中文 5-8 个，长文 8-12 个。\n"

    return prompt


def _extract_with_llm(text: str, existing_concepts: list[str]) -> list[dict]:
    api_key = os.getenv("LLM_API_KEY", "")
    if not api_key:
        logger.warning("LLM_API_KEY 未配置，无法提取知识点")
        return []

    base_url = os.getenv("LLM_BASE_URL", "https://api.siliconflow.cn/v1").rstrip("/")
    model = os.getenv("LLM_MODEL", "Pro/MiniMaxAI/MiniMax-M2.5")

    prompt = _build_prompt(existing_concepts)

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": text[:12000]},
        ],
        "temperature": 0.2,
    }

    req = Request(
        url=f"{base_url}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        logger.error("LLM 知识点提取请求失败: %s", e)
        return []

    try:
        content = body["choices"][0]["message"]["content"]
        parsed = json.loads(_extract_json_array(content))
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as e:
        logger.error("LLM 知识点提取响应解析失败: %s, content: %s", e, body)
        return []

    return _normalize_points(parsed)


def _normalize_points(parsed: list) -> list[dict]:
    """规范化 LLM 返回的知识点数据。"""
    normalized = []
    for item in parsed:
        concept = str(item.get("concept", "")).strip()
        if not concept:
            continue

        prerequisites = item.get("prerequisites", [])
        if not isinstance(prerequisites, list):
            prerequisites = []

        relations = item.get("relations", [])
        if not isinstance(relations, list):
            relations = []

        # 规范化 relations
        norm_relations = []
        for rel in relations:
            if not isinstance(rel, dict):
                continue
            target = str(rel.get("target", "")).strip()
            rel_type = str(rel.get("type", "prerequisite")).strip()
            strength = float(rel.get("strength", 0.5))
            if target and rel_type:
                norm_relations.append({
                    "target": target,
                    "type": rel_type,
                    "strength": max(0.0, min(1.0, strength)),
                })

        # 从 prerequisites 补充到 relations（兼容旧格式）
        existing_targets = {r["target"] for r in norm_relations}
        for prereq in prerequisites:
            p = str(prereq).strip()
            if p and p not in existing_targets:
                norm_relations.append({"target": p, "type": "prerequisite", "strength": 0.8})

        normalized.append({
            "concept": concept,
            "description": str(item.get("description", "")).strip(),
            "prerequisites": [str(v).strip() for v in prerequisites if str(v).strip()],
            "bloom_level": str(item.get("bloom_level", "remember")).strip(),
            "importance": max(0.0, min(1.0, float(item.get("importance", 0.5)))),
            "granularity": int(item.get("granularity", 3)),
            "relations": norm_relations,
        })
    return normalized


def _extract_json_array(content: str) -> str:
    match = re.search(r"\[[\s\S]*\]", content)
    if match:
        return match.group(0)
    return content

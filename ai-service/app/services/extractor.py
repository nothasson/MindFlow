import json
import logging
import os
import re
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)


def split_by_sections(text: str, max_chars: int = 4000) -> list[str]:
    """按标题分割文本为多个块。

    按 Markdown 标题（# ## ###）或中文章节标题（第X章/节/部分）分割，
    每块 3000-5000 字符，不切断段落。
    """
    if not text.strip():
        return []

    # 按标题行分割：Markdown 标题或"第X章/节/部分"
    section_pattern = re.compile(
        r'^(?=#{1,3}\s|第[一二三四五六七八九十百千\d]+[章节部分])',
        re.MULTILINE,
    )

    parts = section_pattern.split(text)
    # 恢复标题行（split 会丢掉匹配位置前的内容）
    # 用 finditer 找到所有分割位置
    positions = [0] + [m.start() for m in section_pattern.finditer(text)]
    sections = []
    for i, pos in enumerate(positions):
        end = positions[i + 1] if i + 1 < len(positions) else len(text)
        section = text[pos:end].strip()
        if section:
            sections.append(section)

    if not sections:
        sections = [text.strip()]

    # 合并过短的块，拆分过长的块
    chunks = []
    current = ""
    for section in sections:
        if len(current) + len(section) <= max_chars:
            current = (current + "\n\n" + section).strip()
        else:
            if current:
                chunks.append(current)
            # 如果单个 section 就超过 max_chars，按段落拆分
            if len(section) > max_chars:
                paragraphs = section.split("\n\n")
                sub_chunk = ""
                for para in paragraphs:
                    if len(sub_chunk) + len(para) <= max_chars:
                        sub_chunk = (sub_chunk + "\n\n" + para).strip()
                    else:
                        if sub_chunk:
                            chunks.append(sub_chunk)
                        sub_chunk = para
                if sub_chunk:
                    current = sub_chunk
                else:
                    current = ""
            else:
                current = section

    if current:
        chunks.append(current)

    return chunks


def merge_and_deduplicate(all_points: list[list[dict]]) -> list[dict]:
    """合并多块提取结果并去重。

    按 concept 名称去重：
    - 同名概念保留更详细的 description（更长的）
    - 合并 relations（去重）
    - 合并 prerequisites（去重）
    """
    merged: dict[str, dict] = {}

    for points in all_points:
        for point in points:
            concept = point.get("concept", "").strip()
            if not concept:
                continue

            if concept not in merged:
                merged[concept] = dict(point)
            else:
                existing = merged[concept]

                # 保留更详细的 description
                new_desc = point.get("description", "")
                old_desc = existing.get("description", "")
                if len(new_desc) > len(old_desc):
                    existing["description"] = new_desc

                # 保留更高的 importance
                new_imp = point.get("importance", 0.5)
                old_imp = existing.get("importance", 0.5)
                if new_imp > old_imp:
                    existing["importance"] = new_imp

                # 合并 prerequisites 去重
                old_prereqs = set(existing.get("prerequisites", []))
                new_prereqs = point.get("prerequisites", [])
                old_prereqs.update(new_prereqs)
                existing["prerequisites"] = list(old_prereqs)

                # 合并 relations 去重（按 target+type 去重）
                old_rels = existing.get("relations", [])
                rel_keys = {(r["target"], r["type"]) for r in old_rels}
                for rel in point.get("relations", []):
                    key = (rel.get("target", ""), rel.get("type", ""))
                    if key not in rel_keys:
                        old_rels.append(rel)
                        rel_keys.add(key)
                existing["relations"] = old_rels

    return list(merged.values())


def extract_knowledge_points(text: str, existing_concepts: list[str] | None = None) -> list[dict]:
    """从资料文本中提取知识点（仅使用 LLM，不做启发式 fallback）。

    短文本（<= 6000 字）直接整体提取；
    长文本分块提取后合并去重。
    """
    cleaned = text.strip()
    if not cleaned:
        return []

    concepts = existing_concepts or []

    # 短文本直接整体提取
    if len(cleaned) <= 6000:
        return _extract_with_llm(cleaned, concepts)

    # 长文本：分块 → 分别提取 → 合并去重
    chunks = split_by_sections(cleaned, max_chars=4000)
    if not chunks:
        return []

    all_points = []
    for chunk in chunks:
        points = _extract_with_llm(chunk, concepts)
        if points:
            all_points.append(points)
            # 将已提取的概念加入去重列表，避免后续块重复提取
            for p in points:
                c = p.get("concept", "")
                if c and c not in concepts:
                    concepts.append(c)

    if not all_points:
        return []

    return merge_and_deduplicate(all_points)


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

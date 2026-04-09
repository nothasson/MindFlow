from app.services import parser


class FakeHeaders:
    def get_content_charset(self):
        return "utf-8"


class FakeResponse:
    def __init__(self, html: str):
        self._html = html.encode("utf-8")
        self.headers = FakeHeaders()

    def read(self):
        return self._html

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


HTML = """
<html>
  <head>
    <title>线性代数导论</title>
    <style>.hidden {display:none;}</style>
  </head>
  <body>
    <main>
      <h1>线性代数导论</h1>
      <p>向量空间是线性代数的核心对象。</p>
      <script>console.log('ignore me')</script>
      <p>矩阵可以表示线性变换。</p>
    </main>
  </body>
</html>
"""


def test_parse_url_extracts_title_and_text(monkeypatch):
    monkeypatch.setattr(parser.request, "urlopen", lambda req, timeout=30: FakeResponse(HTML))

    result = parser.parse_url("https://example.com/linear-algebra")

    assert result["title"] == "线性代数导论"
    assert result["source_url"] == "https://example.com/linear-algebra"
    assert "向量空间是线性代数的核心对象。" in result["text"]
    assert "矩阵可以表示线性变换。" in result["text"]
    assert "ignore me" not in result["text"]

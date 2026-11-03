import re
from dataclasses import dataclass
from pathlib import Path

_HEADING = re.compile(r"^(#{1,3})\s+(.+?)\s*$", re.M)


@dataclass(frozen=True)
class Chunk:
    id: str
    doc: str
    title: str
    content: str


def chunk_markdown(doc: str, text: str) -> list[Chunk]:
    """Split a markdown document into one chunk per `##`/`###` section, titled 'Doc › Section'."""
    h1 = re.search(r"^#\s+(.+)$", text, re.M)
    doc_title = h1.group(1).strip() if h1 else doc.replace("-", " ").title()

    sections: list[tuple[str, str]] = []
    matches = [m for m in _HEADING.finditer(text) if len(m.group(1)) > 1]
    intro_end = matches[0].start() if matches else len(text)
    intro = _strip_h1(text[:intro_end]).strip()
    if intro:
        sections.append((doc_title, intro))
    for i, match in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[match.end() : end].strip()
        if body:
            sections.append((f"{doc_title} › {match.group(2)}", body))

    return [
        Chunk(id=f"{doc}-{i}", doc=doc, title=title, content=body) for i, (title, body) in enumerate(sections)
    ]


def load_chunks(directory: Path) -> list[Chunk]:
    return [
        chunk
        for path in sorted(directory.glob("*.md"))
        for chunk in chunk_markdown(path.stem, path.read_text(encoding="utf-8"))
    ]


def _strip_h1(text: str) -> str:
    return re.sub(r"^#\s+.+$", "", text, count=1, flags=re.M)


def snippet(text: str, limit: int = 420) -> str:
    flat = " ".join(text.split())
    return flat if len(flat) <= limit else flat[:limit].rsplit(" ", 1)[0] + " …"

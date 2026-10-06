"""Generate profile cards from public GitHub repository metadata."""
import collections
import datetime
import html
import json
import math
import os
from pathlib import Path
import urllib.request

OWNER = "y2kbeatzz-dot"
COLORS = ["#c4a7ff", "#94e2d5", "#f5c2e7", "#89b4fa", "#f9e2af", "#fab387", "#a6e3a1"]

def get_repos():
    repos = []
    page = 1
    while True:
        headers = {"User-Agent": "Crystal-Profile-Cards", "Accept": "application/vnd.github+json"}
        token = os.environ.get("GH_TOKEN")
        if token:
            headers["Authorization"] = "Bearer " + token
        url = f"https://api.github.com/users/{OWNER}/repos?per_page=100&page={page}"
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as response:
            batch = json.load(response)
        repos.extend(r for r in batch if not r.get("private"))
        if len(batch) < 100:
            return repos
        page += 1

def svg(width, height, title, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img"><title>{html.escape(title)}</title><rect x="1" y="1" width="{width-2}" height="{height-2}" rx="18" fill="#0d1117" stroke="#30363d"/><g font-family="Arial, sans-serif">{body}</g></svg>'

def text(x, y, value, size=14, color="#c9d1d9"):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}">{html.escape(str(value))}</text>'

def main():
    repos = get_repos()
    originals = [r for r in repos if not r.get("fork")]
    languages = collections.Counter(r["language"] for r in originals if r.get("language"))
    total = sum(languages.values())
    date = datetime.datetime.now(datetime.timezone.utc).strftime("%b %d, %Y")
    height = max(260, 112 + 28 * len(languages))
    body = text(24, 36, "Languages I build with", 22, "#c4a7ff")
    body += text(24, 61, "Primary language per public, non-fork repository", 12, "#8b949e")
    circumference = 2 * math.pi * 65
    offset = 0
    body += '<circle cx="112" cy="155" r="65" fill="none" stroke="#21262d" stroke-width="25"/>'
    for i, (language, count) in enumerate(languages.most_common()):
        color = COLORS[i % len(COLORS)]
        length = circumference * count / total
        body += f'<circle cx="112" cy="155" r="65" fill="none" stroke="{color}" stroke-width="25" stroke-dasharray="{length:.4f} {circumference-length:.4f}" stroke-dashoffset="{-offset:.4f}" transform="rotate(-90 112 155)"/>'
        offset += length
        y = 107 + 28 * i
        body += f'<circle cx="230" cy="{y-5}" r="5" fill="{color}"/>'
        body += text(245, y, language)
        body += text(405, y, f"{count / total:.0%}", color="#8b949e")
    body += text(96, 157, total, 25, "#f0f6fc") + text(94, 178, "repos", 12, "#8b949e")
    body += text(24, height-18, f"Updated {date} • Public repositories only", 11, "#8b949e")
    assets = Path("assets")
    assets.mkdir(exist_ok=True)
    (assets / "language-report.svg").write_text(svg(480, height, "Public repository languages", body), encoding="utf-8")
    body = text(24, 37, "My public GitHub projects", 22, "#c4a7ff")
    stats = [("Repositories", len(repos)), ("Original projects", len(originals)), ("Stars", sum(r["stargazers_count"] for r in repos)), ("Forks received", sum(r["forks_count"] for r in repos))]
    for i, (label, value) in enumerate(stats):
        x = 24 + i * 166
        body += text(x, 92, value, 32, COLORS[i])
        body += text(x, 119, label, 13, "#8b949e")
    body += text(24, 157, f"Updated {date} • Public repositories only", 11, "#8b949e")
    (assets / "public-projects.svg").write_text(svg(700, 180, "Public GitHub project statistics", body), encoding="utf-8")
    print(json.dumps({"repositories": len(repos), "languages": dict(languages)}))

if __name__ == "__main__":
    main()

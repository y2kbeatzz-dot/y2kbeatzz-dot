"""Import verified release sources, then publish their original ZIPs on GitHub."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import tempfile
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from zipfile import ZipFile

PROJECT = Path(__file__).resolve().parent
REPO = PROJECT.parent
SPEC = json.loads((PROJECT / "release.json").read_text())
ALLOWED_HOST = "crystal-lyrics.xqv5xwnjjq.chatgpt.site"


def run(*args, **kwargs):
    return subprocess.run(args, cwd=REPO, check=True, **kwargs)


def download(item, destination):
    parsed = urlsplit(item["url"])
    if parsed.scheme != "https" or parsed.hostname != ALLOWED_HOST:
        raise ValueError("Unexpected release download host")
    if not re.fullmatch(r"[a-f0-9]{64}", item["sha256"]):
        raise ValueError("Invalid SHA-256 checksum")
    with urlopen(Request(item["url"], headers={"User-Agent": "CrystalLyrics-Release/1.0"}), timeout=120) as response:
        data = response.read(50 * 1024 * 1024 + 1)
    if len(data) > 50 * 1024 * 1024:
        raise ValueError("Archive exceeds the expected release size")
    if hashlib.sha256(data).hexdigest() != item["sha256"]:
        raise ValueError("Archive checksum mismatch; no source files were imported")
    destination.write_bytes(data)


def unpack(archive, target, prefix=""):
    with ZipFile(archive) as package:
        if sum(info.file_size for info in package.infolist()) > 100 * 1024 * 1024:
            raise ValueError("Unexpected expanded archive size")
        files = []
        for info in package.infolist():
            path = PurePosixPath(info.filename)
            if path.is_absolute() or ".." in path.parts or "\\" in info.filename:
                raise ValueError("Unsafe path in release archive")
            if ((info.external_attr >> 16) & 0o170000) == 0o120000:
                raise ValueError("Symlinks are not expected in this release")
            if info.is_dir():
                continue
            relative = path.relative_to(prefix) if prefix else path
            if not relative.parts or relative.parts[0].startswith("."):
                raise ValueError("Unexpected hidden source path")
            files.append((info, relative))
        for info, relative in files:
            out = target.joinpath(*relative.parts)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(package.read(info))


def import_sources():
    with tempfile.TemporaryDirectory(prefix="crystal-lyrics-release-") as tmp:
        tmp = Path(tmp)
        extension = tmp / "extension.zip"
        website = tmp / "website.zip"
        download(SPEC["extension"], extension)
        download(SPEC["website_source"], website)
        unpack(extension, tmp / "extension", "CrystalLyrics")
        unpack(website, tmp / "website")
        manifest = json.loads((tmp / "extension/manifest.json").read_text())
        if manifest["version"] != SPEC["version"] or manifest["manifest_version"] != 3:
            raise ValueError("Downloaded manifest does not match this release")
        for name in ("extension", "website"):
            target = PROJECT / name
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(tmp / name, target)
    print("Imported verified Crystal Lyrics extension and website source.")


def publish():
    if not re.fullmatch(r"\d+\.\d+\.\d+", SPEC["version"]):
        raise ValueError("Unexpected release version")
    if SPEC["tag"] != "crystal-lyrics-v" + SPEC["version"]:
        raise ValueError("Unexpected release tag")
    repository = os.environ.get("GITHUB_REPOSITORY")
    if repository != "y2kbeatzz-dot/y2kbeatzz-dot":
        raise ValueError("Release repository does not match the project")
    with tempfile.TemporaryDirectory(prefix="crystal-lyrics-assets-") as tmp:
        tmp = Path(tmp)
        assets = []
        checksums = []
        for key in ("extension", "website_source"):
            item = SPEC[key]
            path = tmp / item["name"]
            download(item, path)
            assets.append(str(path))
            checksums.append(item["sha256"] + "  " + item["name"])
        checksum_file = tmp / "SHA256SUMS.txt"
        checksum_file.write_text("\n".join(checksums) + "\n")
        assets.append(str(checksum_file))
        notes = tmp / "release-notes.md"
        notes.write_text(
            "Free synced lyrics for desktop YouTube and YouTube Music, made by Crystal.\n\n"
            "Download **CrystalLyrics-v1.4.0.zip**, extract it, enable Developer mode at "
            "chrome://extensions or edge://extensions, and Load unpacked the inner CrystalLyrics folder.\n\n"
            "[Website and install guide](" + SPEC["website"] + ") · "
            "[Full extension source](https://github.com/y2kbeatzz-dot/y2kbeatzz-dot/tree/main/CrystalLyrics/extension)\n\n"
            "Includes word effects, steady glow, fonts, transparent boxes, optional cover/video colors and local audio timing. "
            "Estimated words are labeled; perfect sync is not guaranteed. Chrome / Edge 116+ required.\n\n"
            "The extension archive is unchanged from the original v1.4 Windows Fixed package. "
            "Check SHA256SUMS.txt for integrity. Live browser/playback testing was unavailable during publication.\n"
        )
        exists = subprocess.run(["gh", "release", "view", SPEC["tag"], "--repo", repository],
                                cwd=REPO, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
        if exists:
            run("gh", "release", "upload", SPEC["tag"], *assets, "--clobber", "--repo", repository)
        else:
            sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip()
            run("gh", "release", "create", SPEC["tag"], *assets, "--repo", repository,
                "--target", sha, "--title", "Crystal Lyrics " + SPEC["version"], "--notes-file", str(notes))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["import", "publish"])
    args = parser.parse_args()
    import_sources() if args.command == "import" else publish()

#!/usr/bin/env python3
"""Download a thumbnail image for every item in data/items.json.

Images are saved to assets/img/<buildId>/<itemId>.<ext> and listed in
data/images.json. Items that already have an image are skipped, so the
script can be re-run after adding items or builds.

Sources, in order:
  1. Elder Scrolls Wiki (Fandom) search, only when a result title matches
     the item's English name (or its UESP title).
  2. UESP page image of the item's wikiTitle.
  3. The first Fandom search result that has an image (least reliable).

Manual overrides live in scripts/image_overrides.json:
  { "<buildId>": { "<itemId>": { "skip": true } } }            never fetch, use the emoji
  { "<buildId>": { "<itemId>": { "uespFile": "File:X.jpg" } } } use this UESP file
  { "<buildId>": { "<itemId>": { "fandomFile": "File:X.png" } } } use this Fandom file
  { "<buildId>": { "<itemId>": { "uespPage": "Skyrim:Page" } } } page image of another UESP page

Thumbnails are requested at 256px from the wiki APIs, so no local resizing
is needed. Python standard library only.

Usage:
  python3 scripts/fetch_images.py            # fetch missing images
  python3 scripts/fetch_images.py --force ID # re-fetch one item (any build)
  python3 scripts/fetch_images.py --dry-run  # show what would be fetched
"""

import argparse
import functools
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ITEMS_PATH = os.path.join(ROOT, "data", "items.json")
IMAGES_PATH = os.path.join(ROOT, "data", "images.json")
OVERRIDES_PATH = os.path.join(ROOT, "scripts", "image_overrides.json")
IMG_DIR = os.path.join(ROOT, "assets", "img")

FANDOM_API = "https://elderscrolls.fandom.com/api.php"
FANDOM_WIKI = "https://elderscrolls.fandom.com/wiki/"
UESP_API = "https://en.uesp.net/w/api.php"
UESP_WIKI = "https://en.uesp.net/wiki/"
THUMB = 256
USER_AGENT = "arrow-to-the-knee/1.0 (personal Skyrim checklist; image fetcher)"
EXT_BY_TYPE = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
}


def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def http_get(url, accept="application/json"):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.read(), res.headers.get("Content-Type", "")


def api(base, **params):
    params.setdefault("format", "json")
    params.setdefault("formatversion", "2")
    body, _ = http_get(base + "?" + urllib.parse.urlencode(params))
    time.sleep(0.3)  # be polite to the wikis
    return json.loads(body)


def norm(s):
    s = (s or "").lower()
    s = re.sub(r"^skyrim:", "", s)
    s = re.sub(r"\((skyrim|dawnguard|dragonborn)\)", "", s)
    s = re.sub(r"^the ", "", s.strip())
    return re.sub(r"[^a-z0-9]+", "", s)


def page_url(wiki, title):
    return wiki + urllib.parse.quote(title.replace(" ", "_"), safe=":/()")


@functools.lru_cache(maxsize=None)
def fandom_search(query):
    data = api(
        FANDOM_API,
        action="query",
        generator="search",
        gsrsearch=query,
        gsrlimit=5,
        prop="pageimages",
        piprop="thumbnail",
        pithumbsize=THUMB,
    )
    pages = (data.get("query") or {}).get("pages") or []
    return sorted(pages, key=lambda p: p.get("index", 99))


def fandom_candidates(item):
    """Yield (thumb_url, page_url, kind) from Fandom search results."""
    wanted = {norm(item.get("nameEn")), norm(item.get("wikiTitle"))}
    wanted.discard("")
    pages = fandom_search(item.get("imageQuery") or item.get("nameEn"))
    exact = [p for p in pages if norm(p.get("title")) in wanted and p.get("thumbnail")]
    for p in exact:
        yield p["thumbnail"]["source"], page_url(FANDOM_WIKI, p["title"]), "fandom-exact"


def fandom_first(item):
    pages = fandom_search(item.get("imageQuery") or item.get("nameEn"))
    for p in pages:
        if p.get("thumbnail"):
            return p["thumbnail"]["source"], page_url(FANDOM_WIKI, p["title"]), "fandom-search"
    return None


def uesp_page_image(title):
    data = api(UESP_API, action="query", titles=title, redirects=1, prop="pageimages", piprop="thumbnail", pithumbsize=THUMB)
    for p in (data.get("query") or {}).get("pages") or []:
        if p.get("thumbnail"):
            return p["thumbnail"]["source"], page_url(UESP_WIKI, p["title"]), "uesp-page"
    return None


def file_thumb(base, wiki, file_title):
    data = api(base, action="query", titles=file_title, prop="imageinfo", iiprop="url", iiurlwidth=THUMB)
    for p in (data.get("query") or {}).get("pages") or []:
        info = (p.get("imageinfo") or [None])[0]
        if info:
            return info.get("thumburl") or info["url"], info.get("descriptionurl") or page_url(wiki, p["title"]), "file"
    return None


def find_image(item, override):
    if override.get("uespFile"):
        return file_thumb(UESP_API, UESP_WIKI, override["uespFile"])
    if override.get("fandomFile"):
        return file_thumb(FANDOM_API, FANDOM_WIKI, override["fandomFile"])
    if override.get("uespPage"):
        return uesp_page_image(override["uespPage"])
    for cand in fandom_candidates(item):
        return cand
    if item.get("wikiTitle"):
        found = uesp_page_image(item["wikiTitle"])
        if found:
            return found
    return fandom_first(item)


def existing_file(build_id, item_id):
    folder = os.path.join(IMG_DIR, build_id)
    if not os.path.isdir(folder):
        return None
    for name in os.listdir(folder):
        if os.path.splitext(name)[0] == item_id:
            return name
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="append", default=[], metavar="ITEM_ID", help="re-fetch this item")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    data = load_json(ITEMS_PATH, None)
    if not data:
        sys.exit("data/items.json not found")
    images = load_json(IMAGES_PATH, {})
    overrides = load_json(OVERRIDES_PATH, {})

    fetched, skipped, missing = [], 0, []
    for build in data.get("builds", []):
        bid = build["id"]
        build_images = images.setdefault(bid, {})
        build_overrides = overrides.get(bid, {})
        for item in build.get("items", []):
            iid = item["id"]
            override = build_overrides.get(iid, {})
            forced = iid in args.force

            if override.get("skip"):
                if build_images.pop(iid, None) is not None and not args.dry_run:
                    old = existing_file(bid, iid)
                    if old:
                        os.remove(os.path.join(IMG_DIR, bid, old))
                missing.append(f"{bid}/{iid} (skip)")
                continue

            current = existing_file(bid, iid)
            if current and not forced:
                if iid not in build_images:
                    build_images[iid] = {"file": f"assets/img/{bid}/{current}", "source": ""}
                skipped += 1
                continue

            try:
                found = find_image(item, override)
            except Exception as e:  # network or API error: try again next run
                print(f"  ! {bid}/{iid}: {e}")
                missing.append(f"{bid}/{iid} (error)")
                continue
            if not found:
                print(f"  - {bid}/{iid}: no image found")
                missing.append(f"{bid}/{iid}")
                continue

            thumb_url, source, kind = found
            print(f"  + {bid}/{iid} [{kind}] {thumb_url}")
            if args.dry_run:
                continue
            body, ctype = http_get(thumb_url, accept="image/png,image/jpeg,image/*;q=0.8")
            ext = EXT_BY_TYPE.get(ctype.split(";")[0].strip().lower())
            if not ext:
                print(f"  ! {bid}/{iid}: unexpected content type {ctype!r}")
                missing.append(f"{bid}/{iid} (bad type)")
                continue
            os.makedirs(os.path.join(IMG_DIR, bid), exist_ok=True)
            if current:
                os.remove(os.path.join(IMG_DIR, bid, current))
            filename = f"{iid}.{ext}"
            with open(os.path.join(IMG_DIR, bid, filename), "wb") as f:
                f.write(body)
            build_images[iid] = {"file": f"assets/img/{bid}/{filename}", "source": source}
            fetched.append(f"{bid}/{iid}")

        # Drop entries for items that no longer exist in this build.
        ids = {i["id"] for i in build.get("items", [])}
        for iid in list(build_images):
            if iid not in ids:
                del build_images[iid]

    if not args.dry_run:
        save_json(IMAGES_PATH, images)
    print(f"\nfetched {len(fetched)}, already had {skipped}, without image {len(missing)}")
    for m in missing:
        print(f"  no image: {m}")


if __name__ == "__main__":
    main()

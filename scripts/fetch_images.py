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

The script also downloads an in-game map screenshot for every location in
data/locations.json that an item uses. They come from the location's Fandom
page (the page image whose name mentions "map"), are saved to
assets/img/locations/<locationId>.<ext> at 640px and listed in
data/location-images.json. Per-location overrides go in data/locations.json:
  "fandomPage": "Page"     look for the screenshot on this Fandom page
  "fandomFile": "File:X"   use this Fandom file
  "noScreenshot": true     never fetch, show only the pin on the map

Usage:
  python3 scripts/fetch_images.py            # fetch missing images
  python3 scripts/fetch_images.py --force ID # re-fetch one item or location (any build)
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
LOCATIONS_PATH = os.path.join(ROOT, "data", "locations.json")
LOCATION_IMAGES_PATH = os.path.join(ROOT, "data", "location-images.json")
IMG_DIR = os.path.join(ROOT, "assets", "img")
LOCATION_IMG_DIR = os.path.join(IMG_DIR, "locations")

FANDOM_API = "https://elderscrolls.fandom.com/api.php"
FANDOM_WIKI = "https://elderscrolls.fandom.com/wiki/"
UESP_API = "https://en.uesp.net/w/api.php"
UESP_WIKI = "https://en.uesp.net/wiki/"
THUMB = 256
SCREENSHOT = 640
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


def file_thumb(base, wiki, file_title, width=THUMB):
    data = api(base, action="query", titles=file_title, prop="imageinfo", iiprop="url", iiurlwidth=width)
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


def map_file_score(file_title, loc_name):
    """How likely a Fandom file is the world-map screenshot of this location."""
    t = file_title.lower()
    if "map" not in t:
        return None
    # Interior maps and maps from the other games share the location names.
    if re.search(r"local|interior|online|\beso\b|oblivion|morrowind|treasure", t):
        return None
    score = 0
    if "world map" in t or "map location" in t or "maplocation" in t:
        score += 2
    if norm(loc_name) and norm(loc_name) in norm(file_title):
        score += 1
    return score


def find_screenshot(loc):
    if loc.get("fandomFile"):
        return file_thumb(FANDOM_API, FANDOM_WIKI, loc["fandomFile"], SCREENSHOT)
    # Many places share a name with other games, so the Skyrim page has a suffix.
    titles = [loc["fandomPage"]] if loc.get("fandomPage") else [loc["nameEn"], loc["nameEn"] + " (Skyrim)"]
    for title in titles:
        data = api(FANDOM_API, action="query", titles=title, redirects=1, prop="images", imlimit=100)
        files = []
        for p in (data.get("query") or {}).get("pages") or []:
            files += [i["title"] for i in p.get("images") or []]
        scored = [(map_file_score(f, loc["nameEn"]), f) for f in files]
        scored = [(s, f) for s, f in scored if s is not None]
        if scored:
            best = max(scored, key=lambda x: x[0])[1]
            return file_thumb(FANDOM_API, FANDOM_WIKI, best, SCREENSHOT)
    return None


def existing_file(build_id, item_id, img_dir=IMG_DIR):
    folder = os.path.join(img_dir, build_id) if build_id else img_dir
    if not os.path.isdir(folder):
        return None
    for name in os.listdir(folder):
        if os.path.splitext(name)[0] == item_id:
            return name
    return None


def download(thumb_url):
    """Return (body, ext), or (None, content type) when it is not an image."""
    body, ctype = http_get(thumb_url, accept="image/png,image/jpeg,image/*;q=0.8")
    ext = EXT_BY_TYPE.get(ctype.split(";")[0].strip().lower())
    return (body, ext) if ext else (None, ctype)


def fetch_screenshots(data, forced, dry_run):
    """Map screenshots for every location used by an item. Returns names without one."""
    locations = load_json(LOCATIONS_PATH, {}).get("locations", {})
    shots = load_json(LOCATION_IMAGES_PATH, {})
    used = []
    for build in data.get("builds", []):
        for item in build.get("items", []):
            for lid in item.get("locations") or []:
                if lid not in locations:
                    print(f"  ! {build['id']}/{item['id']}: unknown location {lid!r}")
                elif lid not in used:
                    used.append(lid)

    fetched, missing = 0, []
    for lid in used:
        loc = locations[lid]
        current = existing_file(None, lid, LOCATION_IMG_DIR)
        if loc.get("noScreenshot"):
            if shots.pop(lid, None) is not None and current and not dry_run:
                os.remove(os.path.join(LOCATION_IMG_DIR, current))
            continue
        if current and lid not in forced:
            shots.setdefault(lid, {"file": f"assets/img/locations/{current}", "source": ""})
            continue
        try:
            found = find_screenshot(loc)
        except Exception as e:  # network or API error: try again next run
            print(f"  ! location {lid}: {e}")
            missing.append(f"{lid} (error)")
            continue
        if not found:
            print(f"  - location {lid}: no map screenshot found")
            missing.append(lid)
            continue
        thumb_url, source, _ = found
        print(f"  + location {lid} {thumb_url}")
        if dry_run:
            continue
        body, ext = download(thumb_url)
        if body is None:
            print(f"  ! location {lid}: unexpected content type {ext!r}")
            missing.append(f"{lid} (bad type)")
            continue
        os.makedirs(LOCATION_IMG_DIR, exist_ok=True)
        if current:
            os.remove(os.path.join(LOCATION_IMG_DIR, current))
        filename = f"{lid}.{ext}"
        with open(os.path.join(LOCATION_IMG_DIR, filename), "wb") as f:
            f.write(body)
        shots[lid] = {"file": f"assets/img/locations/{filename}", "source": source}
        fetched += 1

    # Drop entries for locations no item uses any more.
    for lid in list(shots):
        if lid not in used:
            del shots[lid]
    if not dry_run:
        save_json(LOCATION_IMAGES_PATH, dict(sorted(shots.items())))
    print(f"\nmap screenshots: fetched {fetched}, without screenshot {len(missing)}")
    return missing


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="append", default=[], metavar="ID", help="re-fetch this item or location")
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
            body, ext = download(thumb_url)
            if body is None:
                print(f"  ! {bid}/{iid}: unexpected content type {ext!r}")
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

    for m in fetch_screenshots(data, set(args.force), args.dry_run):
        print(f"  no map screenshot: {m}")


if __name__ == "__main__":
    main()

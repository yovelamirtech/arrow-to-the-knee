# Arrow in the Knee — build instructions for Claude Code

You are building a small personal web tool and publishing it on GitHub Pages. Everything you need, including the full content, is in this file. Read it all before starting.

## What it is

**Name: Arrow in the Knee** (in English, exactly like that). Use it as the page `<title>`, the header title and the repo name.

A personal checklist for a Skyrim (Special Edition, no mods) playthrough. The first build is a two-handed warhammer warrior in heavy armor. The site lists things worth getting (weapons, shouts, spells, permanent bonuses, perks, followers and so on), split into categories. Each item has a small image; tapping it opens details on what it is, why it matters for the build and how to get it. The user can tick an item with a V, and it moves to an archive.

**The site UI and all content must be in Hebrew, right-to-left**, except the site name, which stays in English. These instructions are in English; the content in the data block at the bottom is already written in Hebrew. Use it as-is.

This is for personal use only. No logo, no hero section, no decorative graphics or branding. A clean, simple, functional UI. The item images (below) are the only images.

## Multiple builds (classes), designed in from the start

Right now there is one build. Later the user will ask an AI to add trackers for other builds (for example an archer or a mage). Structure everything so that adding a build is just adding one more entry to the data file, with no code changes:

- `data/items.json` has a top-level `builds` array. Each build has its own `id`, `nameHe`, `nameEn`, `categories`, `items` and `tips`. Item ids only need to be unique within their build.
- **With a single build, the site opens straight into it and shows no build switcher at all.** No extra screen, no extra tap.
- With two or more builds, show a small, compact switcher in the header (for example a select or a small menu next to the title). The site remembers the last active build and opens straight into it next time. Never add a "choose your class" landing screen.
- Progress is stored per build. Ticking an item in one build never affects another build, even if they share an item id.
- The header progress indicator, tabs, search, archive and tips all refer to the active build only.

## Tech constraints

- Plain static site: `index.html`, `styles.css`, `app.js`, `data/items.json`, `assets/img/`. No framework, no build step, no npm runtime dependencies. It must work when served from a GitHub Pages sub-path (`https://<user>.github.io/<repo>/`), so use relative paths only.
- `<html lang="he" dir="rtl">`. Load a Hebrew-friendly web font from Google Fonts (for example Heebo or Rubik, with a more decorative font for headings if you like), with system fallbacks.
- Mobile-first. The main device is an iPhone (about 390px wide), but it must also look good on iPad and desktop. No horizontal scrolling on the page.
- Persistence: `localStorage`, key `arrow-in-the-knee-v1`, storing `{ "activeBuild": "<buildId>", "builds": { "<buildId>": { "done": { "<itemId>": "<ISO timestamp>" }, "tab": "<last tab>" } } }`. Wrap every read and write in try/catch so the page still works if storage is unavailable. Done-state is keyed by build id and item id, so editing the data file later must not lose progress. If the stored active build no longer exists, fall back to the first build.
- No sync between devices, no export or import, no in-site form for adding items or builds. New items and builds will be added later by editing `data/items.json` through Claude Code.

## Screens and behavior

**Header.** The title "Arrow in the Knee" (wrapped so it renders correctly inside the RTL page), the active build's Hebrew name as a small subtitle, the build switcher only when there are two or more builds, and a progress indicator for the active build (done out of total).

**Category tabs.** A horizontally scrollable row of chips, built from the active build's `categories`, in that order, each with its remaining-count. After the categories, two extra tabs: **ארכיון** (archive) and **טיפים** (tips). Remember the last selected tab in localStorage.

**Search.** A search field that filters across all categories by Hebrew or English name.

**Item card (list view).**
- Small image on the side (about 56–64px, rounded corners). If there is no image, show the category's emoji in a styled tile instead.
- Hebrew name as the main title.
- English name on **its own separate line** below it, smaller, muted, with `dir="ltr"`. The user explicitly wants Hebrew and English visually separated; never put the English name inline next to the Hebrew one.
- The one-line `summary`.
- A priority badge: `high` → עדיפות גבוהה, `medium` → בינונית, `low` → נמוכה, with distinct but calm colors.
- If `minLevel` is set: a badge "מרמה X".
- A clear, large tap-target checkbox for V. Ticking it should not open the details.
- Sort within a category by priority (high, medium, low), then by `minLevel` (none first), then keep data order.

**Details view.** Tapping a card opens a bottom sheet on mobile (a centered dialog on wide screens) with:
- Larger image, Hebrew name, English name on its own line.
- Sections with Hebrew headings: **מה זה** (`summary`), **למה זה טוב לבילד** (`why`), **איך משיגים** (`howToGet`, as a numbered list), **הערות** (`notes`, as a bullet list; hide the section if empty).
- A link: "לקריאה נוספת ב-UESP" → `https://en.uesp.net/wiki/` + `wikiTitle` with spaces replaced by underscores (URL-encode apostrophes and other special characters). Open in a new tab.
- The same V toggle as on the card, and a close button. Closes on backdrop tap, on Escape, and with the back gesture on mobile if you can do it simply (history state).

**Ticking V.** The item animates out of its category list and moves to the archive. Show a toast "הועבר לארכיון" with a **ביטול** (undo) button for about 5 seconds.

**Archive tab.** Done items grouped by category, newest first, each showing the date it was marked. Each item can be restored (un-ticked) and its details can still be opened.

**Tips tab.** The `tips` array as a simple, readable list. Not checkable.

**Mixed-direction text.** The Hebrew content includes English names inline (for example place names). To avoid bidi glitches with punctuation, wrap runs of Latin text inside Hebrew paragraphs in `<bdi>` when rendering (a small regex over the text is fine). Escape all text before inserting it into the DOM.

**Visual style.** Simple and functional. Dark theme by default: dark slate background, one muted gold accent color, subtle borders. No textures, no decorative graphics. Support `prefers-color-scheme: light` with a plain light theme. Good contrast, visible focus states, respects `prefers-reduced-motion`.

**Footer.** A short credit line: images and information from UESP and the Elder Scrolls Wiki (Fandom); The Elder Scrolls V: Skyrim is © Bethesda. Write it in Hebrew.

## Images

The user wants real images where possible, and the category emoji only as a last resort.

1. Write a reusable script `scripts/fetch_images.py` (Python standard library only) that, for each item in every build, tries to find a fitting image and **downloads it into the repo** at `assets/img/<buildId>/<itemId>.<ext>`. It should skip items that already have an image, so it can be re-run after new items or builds are added. Do not hotlink images from wikis at runtime.
2. Suggested sources, in order:
   - Elder Scrolls Wiki (Fandom) API: `https://elderscrolls.fandom.com/api.php?action=query&generator=search&gsrsearch=<imageQuery>&gsrlimit=5&prop=pageimages&piprop=thumbnail&pithumbsize=256&format=json`. Prefer a result whose title matches the item's English name.
   - UESP: `https://en.uesp.net/w/api.php` with the item's `wikiTitle` (for example `prop=pageimages`, or `prop=images` and then `imageinfo` for an icon or item image file).
   - Any other reasonable approach you find that works.
3. Write the results to `data/images.json` as `{ "<buildId>": { "<itemId>": { "file": "assets/img/<buildId>/<itemId>.png", "source": "<page URL>" } } }`. The app reads this file and falls back to the emoji tile for items that have no entry.
4. **Look at the downloaded images yourself** before committing. A wrong image is worse than no image: if an image clearly does not show the item (a random screenshot, a different weapon, an unrelated character), delete it and use the fallback. For perks, standing stones and abstract bonuses, a fitting related image (the stone itself, the quest location) is fine; otherwise use the fallback.
5. Resize large images down to about 256px on the long side before committing, to keep the repo small.
6. Report in your final message how many items got images and which ones fell back to the emoji.

## Deployment

1. Create a new **public** GitHub repository named `arrow-in-the-knee` (if the name is taken, pick a close variant), using the `gh` CLI.
2. Commit everything, including the downloaded images, a `.nojekyll` file and a `README.md` in Hebrew. The README explains the site, the data schema (build and item), and has a short section "איך מוסיפים קלאס חדש" with a ready-to-copy prompt the user can give an AI, along the lines of: "add a new build to `data/items.json` for <class>, with categories, items and tips in Hebrew in the same schema and style as the existing build, then run `scripts/fetch_images.py`, check the new images, commit and push". Also a one-line note on adding a single item to an existing build.
3. Enable GitHub Pages from the `main` branch root (for example `gh api -X POST repos/<owner>/<repo>/pages -f "source[branch]=main" -f "source[path]=/"`).
4. Wait for the deploy, open the live URL, and confirm it loads with no console errors.

## Before you finish, test

- Serve locally and check at a 390px-wide viewport and a desktop width: RTL layout, tabs scroll, cards and details sheet look right, English names on their own lines.
- Tick an item, reload: it is still in the archive. Undo works. Restore from the archive works.
- With one build, no switcher is visible. Then temporarily add a small dummy second build to a local copy of the data and check: the switcher appears, switching works, progress stays separate per build, and after a reload the site opens on the last active build. Remove the dummy build before committing.
- Search finds items by Hebrew and by English name.
- No console errors. All links in the details view open the right UESP page (spot-check a few, including titles with apostrophes such as `Champion's Stance` and `Sailor's Repose`).
- Final message: the live URL, the repo URL, and the image report.

## Rules for the content

- Use the data below exactly as written. Do not rewrite, shorten or "improve" the Hebrew text.
- If you notice something in the data that looks factually wrong, do not change it silently. Leave it as-is and list it in your final message.
- Keep the data schema stable so builds and items can be added later. Build: `id`, `nameHe`, `nameEn`, `categories` (array of `id`, `nameHe`, `icon`), `items`, `tips`. Item: `id`, `category`, `nameHe`, `nameEn`, `priority` (`high` | `medium` | `low`), `minLevel` (number or null), `summary`, `why`, `howToGet` (array), `notes` (array), `wikiTitle`, `imageQuery`.

## The data — save this exactly as `data/items.json`

```json
{
  "builds": [
    {
      "id": "two-handed-warhammer",
      "nameHe": "לוחם פטיש דו-ידני",
      "nameEn": "Two-handed Warhammer",
      "categories": [
        {
          "id": "weapons",
          "nameHe": "נשקים",
          "icon": "🔨"
        },
        {
          "id": "armor",
          "nameHe": "שריון וציוד",
          "icon": "🛡️"
        },
        {
          "id": "shouts",
          "nameHe": "שאגות",
          "icon": "🐉"
        },
        {
          "id": "spells",
          "nameHe": "לחשים",
          "icon": "✨"
        },
        {
          "id": "passives",
          "nameHe": "בונוסים קבועים",
          "icon": "⭐"
        },
        {
          "id": "stones",
          "nameHe": "אבני מזל",
          "icon": "🪨"
        },
        {
          "id": "perks",
          "nameHe": "פרקים",
          "icon": "📈"
        },
        {
          "id": "followers",
          "nameHe": "מלווים ובית",
          "icon": "🏠"
        },
        {
          "id": "quests",
          "nameHe": "משימות ומאמנים",
          "icon": "📜"
        }
      ],
      "items": [
        {
          "id": "longhammer",
          "category": "weapons",
          "nameHe": "הפטיש הארוך",
          "nameEn": "The Longhammer",
          "priority": "high",
          "minLevel": null,
          "summary": "פטיש דו-ידני ייחודי שמונף מהר בשליש מכל פטיש אחר.",
          "why": "פותר את בעיית האיטיות של הפטיש. הנזק לכל מכה נמוך יותר מפטיש דאדרי, אבל בגלל המהירות, הנזק הכולל לאורך זמן גבוה יותר. Skullcrusher עובד עליו כי הוא פטיש. הוא לא מכושף, ולכן השאגה Elemental Fury עובדת עליו.",
          "howToGet": [
            "ללכת למערה Liar's Retreat, דרום-מערבית לעיר סוליטיוד.",
            "הפטיש מונח ליד הגופה של שודד בשם Rahd.",
            "במערה יש אויבים מסוג פאלמר, כדאי להגיע מוכן."
          ],
          "notes": [
            "באג ידוע: לפעמים הפטיש נופל מתחת לשולחן ולא ליד הגופה.",
            "נזק בסיס 21, מהירות 0.8 (פטיש רגיל: 0.6).",
            "משדרגים עם מטיל אוריכלקום. הפרק Orcish Smithing מכפיל את השדרוג.",
            "אם תכשף אותו בעצמך, Elemental Fury תפסיק לעבוד עליו."
          ],
          "wikiTitle": "Skyrim:The Longhammer",
          "imageQuery": "The Longhammer Skyrim"
        },
        {
          "id": "volendrung",
          "category": "weapons",
          "nameHe": "וולנדרונג",
          "nameEn": "Volendrung",
          "priority": "medium",
          "minLevel": 9,
          "summary": "פטיש ארטיפקט שגונב סטמינה מהאויב בכל מכה.",
          "why": "מאפשר הרבה מכות כוח ברצף בלי שהסטמינה תיגמר. השני הכי מהיר מבין הפטישים, אחרי הפטיש הארוך.",
          "howToGet": [
            "להגיע למחנה האורקים Largashbur בדרום-מזרח המפה (מרמה 9 ומעלה).",
            "לעזור לאורקים להדוף ענק שתוקף את המחנה.",
            "להשלים את המשימה The Cursed Tribe עבור הישות הדאדרית Malacath. חלק מהפריטים הנדרשים נאספים במהלך המשימה."
          ],
          "notes": [
            "הוא מכושף, ולכן Elemental Fury לא עובדת עליו.",
            "נזק בסיס 25, מהירות 0.7.",
            "משדרגים עם מטיל אבוני. אי אפשר לפרק את הקסם שלו."
          ],
          "wikiTitle": "Skyrim:Volendrung",
          "imageQuery": "Volendrung Skyrim"
        },
        {
          "id": "trollsbane",
          "category": "weapons",
          "nameHe": "קוטל הטרולים",
          "nameEn": "Trollsbane",
          "priority": "low",
          "minLevel": null,
          "summary": "פטיש ייחודי מוקדם שמוסיף נזק אש נגד טרולים בלבד.",
          "why": "טרולים מחדשים חיים מהר וחלשים לאש. פטיש גיבוי טוב לקרבות מול טרולים, כמו טרול הקור במדרגות.",
          "howToGet": [
            "באזור The Reach, במאורת טרולים בין Cradle Stone Tower לבין Valthume.",
            "הפטיש נמצא על הגופה של Frofnir Trollsbane. יש טרולים באזור."
          ],
          "notes": [
            "15 נקודות נזק אש, רק נגד טרולים. נגד כל השאר זה פטיש רגיל עם נזק בסיס 20.",
            "האש מקשה על ההתחדשות של הטרול אבל לא עוצרת אותה לגמרי."
          ],
          "wikiTitle": "Skyrim:Trollsbane",
          "imageQuery": "Trollsbane Skyrim warhammer"
        },
        {
          "id": "daedric-warhammer",
          "category": "weapons",
          "nameHe": "פטיש דאדרי",
          "nameEn": "Daedric Warhammer",
          "priority": "medium",
          "minLevel": null,
          "summary": "הפטיש עם הנזק הבסיסי הגבוה ביותר במשחק בלי הרחבות (27).",
          "why": "יעד לשלב מאוחר, אם לא הולכים על הפטיש הדרקוני.",
          "howToGet": [
            "לייצר בנפחייה עם נפחות 90 והפרק Daedric Smithing.",
            "או למצוא או לקנות ברמות דמות גבוהות."
          ],
          "notes": [
            "משדרגים עם מטיל אבוני."
          ],
          "wikiTitle": "Skyrim:Daedric Warhammer",
          "imageQuery": "Daedric Warhammer Skyrim"
        },
        {
          "id": "dragonbone-warhammer",
          "category": "weapons",
          "nameHe": "פטיש עצם דרקון",
          "nameEn": "Dragonbone Warhammer",
          "priority": "high",
          "minLevel": null,
          "summary": "הנשק הדו-ידני החזק ביותר במשחק (נזק בסיס 28).",
          "why": "היעד הסופי של הבילד.",
          "howToGet": [
            "להגיע לנפחות 100 ולקחת את הפרק Dragon Armor.",
            "לייצר בנפחייה: 3 עצמות דרקון, 2 מטילי אבוני, 3 רצועות עור."
          ],
          "notes": [
            "שדרוג: עצם דרקון אחת.",
            "שייך להרחבה Dawnguard, שכלולה ב-Special Edition.",
            "חרב ענק דרקונית לשם השוואה: 4 עצמות, מטיל אבוני אחד, 3 רצועות עור."
          ],
          "wikiTitle": "Skyrim:Dragonbone Warhammer",
          "imageQuery": "Dragonbone Warhammer Skyrim"
        },
        {
          "id": "ebony-mail",
          "category": "armor",
          "nameHe": "שריון האבוני של בוטיה",
          "nameEn": "Ebony Mail",
          "priority": "medium",
          "minLevel": 30,
          "summary": "שריון גוף כבד ייחודי שמרעיל אויבים שעומדים קרוב אליך.",
          "why": "5 נקודות נזק רעל בשנייה לכל אויב בטווח קרוב, מושלם ללוחם קרב קרוב. בנוסף, מבטל את רעש השריון כשמתגנבים.",
          "howToGet": [
            "מרמה 30: לקרוא את הספר Boethiah's Proving, או ללכת ישירות למקדש Sacellum of Boethiah.",
            "להשלים את המשימה Boethiah's Calling."
          ],
          "notes": [
            "המשימה דורשת להקריב מלווה. אל תביא את המלווה הקבוע שלך.",
            "ההשתקה פועלת רק במצב התגנבות.",
            "בתגרת אגרופים הרעל ייחשב לרמאות ויהפוך את כולם לעוינים."
          ],
          "wikiTitle": "Skyrim:Ebony Mail",
          "imageQuery": "Ebony Mail Skyrim"
        },
        {
          "id": "dragonplate-set",
          "category": "armor",
          "nameHe": "סט שריון דרקוני כבד",
          "nameEn": "Dragonplate Armor",
          "priority": "high",
          "minLevel": null,
          "summary": "השריון הכבד השני בטיבו במשחק, קל יותר מהדאדרי.",
          "why": "כמעט כמו דאדרי, קל יותר, והחומרים שלו זמינים יותר.",
          "howToGet": [
            "להגיע לנפחות 100 ולקחת את הפרק Dragon Armor (דורש את כל הפרקים באחד מענפי השריון).",
            "שריון גוף: 3 קשקשים, 2 עצמות, 3 רצועות עור.",
            "מגפיים: 3 קשקשים, עצם אחת, 2 רצועות עור.",
            "כפפות: 2 קשקשים, עצם אחת, 2 רצועות עור.",
            "קסדה: 2 קשקשים, עצם אחת, 2 רצועות עור."
          ],
          "notes": [
            "סך הכל לסט בלי מגן: 10 קשקשים ו-5 עצמות.",
            "שדרוג: עצם אחת לשריון הגוף, קשקש אחד לכל אחד מהאחרים.",
            "עם הפטיש הדרקוני ושדרוג הכול: בערך 13 קשקשים ו-10 עצמות."
          ],
          "wikiTitle": "Skyrim:Dragonplate Armor",
          "imageQuery": "Dragonplate Armor Skyrim"
        },
        {
          "id": "dragon-materials",
          "category": "armor",
          "nameHe": "לאסוף חומרים דרקוניים",
          "nameEn": "Dragon Bones & Dragon Scales",
          "priority": "medium",
          "minLevel": null,
          "summary": "לאסוף בערך 13 קשקשים ו-10 עצמות דרקון, ולא למכור.",
          "why": "אלה החומרים לסט הדרקוני ולפטיש הדרקוני. כל דרקון נותן רק כמה.",
          "howToGet": [
            "לבזוז כל דרקון שהורגים.",
            "לאחסן בתיבה בבית שלך, לא בתיבות בעולם שמתרוקנות עם הזמן."
          ],
          "notes": [
            "הם כבדים, אז לא לסחוב אותם סתם."
          ],
          "wikiTitle": "Skyrim:Dragon Bone",
          "imageQuery": "Dragon Bone Skyrim"
        },
        {
          "id": "gauldur-amulet",
          "category": "armor",
          "nameHe": "קמע גאולדור",
          "nameEn": "The Gauldur Amulet",
          "priority": "medium",
          "minLevel": null,
          "summary": "שרשרת שמוסיפה 30 חיים, 30 מאנה ו-30 סטמינה.",
          "why": "בונוס כללי טוב לכל בילד, ומשלים את חלוקת החיים והסטמינה.",
          "howToGet": [
            "להתחיל את המשימה Forbidden Legend (בדרך כלל מספר או מהמקום Folgunthur).",
            "לאסוף את שלושת החלקים: ב-Folgunthur, ב-Saarthal וב-Geirmund's Hall.",
            "לחבר את הקמע מחדש במקום Reachwater Rock."
          ],
          "notes": [
            "החלק שב-Saarthal מושג במהלך משימת הקולג' של המכשפים בוינטרהולד.",
            "אי אפשר לפרק את הקסם שלו."
          ],
          "wikiTitle": "Skyrim:The Gauldur Amulet",
          "imageQuery": "Gauldur Amulet Skyrim"
        },
        {
          "id": "fortify-twohanded-gear",
          "category": "armor",
          "nameHe": "ציוד מכושף לנזק דו-ידני",
          "nameEn": "Fortify Two-handed (gloves, ring, necklace)",
          "priority": "high",
          "minLevel": null,
          "summary": "כפפות, טבעת ושרשרת עם קסם שמגביר נזק דו-ידני.",
          "why": "אחד הבונוסים הכי גדולים לנזק בבילד.",
          "howToGet": [
            "למצוא פריט קסום כלשהו עם הקסם Fortify Two-handed ולפרק אותו על שולחן כישוף.",
            "לכשף את הקסם על כפפות, טבעת ושרשרת."
          ],
          "notes": [
            "הפרקים Enchanter ו-Insightful Enchanter מחזקים את הקסם הזה."
          ],
          "wikiTitle": "Skyrim:Fortify Two-handed",
          "imageQuery": "Skyrim enchanted gauntlets"
        },
        {
          "id": "fortify-smithing-gear",
          "category": "armor",
          "nameHe": "ציוד מכושף לנפחות",
          "nameEn": "Fortify Smithing gear",
          "priority": "medium",
          "minLevel": null,
          "summary": "סט פריטים שלובשים רק כשמשדרגים ציוד.",
          "why": "שדרוג חזק יותר לפטיש ולשריון.",
          "howToGet": [
            "לפרק פריט עם הקסם Fortify Smithing כדי ללמוד אותו.",
            "לכשף אותו על כמה פריטים (למשל כפפות, טבעת ושרשרת) ולהחליף אליהם לפני שדרוג.",
            "אפשר להוסיף שיקוי שמגביר נפחות."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:Fortify Smithing",
          "imageQuery": "Skyrim blacksmith apron"
        },
        {
          "id": "resist-fire",
          "category": "armor",
          "nameHe": "עמידות לאש נגד דרקונים",
          "nameEn": "Resist Fire (ring / potions)",
          "priority": "medium",
          "minLevel": null,
          "summary": "טבעת או שיקויים של עמידות לאש לקרבות דרקונים.",
          "why": "עדיף על מגן קסם: לא דורש מאנה ולא תופס ידיים.",
          "howToGet": [
            "לקנות שיקויי עמידות לאש אצל אלכימאים, או לייצר.",
            "לפרק פריט עם קסם עמידות לאש ולכשף טבעת משלך."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:Resist Fire",
          "imageQuery": "Skyrim resist fire potion"
        },
        {
          "id": "unrelenting-force",
          "category": "shouts",
          "nameHe": "הדף בלתי נלאה",
          "nameEn": "Unrelenting Force",
          "priority": "high",
          "minLevel": null,
          "summary": "שאגה שמעיפה אויבים לרצפה.",
          "why": "מצוינת נגד מכשפים, וליד מצוקים אפשר להפיל אויבים מההר.",
          "howToGet": [
            "המילה הראשונה בקיר המילים ב-Bleak Falls Barrow, בעלילה הראשית המוקדמת.",
            "המילים הבאות מה-Greybeards במהלך העלילה הראשית."
          ],
          "notes": [
            "צריך לפתוח כל מילה עם נשמת דרקון בתפריט השאגות."
          ],
          "wikiTitle": "Skyrim:Unrelenting Force",
          "imageQuery": "Unrelenting Force Skyrim shout"
        },
        {
          "id": "whirlwind-sprint",
          "category": "shouts",
          "nameHe": "זינוק סופה",
          "nameEn": "Whirlwind Sprint",
          "priority": "medium",
          "minLevel": null,
          "summary": "זינוק מהיר קדימה.",
          "why": "סוגר מרחק למכשפים ולקשתים בשנייה.",
          "howToGet": [
            "מה-Greybeards במהלך המשימה הראשית The Way of the Voice."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:Whirlwind Sprint",
          "imageQuery": "Whirlwind Sprint Skyrim"
        },
        {
          "id": "elemental-fury",
          "category": "shouts",
          "nameHe": "זעם היסודות",
          "nameEn": "Elemental Fury",
          "priority": "high",
          "minLevel": null,
          "summary": "מאיצה את מהירות ההנפה ומגבירה נזק ל-15 שניות.",
          "why": "הדרך העיקרית במשחק להאיץ מכות של פטיש.",
          "howToGet": [
            "Statue to Meridia: במעלה ההר צפון-מזרחית לפסל, מערבית לסוליטיוד. הקיר כמעט לא שמור.",
            "Shriekwind Bastion: צינוק צפון-מזרחית לפולקריית'.",
            "Dragontooth Crater: מאורת דרקון באזור The Reach."
          ],
          "notes": [
            "לא עובדת על נשקים מכושפים ולא על נשקים מזומנים.",
            "באג: לפעמים הקיר ליד הפסל לא נותן את המילה. טעינה מחדש או נסיעה הלוך וחזור פותרים."
          ],
          "wikiTitle": "Skyrim:Elemental Fury",
          "imageQuery": "Elemental Fury Skyrim shout"
        },
        {
          "id": "become-ethereal",
          "category": "shouts",
          "nameHe": "הפוך לאתרי",
          "nameEn": "Become Ethereal",
          "priority": "medium",
          "minLevel": null,
          "summary": "כמה שניות שבהן שום דבר לא פוגע בך (וגם אתה לא יכול לתקוף).",
          "why": "לשרוד נשיפת דרקון או להגיע בבטחה לאויב.",
          "howToGet": [
            "Ustengrav: בעלילה הראשית, במשימה The Horn of Jurgen Windcaller.",
            "Ironbind Barrow באזור וינטרהולד.",
            "Lost Valley Redoubt באזור The Reach."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:Become Ethereal",
          "imageQuery": "Become Ethereal Skyrim"
        },
        {
          "id": "dragonrend",
          "category": "shouts",
          "nameHe": "קורע הדרקונים",
          "nameEn": "Dragonrend",
          "priority": "high",
          "minLevel": null,
          "summary": "מכריחה דרקון לנחות.",
          "why": "נשק דו-ידני לא מגיע לדרקון באוויר. עם השאגה הוא שלך.",
          "howToGet": [
            "מתקבלת בעלילה הראשית, במשימה Alduin's Bane על Throat of the World."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:Dragonrend",
          "imageQuery": "Dragonrend Skyrim"
        },
        {
          "id": "marked-for-death",
          "category": "shouts",
          "nameHe": "מסומן למוות",
          "nameEn": "Marked for Death",
          "priority": "low",
          "minLevel": null,
          "summary": "מורידה לאויב שריון ומנקזת לו חיים ל-60 שניות.",
          "why": "כל מילה מורידה 25 שריון, בערך 3% יותר נזק פיזי לכל מילה. ב-Special Edition הבאג שגרם לה להיות חזקה מאוד תוקן, ו-Skullcrusher כבר מתעלם משריון. לכן התועלת לבילד שלך קטנה.",
          "howToGet": [
            "Dark Brotherhood Sanctuary: רק אם מצטרפים לאחווה האפלה.",
            "Forsaken Cave: מערבית לווינדהלם, בחלק הפנימי Forsaken Crypt.",
            "Autumnwatch Tower: דרומית לאייברסטד, שמור על ידי דרקון."
          ],
          "notes": [
            "באג ידוע: ללמוד את השאגה Drain Vitality לפני כל שלוש המילים כאן עלול לתקוע את השאגה."
          ],
          "wikiTitle": "Skyrim:Marked for Death",
          "imageQuery": "Marked for Death Skyrim shout"
        },
        {
          "id": "soul-trap",
          "category": "spells",
          "nameHe": "לכידת נשמה",
          "nameEn": "Soul Trap",
          "priority": "high",
          "minLevel": null,
          "summary": "אם המטרה מתה תוך 60 שניות, הנשמה שלה ממלאת אבן נשמה ריקה בתיק.",
          "why": "ממלא אבני נשמה בחינם, בשביל כישוף חפצים ולולאת פגיוני הברזל.",
          "howToGet": [
            "לקנות את ספר הלחש אצל Farengar בדרגונסריץ' (וייטראן).",
            "או אצל Calcelmo (מרקארת'), Falion (מורת'אל), Madena (וינדהלם), או Phinis Gestor בקולג' בוינטרהולד."
          ],
          "notes": [
            "צריך אבן נשמה ריקה בתיק.",
            "לחש ברמת Apprentice בזימון (Conjuration).",
            "עם הכוכב השחור או הכוכב של אזורה, יש אבן שלא נשברת."
          ],
          "wikiTitle": "Skyrim:Soul Trap",
          "imageQuery": "Soul Trap Skyrim spell"
        },
        {
          "id": "transmute",
          "category": "spells",
          "nameHe": "המרת עפרות",
          "nameEn": "Transmute Mineral Ore",
          "priority": "high",
          "minLevel": null,
          "summary": "הופך עפרת ברזל לכסף, ועפרת כסף לזהב.",
          "why": "עפרות זהב, מטילי זהב, טבעות זהב: אחת הדרכים המהירות להעלות נפחות, וגם הרבה כסף.",
          "howToGet": [
            "Halted Stream Camp: מחנה שודדים מעל מכרה ברזל, צפון-מערבית לוייטראן. השודדים ברמות 6-10.",
            "הספר על שולחן בסוף המכרה. במכרה יש גם 16 עורקי ברזל.",
            "מיקום נוסף: Ansilvund."
          ],
          "notes": [
            "לחש ברמת Adept באלטרציה. דורש מאנה, שמתחדשת לבד.",
            "הספר לא חוזר אם מוכרים אותו, אז לקרוא מיד."
          ],
          "wikiTitle": "Skyrim:Transmute Mineral Ore",
          "imageQuery": "Transmute Mineral Ore Skyrim"
        },
        {
          "id": "muffle",
          "category": "spells",
          "nameHe": "השתקה",
          "nameEn": "Muffle",
          "priority": "low",
          "minLevel": null,
          "summary": "תנועה שקטה יותר ל-180 שניות.",
          "why": "רלוונטי רק אם רוצים להתגנב בשריון כבד. לבילד שלך, שלא מתבסס על התגנבות, התועלת קטנה. Ebony Mail נותן את אותו אפקט בהתגנבות.",
          "howToGet": [
            "לקנות את ספר הלחש אצל Farengar בוייטראן או אצל מכשפים אחרים.",
            "או למצוא מגפיים עם הקסם Muffle, לפרק וללמוד."
          ],
          "notes": [
            "לחש ברמת Apprentice באילוזיה."
          ],
          "wikiTitle": "Skyrim:Muffle",
          "imageQuery": "Muffle Skyrim spell"
        },
        {
          "id": "agent-of-mara",
          "category": "passives",
          "nameHe": "שליח מארה",
          "nameEn": "Agent of Mara",
          "priority": "high",
          "minLevel": null,
          "summary": "בונוס קבוע של 15% עמידות לקסמים.",
          "why": "מפחית נזק מקסמים, בדיוק נגד מכשפי הקרח שמטרידים אותך.",
          "howToGet": [
            "לדבר עם Dinya Balu במקדש מארה בריפטן ולבקש את ברכת מארה (המשימה The Book of Love).",
            "לעזור ל-Fastred באייברסטד.",
            "לעזור ל-Calcelmo במרקארת' (קונים שיר מ-Yngvar ב-200 זהב ומעבירים ל-Faleen).",
            "לחבוש את קמע מארה, למצוא את רוחות Ruki ו-Fenrig ב-Gjukar's Monument (דרום-מזרחית לרוריקסטד) ולאחד ביניהן.",
            "לחזור ל-Dinya Balu."
          ],
          "notes": [
            "שומרים את קמע מארה, וזה מאפשר גם להתחתן.",
            "אם יש לך כמה קמעות מארה, זה עלול לתקוע את המשימה."
          ],
          "wikiTitle": "Skyrim:The Book of Love",
          "imageQuery": "Temple of Mara Riften"
        },
        {
          "id": "agent-of-dibella",
          "category": "passives",
          "nameHe": "שליח דיבלה",
          "nameEn": "Agent of Dibella",
          "priority": "medium",
          "minLevel": 14,
          "summary": "10% יותר נזק פיזי נגד אויבים מהמין השני.",
          "why": "בונוס נזק קבוע לחצי מהאויבים. בנוסף פותח מאמנת כישוף חפצים ברמה הגבוהה ביותר.",
          "howToGet": [
            "להגיע למקדש דיבלה במרקארת'.",
            "להיכנס לחדר הפנימי של המקדש ולהשלים את המשימה The Heart of Dibella."
          ],
          "notes": [
            "אחרי המשימה, Hamal במקדש מאמנת כישוף חפצים ברמת Master."
          ],
          "wikiTitle": "Skyrim:The Heart of Dibella",
          "imageQuery": "Temple of Dibella Markarth"
        },
        {
          "id": "ancient-knowledge",
          "category": "passives",
          "nameHe": "ידע עתיק",
          "nameEn": "Ancient Knowledge",
          "priority": "high",
          "minLevel": 14,
          "summary": "נפחות עולה 15% מהר יותר, לתמיד.",
          "why": "מאיץ את הדרך לנפחות 100 ולציוד הדרקוני.",
          "howToGet": [
            "משימה בשם Unfathomable Depths, שמתחילה ברציפים של ריפטן (מרמה 14)."
          ],
          "notes": [
            "חלק נוסף של הבונוס (25% שריון עם שריון דוורי) ידוע כבאגי. החלק של הנפחות עובד גם בלי שריון דוורי."
          ],
          "wikiTitle": "Skyrim:Unfathomable Depths",
          "imageQuery": "Skyrim Dwemer Lexicon"
        },
        {
          "id": "seeker-of-might",
          "category": "passives",
          "nameHe": "מחפש העוצמה",
          "nameEn": "Seeker of Might",
          "priority": "high",
          "minLevel": null,
          "summary": "כל כישורי הלחימה יעילים יותר ב-10%, כולל נפחות, שריון כבד וחסימה.",
          "why": "בונוס קבוע לכל מה שהבילד שלך בנוי עליו.",
          "howToGet": [
            "באי Solstheim (הרחבה Dragonborn, כלולה ב-Special Edition).",
            "למצוא את הספר השחור The Sallow Regent במקום White Ridge Barrow.",
            "לקרוא אותו, לעבור את העולם של Apocrypha, ובסוף לבחור ב-Seeker of Might."
          ],
          "notes": [
            "הבחירה בסוף הספר סופית. שתי האפשרויות האחרות מיועדות להתגנבות ולקסם."
          ],
          "wikiTitle": "Skyrim:Black Book: The Sallow Regent",
          "imageQuery": "Black Book Skyrim Dragonborn"
        },
        {
          "id": "oghma-infinium",
          "category": "passives",
          "nameHe": "אוגמה אינפיניום",
          "nameEn": "Oghma Infinium",
          "priority": "high",
          "minLevel": null,
          "summary": "ספר חד-פעמי שנותן +5 רמות לשישה כישורי לחימה.",
          "why": "Path of Might מעלה את: קשתות, חסימה, שריון כבד, חד-ידני, נפחות ודו-ידני.",
          "howToGet": [
            "למצוא את Septimus Signus במחנה שלו צפונית לקולג' בוינטרהולד.",
            "להשלים את המשימה Discerning the Transmundane.",
            "לקרוא את הספר ולבחור ב-Path of Might."
          ],
          "notes": [
            "אי אפשר לעלות מעבר ל-100, אז לקרוא לפני שהכישורים קרובים לתקרה.",
            "המשימה ארוכה ועוברת בהריסות דוורים עמוקות."
          ],
          "wikiTitle": "Skyrim:Oghma Infinium",
          "imageQuery": "Oghma Infinium Skyrim"
        },
        {
          "id": "aetherial-crown",
          "category": "passives",
          "nameHe": "הכתר האתרי",
          "nameEn": "Aetherial Crown",
          "priority": "medium",
          "minLevel": null,
          "summary": "מאפשר שתי אבני מזל פעילות בו-זמנית.",
          "why": "למשל אבן האדון (שריון ועמידות לקסמים) ואבן הסוס (בלי משקל שריון), או אבן האדון ואבן האטרונך.",
          "howToGet": [
            "משימה Lost to the Ages (הרחבה Dawnguard, כלולה ב-Special Edition). מתחילה מקריאת הספר The Aetherium Wars או ממציאת אחד הרסיסים.",
            "לאסוף ארבעה רסיסים בהריסות דוורים שונות.",
            "בסוף, ב-Aetherium Forge שבתוך Ruins of Bthalft, לבחור לייצר את הכתר."
          ],
          "notes": [
            "חיסרון: הכתר תופס את מקום הקסדה.",
            "רמה מומלצת למשימה: 16.",
            "חובשים את הכתר, מפעילים אבן חדשה, והקודמת נשמרת בכתר."
          ],
          "wikiTitle": "Skyrim:Aetherial Crown",
          "imageQuery": "Aetherial Crown Skyrim"
        },
        {
          "id": "mora-boon",
          "category": "passives",
          "nameHe": "ברכת מורה",
          "nameEn": "Mora's Boon",
          "priority": "medium",
          "minLevel": null,
          "summary": "כוח שממלא בבת אחת חיים, סטמינה ומאנה.",
          "why": "כפתור הצלה בקרב קשה.",
          "howToGet": [
            "ב-Solstheim, במגדל Tel Mithryn של המכשף Neloth.",
            "לקרוא את הספר השחור The Hidden Twilight ולבחור בסוף ב-Mora's Boon."
          ],
          "notes": [
            "זה כוח עם שימוש מוגבל, לא בונוס פסיבי."
          ],
          "wikiTitle": "Skyrim:Black Book: The Hidden Twilight",
          "imageQuery": "Tel Mithryn Skyrim"
        },
        {
          "id": "dragonborn-force",
          "category": "passives",
          "nameHe": "כוח בן הדרקון",
          "nameEn": "Dragonborn Force",
          "priority": "low",
          "minLevel": null,
          "summary": "השאגה Unrelenting Force עושה יותר נזק ועלולה לפורר אויבים.",
          "why": "מחזק את השאגה שאתה ממילא משתמש בה נגד מכשפים.",
          "howToGet": [
            "ב-Solstheim, הספר השחור Epistolary Acumen בהריסות Nchardak (חלק מהעלילה של Dragonborn).",
            "לבחור בסוף ב-Dragonborn Force."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:Black Book: Epistolary Acumen",
          "imageQuery": "Nchardak Skyrim"
        },
        {
          "id": "sailors-repose",
          "category": "passives",
          "nameHe": "מנוחת המלח",
          "nameEn": "Sailor's Repose",
          "priority": "low",
          "minLevel": 18,
          "summary": "לחשי ריפוי מרפאים 10% יותר, לתמיד.",
          "why": "תועלת קטנה לבילד שלך, כי לחש הריפוי משמש אותך בעיקר בין קרבות. מתאים אם עוברים באזור.",
          "howToGet": [
            "להיכנס למגדלור Frostflow Lighthouse, על החוף בין דון-סטאר לוינטרהולד.",
            "לרדת למערה Frostflow Abyss ולהרוג את היצור הגדול בסוף (chaurus reaper). עליו: שרידי Habd ומפתח.",
            "לחזור לראש המגדלור, לפתוח את התיבה, לטפס לסולם ולהפעיל את מדורת המגדלור."
          ],
          "notes": [
            "המשימה לא אומרת לך לעשות את הצעד האחרון. רק היומן של Ramati במגדלור רומז על זה.",
            "רמה מינימלית למקום: 18."
          ],
          "wikiTitle": "Skyrim:Frostflow Abyss",
          "imageQuery": "Frostflow Lighthouse Skyrim"
        },
        {
          "id": "warrior-stone",
          "category": "stones",
          "nameHe": "אבן הלוחם",
          "nameEn": "The Warrior Stone",
          "priority": "high",
          "minLevel": null,
          "summary": "כישורי לחימה עולים 20% מהר יותר.",
          "why": "מתאימה לתחילת המשחק, כשהעיקר להתקדם בכישורים.",
          "howToGet": [
            "Guardian Stones: על הדרך ליד הכפר ריברווד."
          ],
          "notes": [
            "קשתות שייכת דווקא לאבן הגנב, לא לאבן הלוחם."
          ],
          "wikiTitle": "Skyrim:The Warrior Stone",
          "imageQuery": "Guardian Stones Skyrim"
        },
        {
          "id": "lord-stone",
          "category": "stones",
          "nameHe": "אבן האדון",
          "nameEn": "The Lord Stone",
          "priority": "high",
          "minLevel": null,
          "summary": "+50 שריון ו-25% עמידות לקסמים.",
          "why": "אבן הטנק. עוזרת גם מול נזק פיזי וגם מול מכשפים.",
          "howToGet": [
            "מזרח ל-Morthal, על ההר ליד המקדש של Mehrunes Dagon. השביל מתחיל צפונית ל-Hall of the Vigilant."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:The Lord Stone",
          "imageQuery": "The Lord Stone Skyrim"
        },
        {
          "id": "atronach-stone",
          "category": "stones",
          "nameHe": "אבן האטרונך",
          "nameEn": "The Atronach Stone",
          "priority": "medium",
          "minLevel": null,
          "summary": "סופגת 50% מהקסמים, +50 מאנה, אבל המאנה מתחדשת לאט ב-50%.",
          "why": "נגד מכשפים היא אפילו חזקה מאבן האדון. ללוחם, החיסרון במאנה כמעט לא מורגש.",
          "howToGet": [
            "באזור המעיינות החמים של Eastmarch, צפון-מערבית ל-Mistwatch."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:The Atronach Stone",
          "imageQuery": "The Atronach Stone Skyrim"
        },
        {
          "id": "steed-stone",
          "category": "stones",
          "nameHe": "אבן הסוס",
          "nameEn": "The Steed Stone",
          "priority": "medium",
          "minLevel": null,
          "summary": "+100 משקל נשיאה, והשריון שלובשים לא שוקל ולא מאט.",
          "why": "פותרת את בעיית ההליכה האיטית בשריון כבד, עד שתגיע לפרק Conditioning.",
          "howToGet": [
            "צפון-מערבית לסוליטיוד, ליד Ironback Hideout, צפונית לפסל של מרידיה."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:The Steed Stone",
          "imageQuery": "The Steed Stone Skyrim"
        },
        {
          "id": "barbarian",
          "category": "perks",
          "nameHe": "ברברי (5 דרגות)",
          "nameEn": "Barbarian",
          "priority": "high",
          "minLevel": null,
          "summary": "כל דרגה: +20% נזק דו-ידני. עד פי 2.",
          "why": "הבונוס הכי גדול לנזק.",
          "howToGet": [
            "עץ הדו-ידני. הדרגות נפתחות ב-0, 20, 40, 60 ו-80."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:Barbarian",
          "imageQuery": "Skyrim two-handed perk tree"
        },
        {
          "id": "champions-stance",
          "category": "perks",
          "nameHe": "עמדת האלוף",
          "nameEn": "Champion's Stance",
          "priority": "high",
          "minLevel": null,
          "summary": "מכות כוח עולות פחות סטמינה.",
          "why": "יותר מכות כוח בכל קרב.",
          "howToGet": [
            "עץ הדו-ידני, ברמה 20."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:Champion's Stance",
          "imageQuery": "Skyrim two-handed perk tree"
        },
        {
          "id": "skullcrusher",
          "category": "perks",
          "nameHe": "מרסק גולגולות (3 דרגות)",
          "nameEn": "Skullcrusher",
          "priority": "high",
          "minLevel": null,
          "summary": "מכות פטיש מתעלמות מ-25%, 50% ו-75% מהשריון של האויב.",
          "why": "מה שהופך את הפטיש לחזק מול אויבים משוריינים.",
          "howToGet": [
            "עץ הדו-ידני. הדרגות ב-30, 60 ו-90."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:Skullcrusher",
          "imageQuery": "Skyrim two-handed perk tree"
        },
        {
          "id": "devastating-blow",
          "category": "perks",
          "nameHe": "מכה הרסנית",
          "nameEn": "Devastating Blow",
          "priority": "high",
          "minLevel": null,
          "summary": "מכת כוח בעמידה עושה 25% יותר נזק, עם סיכוי לערוף ראש.",
          "why": "עוד קפיצה בנזק של מכות הכוח.",
          "howToGet": [
            "עץ הדו-ידני, ברמה 50 (אחרי Champion's Stance)."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:Devastating Blow",
          "imageQuery": "Skyrim two-handed perk tree"
        },
        {
          "id": "juggernaut",
          "category": "perks",
          "nameHe": "ג'אגרנאוט (דרגות)",
          "nameEn": "Juggernaut",
          "priority": "high",
          "minLevel": null,
          "summary": "מגדיל את ערך השריון הכבד בכל דרגה.",
          "why": "פחות נזק מכל דבר, כדי לעמוד בקרב ולהחליף מכות.",
          "howToGet": [
            "עץ השריון הכבד, הפרק הראשון."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:Juggernaut",
          "imageQuery": "Skyrim heavy armor perk tree"
        },
        {
          "id": "conditioning",
          "category": "perks",
          "nameHe": "כושר",
          "nameEn": "Conditioning",
          "priority": "medium",
          "minLevel": null,
          "summary": "שריון כבד לא שוקל כלום ולא מאט אותך.",
          "why": "פותר לתמיד את האיטיות בהליכה, בלי לוותר על אבן מזל.",
          "howToGet": [
            "עץ השריון הכבד, ברמה 70."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:Conditioning",
          "imageQuery": "Skyrim heavy armor perk tree"
        },
        {
          "id": "steel-smithing",
          "category": "perks",
          "nameHe": "נפחות פלדה",
          "nameEn": "Steel Smithing",
          "priority": "high",
          "minLevel": null,
          "summary": "הפרק הראשון בנפחות: ייצור ושדרוג כפול של ציוד פלדה.",
          "why": "הבסיס לכל עץ הנפחות.",
          "howToGet": [
            "עץ הנפחות, בלי דרישת רמה."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:Steel Smithing",
          "imageQuery": "Skyrim smithing perk tree"
        },
        {
          "id": "orcish-smithing",
          "category": "perks",
          "nameHe": "נפחות אורקית",
          "nameEn": "Orcish Smithing",
          "priority": "high",
          "minLevel": null,
          "summary": "ציוד אורקי, ושדרוג כפול שלו.",
          "why": "הפטיש הארוך הוא פטיש אורקי, אז הפרק הזה מכפיל את השדרוג שלו.",
          "howToGet": [
            "עץ הנפחות, ברמה 50, אחרי Dwarven Smithing (רמה 30)."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:Orcish Smithing",
          "imageQuery": "Skyrim smithing perk tree"
        },
        {
          "id": "arcane-blacksmith",
          "category": "perks",
          "nameHe": "נפח קסום",
          "nameEn": "Arcane Blacksmith",
          "priority": "medium",
          "minLevel": null,
          "summary": "אפשר לשדרג נשקים ושריונות מכושפים.",
          "why": "בלעדיו אי אפשר לשדרג ציוד אחרי שכישפת אותו.",
          "howToGet": [
            "עץ הנפחות, ברמה 60."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:Arcane Blacksmith",
          "imageQuery": "Skyrim smithing perk tree"
        },
        {
          "id": "daedric-smithing",
          "category": "perks",
          "nameHe": "נפחות דאדרית",
          "nameEn": "Daedric Smithing",
          "priority": "medium",
          "minLevel": null,
          "summary": "ייצור ציוד דאדרי.",
          "why": "שלב לפני הפרק הדרקוני, בענף השריון הכבד.",
          "howToGet": [
            "עץ הנפחות, ברמה 90, אחרי Ebony Smithing (רמה 80)."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:Daedric Smithing",
          "imageQuery": "Skyrim smithing perk tree"
        },
        {
          "id": "dragon-armor",
          "category": "perks",
          "nameHe": "שריון דרקוני",
          "nameEn": "Dragon Armor",
          "priority": "high",
          "minLevel": null,
          "summary": "ייצור ציוד דרקוני, ושדרוג כפול שלו.",
          "why": "פותח את הפטיש והשריון הדרקוניים.",
          "howToGet": [
            "עץ הנפחות, ברמה 100, אחרי כל הפרקים באחד מענפי השריון."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:Dragon Armor",
          "imageQuery": "Skyrim smithing perk tree"
        },
        {
          "id": "enchanter",
          "category": "perks",
          "nameHe": "מכשף (דרגות)",
          "nameEn": "Enchanter",
          "priority": "medium",
          "minLevel": null,
          "summary": "כל דרגה מחזקת את כל הקסמים שאתה יוצר.",
          "why": "הפרק העיקרי בכישוף חפצים.",
          "howToGet": [
            "עץ כישוף החפצים, הפרק הראשון."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:Enchanter",
          "imageQuery": "Skyrim enchanting perk tree"
        },
        {
          "id": "insightful-enchanter",
          "category": "perks",
          "nameHe": "מכשף נבון",
          "nameEn": "Insightful Enchanter",
          "priority": "medium",
          "minLevel": null,
          "summary": "קסמים שמגבירים כישורים חזקים יותר.",
          "why": "בדיוק הקסמים שמעניינים אותך: נזק דו-ידני ונפחות.",
          "howToGet": [
            "עץ כישוף החפצים."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:Insightful Enchanter",
          "imageQuery": "Skyrim enchanting perk tree"
        },
        {
          "id": "quick-reflexes",
          "category": "perks",
          "nameHe": "רפלקסים מהירים",
          "nameEn": "Quick Reflexes (+ Shield Wall)",
          "priority": "low",
          "minLevel": null,
          "summary": "הזמן מאט כשחוסמים בזמן שהאויב מתחיל מכת כוח.",
          "why": "הדבר הכי קרוב לפרי במשחק. עובד גם עם נשק דו-ידני.",
          "howToGet": [
            "עץ החסימה, ברמה 30, אחרי הדרגה הראשונה של Shield Wall."
          ],
          "notes": [
            "Shield Wall עובד גם על חסימה עם נשק דו-ידני, למרות השם.",
            "Deflect Arrows ו-Elemental Protection עובדים רק עם מגן."
          ],
          "wikiTitle": "Skyrim:Quick Reflexes",
          "imageQuery": "Skyrim block perk tree"
        },
        {
          "id": "lydia",
          "category": "followers",
          "nameHe": "לידיה",
          "nameEn": "Lydia",
          "priority": "high",
          "minLevel": null,
          "summary": "מלווה טנק: שריון כבד וחסימה, עד בערך 671 חיים ברמה המקסימלית שלה.",
          "why": "סופגת נזק ומסיחה אויבים, במיוחד דרקונים.",
          "howToGet": [
            "מתקבלת אחרי הדרקון הראשון, בעלילה הראשית."
          ],
          "notes": [
            "לתת לה נשק חד-ידני טוב ומגן, לא נשק דו-ידני.",
            "היא לובשת אוטומטית את השריון עם ערך ההגנה הכי גבוה מכל מה שנתת לה.",
            "מלווים לא מתים מאויבים, אבל אתה כן יכול להרוג אותה בטעות עם מכת כוח."
          ],
          "wikiTitle": "Skyrim:Lydia",
          "imageQuery": "Lydia Skyrim"
        },
        {
          "id": "mjoll",
          "category": "followers",
          "nameHe": "מיול הלביאה",
          "nameEn": "Mjoll the Lioness",
          "priority": "medium",
          "minLevel": 14,
          "summary": "לוחמת בשריון כבד שלא יכולה למות בכלל.",
          "why": "טנק חלופי לגמרי בטוח.",
          "howToGet": [
            "לדבר איתה בריפטן.",
            "להביא את החרב שלה Grimsever מהריסות הדוורים Mzinchaleft (המשימה Grimsever's Return).",
            "החרב מופיעה רק מרמה 14."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:Mjoll the Lioness",
          "imageQuery": "Mjoll the Lioness Skyrim"
        },
        {
          "id": "breezehome",
          "category": "followers",
          "nameHe": "בית בוייטראן",
          "nameEn": "Breezehome",
          "priority": "medium",
          "minLevel": null,
          "summary": "בית ראשון ויחסית זול.",
          "why": "מקום בטוח לאחסן חומרים, כמו עצמות וקשקשי דרקון, ומיטה משלך.",
          "howToGet": [
            "לקנות דרך הסטיוארד של הג'ארל בדרגונסריץ' בוייטראן."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:Breezehome",
          "imageQuery": "Breezehome Whiterun"
        },
        {
          "id": "companions",
          "category": "quests",
          "nameHe": "להצטרף ל-Companions",
          "nameEn": "The Companions",
          "priority": "high",
          "minLevel": null,
          "summary": "גילדת הלוחמים בוייטראן, עם מאמנים ברמה הגבוהה ביותר לכל הבילד שלך.",
          "why": "Vilkas מאמן דו-ידני, Farkas מאמן שריון כבד, ו-Eorlund מאמן נפחות. כולם ברמת Master.",
          "howToGet": [
            "ללכת ל-Jorrvaskr בוייטראן ולדבר עם Kodlak Whitemane.",
            "Eorlund מאמן נפחות אחרי המשימה הראשונה Take Up Arms, עד רמה 90."
          ],
          "notes": [
            "במהלך הסדרה הסיפור הופך אותך לאיש זאב. בסוף הסדרה יש אפשרות להירפא.",
            "אפשר להתאמן עד 5 פעמים בכל רמת דמות."
          ],
          "wikiTitle": "Skyrim:Companions",
          "imageQuery": "Jorrvaskr Whiterun"
        },
        {
          "id": "black-star",
          "category": "quests",
          "nameHe": "הכוכב השחור",
          "nameEn": "The Black Star",
          "priority": "high",
          "minLevel": null,
          "summary": "אבן נשמה שלא נשברת. שתי האפשרויות בסוף נותנות אבן כזאת.",
          "why": "חוסך קניית אבני נשמה לכישוף חפצים.",
          "howToGet": [
            "להחזיר לאזורה: מקבלים את Azura's Star, שמכילה רק נשמות של חיות ויצורים.",
            "לתת ל-Nelacar בוינטרהולד: מקבלים את The Black Star, שמכילה כל נשמה, כולל בני אדם ואלפים (תמיד בדרגה הגבוהה)."
          ],
          "notes": [
            "צריך את Soul Trap כדי למלא אותה."
          ],
          "wikiTitle": "Skyrim:The Black Star",
          "imageQuery": "The Black Star Skyrim"
        },
        {
          "id": "trainers-extra",
          "category": "quests",
          "nameHe": "מאמנים נוספים",
          "nameEn": "Torbjorn, Balimund, Hamal",
          "priority": "low",
          "minLevel": null,
          "summary": "מאמנים בערים אחרות.",
          "why": "אם אתה רחוק מוייטראן, או לכישוף חפצים.",
          "howToGet": [
            "Torbjorn Shatter-Shield בוינדהלם: דו-ידני ברמת Expert.",
            "Balimund בריפטן: נפחות ברמת Expert.",
            "Hamal במרקארת': כישוף חפצים ברמת Master, אחרי The Heart of Dibella."
          ],
          "notes": [],
          "wikiTitle": "Skyrim:Trainers",
          "imageQuery": "Skyrim trainer"
        }
      ],
      "tips": [
        "מילים חדשות של שאגות צריך לפתוח עם נשמת דרקון בתפריט הקסמים, בלשונית השאגות.",
        "התפריטים עוצרים את הזמן. אפשר לשתות שיקויים באמצע קרב בלי לחץ.",
        "לחכות שעה אחרי קרב ממלא חיים וסטמינה בחינם (לא כשיש אויבים בסביבה).",
        "עם פטיש: להתחיל את מכת הכוח לפני שהאויב מגיע, כדי שתנחת בדיוק כשהוא בטווח.",
        "מכות רגילות מהירות יותר ממכות כוח. שתיים-שלוש רגילות, ואז מכת כוח כשהאויב פתוח.",
        "דרקונים נוחתים לבד. כשהם באוויר, להסתתר. כשהם נוחתים, לתקוף מהצד, לא מלפנים ולא מאחור.",
        "לולאת נפחות וכישוף: פגיוני ברזל, לכשף כל אחד עם קסם פשוט ואבן קטנה, ולמכור.",
        "עפרות זהב, מטילי זהב, טבעות זהב: עולה נפחות מהר יותר מפגיונות, ועם המרת עפרות זה כמעט בחינם.",
        "שינה במיטה נותנת בונוס זמני להתקדמות בכישורים.",
        "המקדש של Talos מקצר את זמן ההמתנה לשאגה.",
        "לא לפגוע בתרנגולות ובאזרחים בכפרים ובערים. מכת כוח פוגעת בכל מי שלידך.",
        "בעומס יתר אי אפשר לרוץ וגם אי אפשר לעשות נסיעה מהירה."
      ]
    }
  ]
}
```

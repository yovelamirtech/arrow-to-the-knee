# Arrow to the Knee

רשימת מעקב אישית למשחק ב-Skyrim Special Edition (בלי מודים).
הבילד הראשון: לוחם פטיש דו-ידני בשריון כבד.

**האתר:** https://yovelamirtech.github.io/arrow-to-the-knee/

## מה יש באתר

- פריטים ששווה להשיג (נשקים, שאגות, לחשים, בונוסים קבועים, פרקים, מלווים ועוד), מחולקים לקטגוריות.
- לחיצה על פריט פותחת פרטים: מה זה, למה זה טוב לבילד, איך משיגים, הערות וקישור ל-UESP.
- סימון V מעביר פריט לארכיון, עם אפשרות ביטול. מהארכיון אפשר להחזיר פריט לרשימה.
- חיפוש בעברית ובאנגלית, וטאב טיפים.
- ההתקדמות נשמרת בדפדפן (`localStorage`, מפתח `arrow-to-the-knee-v1`), בנפרד לכל בילד. אין סנכרון בין מכשירים.

## מבנה הקבצים

```
index.html            הדף
styles.css            עיצוב
app.js                הלוגיקה
data/items.json       כל התוכן: בילדים, קטגוריות, פריטים וטיפים
data/images.json      איזו תמונה שייכת לאיזה פריט (נוצר על ידי הסקריפט)
assets/img/<build>/   התמונות עצמן
scripts/fetch_images.py      מוריד תמונות לפריטים שאין להם תמונה
scripts/image_overrides.json תיקונים ידניים לתמונות (קובץ מסוים, או בלי תמונה)
```

אתר סטטי, בלי build ובלי תלויות. כדי להריץ מקומית:

```bash
python3 -m http.server 8000
```

ואז לפתוח את `http://localhost:8000`.

## מבנה הנתונים

`data/items.json` מכיל מערך `builds`. כל בילד:

| שדה | תיאור |
| --- | --- |
| `id` | מזהה באנגלית, ייחודי (למשל `two-handed-warhammer`). ההתקדמות נשמרת לפיו, אז לא משנים אותו. |
| `nameHe` | שם הבילד בעברית (מופיע מתחת לכותרת ובבורר) |
| `nameEn` | שם הבילד באנגלית |
| `categories` | מערך של `{ "id", "nameHe", "icon" }`. הסדר כאן הוא סדר הטאבים. `icon` הוא אימוג'י שמשמש גם כתמונה חלופית. אסור להשתמש ב-`archive` או ב-`tips` כמזהה קטגוריה. |
| `items` | מערך הפריטים (ראו למטה) |
| `tips` | מערך של מחרוזות בעברית |

כל פריט:

| שדה | תיאור |
| --- | --- |
| `id` | מזהה באנגלית, ייחודי בתוך הבילד. ההתקדמות נשמרת לפיו, אז לא משנים אותו. |
| `category` | `id` של קטגוריה מהבילד |
| `nameHe` / `nameEn` | שם בעברית ושם באנגלית |
| `priority` | `high`, `medium` או `low` |
| `minLevel` | מספר, או `null` אם אין דרישת רמה |
| `summary` | שורה אחת: מה זה |
| `why` | למה זה טוב לבילד |
| `howToGet` | מערך של צעדים (מוצג כרשימה ממוספרת) |
| `notes` | מערך של הערות (יכול להיות ריק) |
| `wikiTitle` | שם הדף ב-UESP, למשל `Skyrim:The Longhammer` |
| `imageQuery` | מילות חיפוש לתמונה בוויקי |

בתוך בילד, הפריטים ממוינים לפי עדיפות, אחר כך לפי `minLevel` (בלי רמה קודם), ואחר כך לפי הסדר בקובץ.

כשיש בילד אחד, האתר נפתח ישר אליו בלי בורר. מרגע שיש שניים ומעלה מופיע בורר קטן מתחת לכותרת, והאתר זוכר את הבילד האחרון.

## איך מוסיפים קלאס חדש

מעתיקים את הפרומפט הבא ל-AI (למשל Claude Code בתיקייה של הריפו), ומחליפים את `<הקלאס>`:

```text
Add a new build to data/items.json for <הקלאס> in Skyrim Special Edition (no mods).
Give it a unique English id, nameHe and nameEn, categories, items and tips,
all in Hebrew, in exactly the same schema and style as the existing build
(see README.md for the schema). Keep the existing build untouched.
Then run `python3 scripts/fetch_images.py`, look at every new image yourself and
remove or override (scripts/image_overrides.json) any image that does not show the
item, check the site locally, then commit and push.
```

**להוספת פריט בודד לבילד קיים:** מוסיפים אובייקט חדש למערך `items` של הבילד עם `id` חדש, מריצים `python3 scripts/fetch_images.py`, בודקים את התמונה ועושים commit ו-push.

## תמונות

`scripts/fetch_images.py` (Python בלבד, בלי ספריות חיצוניות) עובר על כל הפריטים בכל הבילדים, ולכל פריט בלי תמונה מנסה למצוא תמונה ב-Elder Scrolls Wiki (Fandom) וב-UESP. התמונות נשמרות בריפו, בגודל 256 פיקסלים לכל היותר, ונרשמות ב-`data/images.json`. פריט בלי תמונה מוצג עם האימוג'י של הקטגוריה.

אם הסקריפט הביא תמונה לא נכונה, מוסיפים תיקון ב-`scripts/image_overrides.json`:

```json
{ "<buildId>": { "<itemId>": { "uespFile": "File:SR-item-Something.jpg" } } }
{ "<buildId>": { "<itemId>": { "skip": true } } }
```

ומריצים שוב עם `--force <itemId>`.

## קרדיטים

התמונות והמידע מתוך [UESP](https://en.uesp.net/) ומתוך [The Elder Scrolls Wiki](https://elderscrolls.fandom.com/) (Fandom), ברישיון CC BY-SA. המשחק The Elder Scrolls V: Skyrim הוא © Bethesda.

המסמך המקורי שממנו נבנה האתר: [`arrow-to-the-knee-prompt.md`](arrow-to-the-knee-prompt.md).

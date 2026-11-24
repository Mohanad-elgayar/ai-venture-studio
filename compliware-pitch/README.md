# Compliware: cinematic pitch

A 10-scene pitch presentation that runs fully offline in Chrome. Everything it needs (GSAP, Three.js, fonts) is in this folder; nothing is fetched from the internet.

## Run it

1. Copy the whole `compliware-pitch` folder to the presenting laptop (USB stick is fine).
2. Double-click `index.html` (or drag it into Chrome).
3. Press **F** for fullscreen, then **→** to start. The deck opens on a black screen and waits for you.

Designed at 1920 × 1080 (16:9). On other screen sizes it scales and letterboxes, so the layout never shifts or overlaps.

## Presenter keys

| Key | Action |
| --- | --- |
| → · PgDn · Space · Enter | Next. If a scene is still animating, the first press finishes it; the next press moves on. |
| ← · PgUp | Previous (shown in its finished state) |
| 1–9, 0 | Jump to scene 1–10 |
| F · F5 | Fullscreen on/off |
| **K** | Pause / resume all animation (hidden key; a small amber dot appears top-right) |
| **R** | Replay the current scene's animation |
| N | Presenter notes at the bottom of this screen |
| P | Presenter window (notes, next scene, timer). Drag it to your laptop screen; keys work in either window. |
| L | Lite mode on/off (reloads at the same scene) |
| B · . | Black screen (most clickers have a "blank" button that sends this) |
| H · ? | Key help |
| Esc | Close a document preview / the help panel |

Clickers that send PageUp/PageDown or arrow keys work without setup.

### Demo scenes (4 and 5)
After the answer and source chips appear, press **→** to open the first source, **→** again for the second, and **→** to close. You can also click a chip with the mouse.

## Lite mode (weak laptops)

Press **L**, or open `index.html?lite=1`. Lite mode:
- halves the document cards and particles, caps the 3D background at 30 fps and renders it at lower resolution
- removes blur/glass effects and scene-transition blur

The choice is remembered on that laptop. If the deck detects a low frame rate on start it shows a hint to press L. If WebGL is unavailable, a flat blueprint building replaces the 3D background automatically.

**Before the meeting:** open the deck on the actual laptop and projector, click through it once, and decide on full vs lite mode.

## Editing content

| What | Where |
| --- | --- |
| Presenter notes | `js/content.js` → `CW.NOTES` |
| Floating document cards (scenes 2–3) | `js/content.js` → `CW.CARD_TYPES` |
| Document previews (RFI-245, Shop Drawing Rev B, RFI-0847, MM-112) | `js/content.js` → `CW.DOCS` |
| Demo questions, answers and source chips | `index.html` → `data-*` attributes on `#sc-demoA` / `#sc-demoB` |
| All other on-screen text | `index.html` |
| Animation timing | `js/scenes.js` |

Figures marked *illustrative* (the SAR 120,000 / 15-day scenario and the value estimates), the NFPA 20 clause (paraphrased) and the sample documents are demo content. Check them before presenting.

## Files

```
index.html        scenes & markup
css/style.css     visual design (1920×1080 stage)
js/content.js     notes, cards, document previews
js/bg.js          Three.js blueprint background, building, core rings
js/cards.js       floating card physics → ordered grid
js/scenes.js      per-scene GSAP choreography, document preview
js/app.js         navigation, keys, notes, presenter window, lite mode
vendor/           gsap.min.js 3.12.5, three.min.js r160
fonts/            Space Grotesk, IBM Plex Sans / Sans Arabic / Mono (OFL)
```

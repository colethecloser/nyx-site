# NYX-1 — Marketing Site

A production-ready marketing site for NYX-1, a restorative sleep engine.
Built with Next.js (App Router) and exported as a static site, so it deploys
to Vercel with zero configuration and no server costs.

## Pages
- `/` — landing page (hero, anti-stimulant pitch, the device, how it works, time-value calculator, comparison table, reserve/pricing)
- `/about` — About the Founder

## Run locally
```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static export to ./out
```

## Deploy to Vercel (GitHub flow)
1. Create a new GitHub repo and push this folder:
   ```bash
   git init
   git add .
   git commit -m "NYX-1 marketing site"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. Go to vercel.com → New Project → import the repo.
3. Vercel auto-detects Next.js. Leave the defaults and deploy.
   (Build command `next build`, output is the static `out/` directory.)

## Add the real product photo (AI generated)
The site ships with a clean vector render so it looks complete immediately.
To use a photoreal image instead:
1. Generate one (prompt below) and save it as `public/product.png`.
2. In `lib/homeHtml.js`, find the comment `SWAP IN A REAL/AI PHOTO` inside the
   `#device` section and replace the entire `<svg>...</svg>` block with:
   ```html
   <img src="/product.png" alt="NYX-1 restorative sleep engine" class="product-photo">
   ```

### AI image prompt for the product
> Premium product photograph of a minimalist bedside sleep device: a smooth
> matte-charcoal vertical monolith about 30cm tall with softly rounded edges,
> a thin vertical light seam glowing in a gradient of warm amber into violet
> into cyan, sitting on a dark walnut nightstand. Beside it, a small sculptural
> in-ear sensor with a glowing cyan tip resting on a circular dock. Dark
> moody studio lighting, deep navy background, subtle floor reflection,
> shallow depth of field, ultra clean, Apple-style industrial design,
> photorealistic, 4k. No text, no logos.

## Add the founder photo
1. Save your headshot as `public/founder.jpg`.
2. In `lib/aboutHtml.js`, find `SWAP IN A REAL/AI PORTRAIT` and replace the
   `<svg>...</svg>` block with:
   ```html
   <img src="/founder.jpg" alt="Cole Gadell, founder of NYX">
   ```

## Edit points
- Prices: search `$4,900`, `$204`, `$500` in `lib/homeHtml.js`.
- Specs and feature copy: `lib/homeHtml.js`.
- Founder name, bio, principles: `lib/aboutHtml.js`.
- Calculator defaults: the `#calc` inputs in `lib/homeHtml.js`
  (and the math in `components/ClientEnhancements.js`).
- Colors and type: CSS variables at the top of `app/globals.css`.

## Notes
NYX-1 is a concept product. Marketing copy is kept to defensible claims
(more efficient recovery, reclaimed time) rather than medical claims.

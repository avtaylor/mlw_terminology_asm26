# MLW Research Terminology Explorer

Static site generated from the supplied technical-terms workbook.

## Run locally
Because the site loads `data.json`, browsers may block it when `index.html` is opened directly from disk.
From this folder run:

    python -m http.server 8000

Then open `http://localhost:8000`.

## Deploy
Upload the entire folder to GitHub Pages, Cloudflare Pages, Netlify, Vercel, or any ordinary static web host.
No database, server-side code, API key, or build step is required.

## Data
- `data.json`: terminology, domains, definitions, abstract-specific interpretations, source abstracts and contexts.
- The supplied PDF had 57 pages; 49 pages contained detailed numbered abstracts and the other pages were section dividers.


## Feedback submission (v24)
The browser posts terminology suggestions to the same-origin `/api/feedback` Vercel Function. That function forwards the JSON payload server-to-server to the configured Google Apps Script web app, which writes to the Google Sheet. This avoids browser CORS restrictions.

For local testing, use `vercel dev` rather than a simple static server such as `python -m http.server`, because `/api/feedback` is a Vercel Function and does not exist on a plain static localhost server.


## Expertise & Datasets page
Added an ASM-grounded planning page with eight expertise areas and eight dataset opportunities, clickable abstract previews, initial discussion contacts, and confirmation requirements. Accessible from the starting chooser and the relevant navigation menus.

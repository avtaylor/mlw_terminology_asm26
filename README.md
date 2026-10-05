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

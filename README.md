# AI Career Content Generator

Student career kit generator: professional summary, skill-gap report, learning plan and interview prep, with analysis charts.

## Tech stack
HTML + CSS + JavaScript, Chart.js (charts), Google Gemini API (AI text). No backend, no database.

## How it works
1. Student enters skills, interests and career goal.
2. AI builds one master profile (JSON) with role, skill levels and readiness score.
3. Charts are drawn from that JSON.
4. All four text sections are generated from the same master profile, so everything stays consistent.

## Run locally
Open `index.html` in a browser, paste a free Gemini API key (https://aistudio.google.com), click Generate.

## Deploy on GitHub Pages
1. Create a new repository and upload `index.html`, `style.css`, `app.js`, `README.md`.
2. Repository Settings > Pages > Source: `main` branch, `/ (root)` > Save.
3. Open the link GitHub shows after about a minute.

Never put your API key inside the files. Paste it once in the page and keep "Remember my key" ticked; it is stored only in your own browser (localStorage). Untick it on shared computers.
If the model name stops working, change `GEMINI_MODELS` at the top of `app.js`.

## Download report
After generating, click Download report. You get an .html report with charts and all four sections. Open it in a browser and use Print > Save as PDF if you need a PDF.

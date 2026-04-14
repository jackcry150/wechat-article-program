# WeChat Article Local Web App Plan

> Goal: build a local web app where the user enters a公众号文章主题 and optional style fields, then the app generates an article draft plus images, saves everything to a local output directory, and leaves final publishing manual.

## Product scope (MVP)
- Local web app only
- Single user
- Manual publish only; no WeChat automation
- Inputs:
  - topic (required)
  - style (optional)
  - target audience (optional)
  - length (short/medium/long)
  - image count (1-5)
  - include cover image (boolean)
  - extra requirements (optional)
- Outputs saved locally under `output/<timestamp_slug>/`
  - article.md
  - article.html
  - outline.md
  - metadata.json
  - prompts/article_prompt.txt
  - prompts/image_prompt_*.txt
  - images/*.png

## Technical direction
- Next.js app router + TypeScript
- Tailwind for simple UI
- Server-side generation route/actions only; no database
- `.env` should expose all configurable secrets and base URLs
- Use DeerAPI-compatible text model endpoint for article generation
- Use DeerAPI Gemini image generation (`https://api.deerapi.com`) for images
- Save files to local filesystem from the server side

## Required env variables
- DEERAPI_BASE_URL=
- DEERAPI_API_KEY=
- TEXT_MODEL=
- IMAGE_MODEL=
- OUTPUT_DIR=./output

## MVP user flow
1. User fills form and submits
2. Server generates outline
3. Server generates article markdown + simple html
4. Server generates image prompts
5. Server calls DeerAPI image API and decodes base64 image(s)
6. Server writes all files to local output directory
7. UI shows article preview, generated images, and output path

## Implementation notes
- Keep prompt builders in dedicated utility files
- Keep DeerAPI clients isolated in lib modules
- Fail one image gracefully without losing article text
- Save prompts used for each run to local files
- Add a sample `.env.example`
- Add README with run instructions

## Nice-to-have if easy
- “Open output folder” helper text/path
- Regenerate images later (not required if it slows MVP)

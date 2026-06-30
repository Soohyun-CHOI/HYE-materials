# Airtable App

A React web dashboard that uses Airtable as a shared backend.
Includes record read/update/delete, plus a scaffold for uploading a file,
auto-parsing it, and writing the extracted data into Airtable.

## Project structure

```
airtable-app/
├── api/
│   └── parse-file.js       # Serverless function: parse uploaded file, write to Airtable (skeleton, TODOs included)
├── src/
│   ├── components/
│   │   ├── RecordTable.jsx # Table for viewing/editing/deleting records
│   │   └── FileUpload.jsx  # File upload UI
│   ├── lib/
│   │   └── airtable.js     # Airtable REST API helper functions
│   ├── App.jsx
│   └── main.jsx
├── .env.example             # Example environment variables (copy to .env, never commit .env)
├── .gitignore
├── index.html
├── package.json
└── vite.config.js
```

## Initial setup

1. Install dependencies
```bash
npm install
```

2. Configure environment variables
```bash
cp .env .env
```
Open `.env` and fill in your Airtable Base ID, Table name, and PAT token.
(Generate the PAT with `data.records:read`, `data.records:write`, and `schema.bases:read` scopes.)

3. Run locally
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

## Next steps (TODO)

- `api/parse-file.js`: implement the actual file parsing logic (PDF/image OCR, or call an AI API to extract structured data)
- Decide whether authentication/login is needed (currently open to anyone with the URL)
- Deploy to Vercel or Netlify, and set environment variables in that platform's dashboard

## Connecting to GitHub

```bash
git init
git remote add origin https://github.com/{username}/{repo}.git
git add .
git commit -m "Initial commit: Airtable React app scaffold"
git branch -M main
git push -u origin main
```

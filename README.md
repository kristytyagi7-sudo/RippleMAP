# RIPPLEMAP — Exportable Demo Project

A React + Vite frontend with a Node.js/Express API and bundled JSON sample dependency data. It is designed for a college ideathon demonstration.

> **Important:** This is a standalone starter implementation of the RIPPLEMAP concept, not an exact export of the source files behind the published Bolt website. The browser can inspect a user-selected ZIP for JavaScript/TypeScript import links or accept one standalone file. A standalone file cannot show project dependencies. It does not connect to a remote repository, run project code/tests, or modify/delete files.

## Requirements

- Node.js 20.19+ or 22.12+
- npm (included with Node.js)
- Internet access for the first dependency installation; Google Fonts are loaded remotely

## Run locally — one command after setup

1. Extract the ZIP.
2. Open the extracted `RIPPLEMAP-export` folder in VS Code.
3. Open **Terminal → New Terminal**.
4. Run these commands once:

   ```bash
   npm install
   ```

5. Start frontend and backend together with one command:

   ```bash
   npm run dev
   ```

6. Open the Vite URL shown in the terminal, normally `http://127.0.0.1:5173`.

The frontend proxies `/api` requests to the Express API at `http://127.0.0.1:4000`. The API currently serves the bundled sample dataset; uploaded-file scanning happens locally in the browser and is not sent to the API.

## Upload a target file or project

- **Upload one file** opens the computer's file picker and adds that file as the analysis target. Because no surrounding project is provided, the report cannot list dependent files.
- **Upload project folder** uses the browser's folder picker and scans up to 500 JavaScript/TypeScript-family, JSON, and CSS files for relative import/require links.
- **Upload project ZIP** scans the same supported source files from a ZIP archive.
- Folder/ZIP scans skip common generated/dependency folders, reject source files larger than 2 MB, and do not execute code or tests. Other file types can be selected as a standalone target, but are not parsed for content or dependencies.
- A web page can read only files the user explicitly selects; it cannot browse the computer's files without permission.
- Uploads are processed in the browser and are not stored on a server. Anyone who can open the deployed site can use these pickers, subject to browser support and their own device's file permissions.

## How long the website runs

- On your computer, `npm run dev` keeps the site available while both terminal processes are running. Closing the terminal or shutting down the computer stops the local site.
- For continuous public access, deploy the built app and API to a hosting provider. This project does not include a deployment account or hosting configuration, so uptime depends on the provider, plan, and whether its free tier sleeps when idle.
- Production build and API can be started with `npm run build` followed by `npm start`. The site is then served by the API process; the computer/server running that process must remain online.

## Deploy for your team (Render)

This project can run as one Node web service: Express serves both the built frontend and the API. A Render blueprint file (`render.yaml`) is included with the build, start, and health-check settings.

1. Sign in to GitHub and install/open GitHub Desktop.
2. In GitHub Desktop, add this existing project folder as a repository. Keep the repository private if you do not want the source code to be public.
3. Publish the repository to your GitHub account. The root `node_modules/` and `dist/` folders are excluded by `.gitignore`; keep `package.json` and `package-lock.json`.
4. Sign in to Render, choose **New → Blueprint**, connect the GitHub repository, and select its main branch. Render reads the included `render.yaml`.
5. Review the service settings and create the web service. Wait for the first deploy to finish.
6. Open the `https://...onrender.com` URL shown on the Render service page and share that URL with teammates.

The hosting provider keeps the website online; your own computer and VS Code terminal do not need to stay on. Free hosting plans can sleep while idle or have usage limits, so the first visit after inactivity may take longer. Check the provider's current plan and availability before using this for an always-on service.

The page scans selected files locally in each teammate's browser; uploaded project contents are not stored by this app. Folder upload is intended for desktop browsers; on a phone, use the ZIP or single-file picker if the browser offers it. The project scan still supports only the code formats listed above.

## API endpoints

### `GET /api/health`

Returns API status, mode, and timestamp.

### `GET /api/project`

Returns the sample project, files, dependency edges, and supported actions.

### `POST /api/analyze`

Example request:

```json
{
  "action": "delete",
  "targetFile": "config"
}
```

Supported `action` values: `rename`, `modify`, `delete`.

The `targetFile` must be one of the file IDs in `data/project.json`, such as `config`, `app`, `build`, `tests`, `report`, or `deploy`.

The response includes:
- action and target details
- a predefined risk level and score
- files found in the sample dependency map
- dependency edges
- safer alternatives
- a recovery checklist
- a clear sample-data disclaimer

## Build and production preview

```bash
npm run build
npm start
```

After the build, Express serves the generated frontend and API from port 4000. Open `http://127.0.0.1:4000`.

## Folder structure

```text
RIPPLEMAP-export/
├── index.html
├── App.jsx
├── main.jsx
├── styles.css
├── package.json
├── vite.config.js
├── README.md
├── index.js
├── lib/
│   ├── App.jsx
│   ├── analyzer.js
│   └── zipScanner.js
└── data/
    └── project.json
```

## How the sample analysis works

1. The demo UI sends the selected action and target file to `POST /api/analyze`.
2. The Express backend reads the bundled sample project JSON.
3. The analyzer follows dependency edges to find sample files that may depend on the target.
4. Predefined action rules choose a risk indicator and return suggested checks.
5. The UI renders the response and highlights the mapped nodes.

The uploaded ZIP scan runs locally in the browser; it is not wired to the sample-only API. The risk score is illustrative, not a validated security metric. Dependency relationships are limited to relative import/require statements in supported files. Real project health reporting would require language-specific parsers and running project checks in an isolated environment.

## Demo tips for judges

1. Open Action Lab and choose `config.json`.
2. Run **Rename**, then **Analyze Impact**.
3. Run **Delete**, then **Analyze Impact** again.
4. Show how affected-file paths, risk indicators, and recommendations respond.
5. If asked about implementation, show `lib/analyzer.js`, `data/project.json`, and `/api/analyze`.

Be transparent that this is a rule-based sample-data prototype. Do not claim it scans arbitrary repositories yet.

## Troubleshooting

- **`npm` is not recognized:** install Node.js LTS from https://nodejs.org/ and reopen VS Code.
- **Port 5173 is busy:** Vite may print a different port; open the exact URL it prints.
- **API not reachable:** run `npm run dev` from the project root and check that both API and WEB processes started.
- **CSS/build errors:** run `npm install` again and then `npm run build`.

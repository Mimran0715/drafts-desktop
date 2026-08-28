# Repository Guidelines

## Project Structure & Module Organization

`src/` contains the React renderer: application state in `src/App.tsx`, reusable UI in `src/components/`, and shared CSS under `src/`. `electron/` contains the main process, preload bridge, SQLite persistence, and IPC handlers. AI orchestration lives in `electron/ai/`; preserve the `understand -> execute -> respond` graph separation. `eval/` holds model-comparison scripts, reports, and Python tests. Do not edit generated `dist/` files.

## Build, Test, and Development Commands

- `npm run electron:dev` starts Vite and launches the full desktop app.
- `npm run dev` runs only the Vite renderer.
- `npm run lint` checks JavaScript/JSX with ESLint.
- `npm run build` creates the production renderer bundle.
- `npm run electron:build` builds and packages the desktop application.
- `npm run chroma` starts a standalone local Chroma server.
- `python3 -m unittest discover -s eval -p 'test_*.py' -v` runs offline evaluation tests.
- `npm run eval:judge -- --judge-model qwen2.5:14b --trials 2` scores model candidates using Ollama.

## Coding Style & Naming Conventions

Follow existing style: two-space indentation, single quotes, no semicolons, and ES modules. Use PascalCase for React components (`AgentChat.tsx`), camelCase for functions and variables, and `use...` for hooks. Keep IPC channel names explicit. ESLint currently targets JavaScript/JSX; match nearby conventions in `.ts` and `.tsx` files.

## Testing Guidelines

Python tests use `unittest` and follow `eval/test_*.py`. Add deterministic offline tests for evaluator parsing, validation, and aggregation changes. There is no renderer test runner; exercise UI changes through `npm run electron:dev`, including editing, autosave, chat streaming, and suggestions where relevant. Run lint and a production build for code changes.

## Commit & Pull Request Guidelines

Recent history uses short, imperative summaries such as `Fix image source link in README`; scoped prefixes such as `docs:` also appear. Keep commits focused. Pull requests should explain the change, list verification commands, link issues, and include screenshots or recordings for UI work. Highlight changes to configuration, models, Chroma, or database schemas.

## Security & Local Configuration

Keep API keys and machine-specific paths in an untracked `.env`. Never commit LangSmith credentials, user documents, `app.db`, or local Chroma data. Document any new environment variable in `README.md` with a safe default or fallback behavior.

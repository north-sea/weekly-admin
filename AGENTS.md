# Repository Guidelines

## Project Structure & Module Organization
- `src/app`: Next.js routes, API handlers, and layouts.
- `src/components`: reusable UI; prefer domain-based folders (for example, `weekly/Editor`).
- `src/lib`, `src/hooks`, `src/stores`, `src/types`: shared logic, state, and type definitions.
- `prisma/` and `database/`: Prisma schema and SQL migrations.
- `public/`: static assets; `docs/` and `archive/`: documentation and legacy code; `scripts/`: maintenance and migration scripts.

## Build, Test, and Development Commands
- Use `pnpm` in this repo.
- `pnpm dev`: run the app locally at `http://localhost:3000`.
- `pnpm build` / `pnpm start`: production build and start.
- `pnpm lint`, `pnpm lint:fix`, `pnpm type-check`: static analysis and type safety.
- `pnpm test`, `pnpm test:coverage`, `pnpm test:ui`: Vitest unit and integration tests.
- `pnpm db:migrate`, `pnpm db:generate`, `pnpm db:pull`: Prisma schema and database sync.
- `pnpm docker:build`, `pnpm docker:run`: container image and local container runtime.

## Coding Style & Naming Conventions
- TypeScript + React (Next.js App Router); prefer functional components and hooks.
- Use 2-space indentation, single quotes, and named exports where reasonable.
- Component files: PascalCase (for example, `WeeklyEditor.tsx`); hooks: `useX` in `src/hooks`.
- Run `pnpm lint` and `pnpm type-check` before opening a PR.

## Testing Guidelines
- Tests use Vitest with `jsdom` and setup in `src/tests/setup.ts`.
- Place tests near the code (`*.test.ts`, `*.test.tsx`) and keep them fast and deterministic.
- Aim to cover new branches and edge cases; use `pnpm test:coverage` to review.

## Commit & Pull Request Guidelines
- Prefer Conventional Commits style: `feat(scope): summary`, `fix(scope): summary`, and similar.
- Keep PRs focused; include a clear description, screenshots or GIFs for UI changes, and linked issues.
- Ensure `pnpm lint`, `pnpm type-check`, `pnpm test`, and `pnpm build` all succeed before requesting review.

## Agent-Specific Instructions
- When modifying code, keep changes minimal, aligned with existing patterns, and covered by tests.
- Do not reformat unrelated files or introduce new tools without explicit instruction.


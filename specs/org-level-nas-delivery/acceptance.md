# Acceptance Record: Org-Level NAS Delivery

**Workspace**: `org-level-nas-delivery`  
**Started**: 2026-06-03  
**Status**: In Progress

---

## Phase 0 Baseline

### GitHub CLI / Org Access

- `gh auth status`: logged in as `NorthSeacoder`.
- Token scopes visible from `gh auth status`: `admin:org`, `admin:public_key`, `gist`, `repo`, `workflow`, `write:packages`.
- `north-sea` membership: active, role `admin`.

### Repository Baseline

| Repo | Owner Before | Visibility | Default Branch | Local Origin | Latest Run |
|------|--------------|------------|----------------|--------------|------------|
| weekly-admin | `NorthSeacoder/weekly-admin` | public | `main` | `git@github.com:NorthSeacoder/weekly-admin.git` | `Build and Deploy to NAS` run `26860799512`, status `queued`, event `push`, created `2026-06-03T02:52:54Z` |
| mcps | `NorthSeacoder/mcps` | public | `main` | `git@github.com:NorthSeacoder/mcps.git` | `MCP Release` run `26833195004`, status `completed`, conclusion `success`, branch `hermes-db-v0.2.7` |
| agents | `NorthSeacoder/agents` | private | `main` | `git@github.com:NorthSeacoder/agents.git` | `github_actions in /. - Update #1393744554` run `26808524802`, status `completed`, conclusion `success`, branch `main` |

### GitHub Actions Org Baseline

- `north-sea` runner groups: only `Default` exists.
- `Default` runner group visibility: `all`, `allows_public_repositories=false`.
- `nas-deploy` runner group: not present yet.

### NAS Baseline

Existing repo-level runner processes:

- `/vol1/1000/Docker/github-actions-runner/mcps`
- `/vol1/1000/Docker/github-actions-runner/agents`

No `weekly-admin` runner process or runner directory was found in `/vol1/1000/Docker/github-actions-runner`.

Existing deployment containers:

| Container | Image | Status |
|-----------|-------|--------|
| `hermes-db-mcp` | `ghcr.io/northseacoder/hermes-db-mcp:v0.2.7` | Up |
| `wechat-mcp-server` | `ghcr.io/northseacoder/wechat-mcp-server:v0.1.5` | Up, healthy |

Weekly-admin NAS deployment directory/container:

- `/volume1/docker/weekly-admin`: not found.
- `/vol1/1000/Docker/weekly-admin`: not found.

### Baseline Interpretation

- `weekly-admin` deploy is queued because no matching NAS runner exists for its current repo-specific label.
- `mcps` and `agents` currently depend on repo-specific runner directories and old `ghcr.io/northseacoder/...` image namespace.
- The first execution target is creating org-level runner infrastructure before moving `weekly-admin`.

---

## Phase 1 Org Actions Infrastructure

### Runner Group

- Created `north-sea` org runner group `nas-deploy`.
- Runner group ID: `3`.
- Visibility: `selected`.
- `allows_public_repositories`: `false`.

### Org Runner

- Registered NAS runner directory: `/vol1/1000/Docker/github-actions-runner/org-nas-deploy`.
- Runner name: `nas-org-deploy`.
- Runner version: `2.334.0`.
- Runner labels from GitHub API: `self-hosted`, `Linux`, `X64`, `nas`, `deploy`.
- Runner status from GitHub API: `online`.
- Runner log status: `Listening for Jobs`.

### Token / Package Strategy

- Existing `north-sea` org Actions secrets: none.
- Existing `north-sea` container packages: none.
- Existing `NorthSeacoder` user container packages:
  - `weekly-admin`, public.
  - `hermes-db-mcp`, public.
  - `wechat-mcp-server`, public.
- Initial strategy: do not create PAT-backed `GHCR_TOKEN` yet. After each repository is migrated, publish to `ghcr.io/north-sea/...` using that repository workflow's `GITHUB_TOKEN`; if build push, package access, or NAS pull fails, create an org-level selected-repository `GHCR_TOKEN`.

---

## Phase 2 Weekly-Admin Setup

### Repository Transfer

- `weekly-admin` transferred from `NorthSeacoder/weekly-admin` to `north-sea/weekly-admin`.
- `gh api repos/north-sea/weekly-admin` confirms:
  - `full_name`: `north-sea/weekly-admin`
  - `visibility`: `public`
  - `default_branch`: `main`
  - current token permissions include admin access.
- Local origin updated to `git@github.com:north-sea/weekly-admin.git`.

### Runner Authorization

- `north-sea/weekly-admin` repository ID: `1094620329`.
- Added repository ID `1094620329` to `nas-deploy` runner group selected repositories.
- Runner group selected repositories now includes `north-sea/weekly-admin`.

### Workflow / Docs Update

- `.github/workflows/deploy.yml` deploy job now uses `runs-on: [self-hosted, nas, deploy]`.
- Compose deploy path now writes `.weekly-admin-release.override.yml` and runs `docker compose` with both the base file and override file, so the actual deployed image is forced to the workflow image ref.
- `docs/nas-deployment.md` now documents org-level runner registration and `ghcr.io/north-sea/weekly-admin`.
- Validation:
  - Workflow YAML parsed successfully with Ruby YAML.
  - `pnpm type-check` passed.
  - Search found no remaining `weekly-admin-deploy`, `your-username`, `GHCR_TOKEN ||`, or `northseacoder/weekly-admin` in workflow/docs.

### NAS Deploy Directory

- First attempt to use `/volume1/docker/weekly-admin` failed because `/volume1` is not writable/available on this NAS.
- Actual deploy directory created: `/vol1/1000/Docker/weekly-admin`.
- `north-sea/weekly-admin` repository variable `NAS_DEPLOY_DIR` set to `/vol1/1000/Docker/weekly-admin`.
- `.env` copied from local working tree to NAS deploy directory and permissions set to `600`.
- `docker-compose.yml` created in NAS deploy directory.
- Compose image verification: `docker compose config | grep -F "image: ghcr.io/north-sea/weekly-admin:latest"` succeeded.

### Security Note

- During compose verification, `docker compose config` expanded `.env` values into command output. Do not use full `docker compose config` for future evidence collection; only grep non-secret fields such as the image line.
- Because secret values were exposed in tool output during this session, rotate production secrets after the migration, especially API keys and shared service tokens.

### Iteration Notes

- First deployed image failed with `/app/docker-entrypoint.sh: not found`; fixed by changing the Dockerfile to start standalone Next.js directly with `CMD ["node", "server.js"]`.
- Second deployed image started Next.js but failed Prisma engine resolution for Alpine; fixed by adding `linux-musl-openssl-3.0.x` to `prisma/schema.prisma` binary targets.
- Third deployed image started Next.js and loaded Prisma correctly, but `/api/health` timed out because the container was not attached to the MySQL container network and `DATABASE_URL` pointed to an unreachable Tailscale IP.
- NAS deploy config was updated:
  - `.env` was backed up before edits.
  - DB host changed from the unreachable IP to `mysql`.
  - `docker-compose.yml` now attaches `weekly-admin` to external `1panel-network`.
- Workflow health checks now use `curl --max-time 5` so a hung health endpoint does not occupy the single NAS runner indefinitely.
- `/api/health` currently returns HTTP 200 with `overall=degraded` when Meilisearch is unreachable, but it can take close to 10 seconds because the search backend attempt waits before degrading. Workflow health check timeout was adjusted to 20 seconds to match the current endpoint behavior.

### Weekly-Admin Final Evidence

- Successful Actions run: `26864142208`.
- Successful commit SHA: `df93aae1e1a7f23890e749af946be197d0fdc100`.
- Build job: success.
- Deploy job: success.
- GHCR package: `ghcr.io/north-sea/weekly-admin`.
- Latest package tags after success: `latest`, `sha-df93aae`.
- NAS container:
  - name: `weekly-admin`
  - image: `ghcr.io/north-sea/weekly-admin:latest`
  - status: `healthy`
  - network: `1panel-network`
- Health endpoint:
  - URL: `http://localhost:3000/api/health` from NAS
  - HTTP status: `200`
  - overall: `degraded`
  - database: `healthy`
  - search/Meilisearch: degraded because `100.113.231.101:7700` is not reachable from the container.

### Weekly-Admin Verdict

`weekly-admin` migration/build/deploy is accepted for this feature. The service is running on NAS from the org GHCR namespace using the org-level NAS runner. Meilisearch remains degraded and should be treated as a follow-up configuration task, not a blocker for this feature because the spec accepts expected degraded health.

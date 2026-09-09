# 🏆 Archivaments

[![CI](https://github.com/ToziGar/Archivaments/actions/workflows/ci.yml/badge.svg)](https://github.com/ToziGar/Archivaments/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D20.6-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

A zero-dependency CLI that unlocks the GitHub achievements that **can** be automated, inside a public sandbox repository you own.

It talks to the GitHub REST API directly. No `gh`, no `git`, no `npm install` — just Node 20.6+.

> 🇪🇸 [Léeme en español](README.es.md)

---

## What it actually unlocks

| Achievement | Automatable | Command | Tiers |
|---|---|---|---|
| **Quickdraw** | ✅ Yes | `quickdraw` | one-time |
| **YOLO** | ✅ Yes | `yolo` | one-time |
| **Pull Shark** | ✅ Yes | `pull-shark` | 2 / 16 / 128 / 1024 |
| **Pair Extraordinaire** | ✅ Yes\* | `pair --with <user>` | 1 / 10 / 24 / 48 |
| **Galaxy Brain** | ❌ No | `guide` | 2 / 8 / 16 / 32 |
| **Starstruck** | ❌ No | `guide` | 16 / 128 / 512 / 4096 |
| **Public Sponsor** | ❌ No | `guide` | one-time |
| **Arctic Code Vault** | ⛔ Retired | — | — |

\* Requires a second real GitHub account for the `Co-authored-by` trailer.

The four it won't do are not an oversight. **Public Sponsor** needs a real payment, and **Galaxy Brain** and **Starstruck** depend on other people accepting your answers or starring your work. Faking those with sock puppets gets accounts suspended. `archivaments guide` explains how to earn them legitimately instead.

---

## Setup

```bash
git clone https://github.com/ToziGar/Archivaments.git
cd Archivaments
cp .env.example .env     # then paste your token into GITHUB_TOKEN
npm run doctor
```

Create a **classic token** at <https://github.com/settings/tokens/new> with the **`repo`** scope. `.env` is gitignored, so it never leaves your machine.

The token is also read from `GITHUB_TOKEN` / `GH_TOKEN`, from `--token`, or from `gh auth token` if you have the GitHub CLI signed in.

There is no `npm install` — the project has no dependencies.

---

## Usage

Always look before you leap:

```bash
node bin/archivaments.js all --with your-other-account --dry-run
```

Then run it for real:

```bash
node bin/archivaments.js all --with your-other-account
```

That creates the public `archivaments-lab` repository and unlocks **Quickdraw**, **Pair Extraordinaire**, **YOLO** and **Pull Shark** in a couple of minutes.

### Individual commands

```bash
node bin/archivaments.js quickdraw                    # open and close an issue
node bin/archivaments.js yolo                         # merge a PR with no review
node bin/archivaments.js pair --with user1,user2      # co-authored commit
node bin/archivaments.js pull-shark --tier bronce     # reach 16 merged PRs
node bin/archivaments.js pull-shark --target 128     # reach an exact total
node bin/archivaments.js status                       # real progress
node bin/archivaments.js guide                        # the manual achievements
```

### Options

| Flag | Purpose |
|---|---|
| `--dry-run` | Print every call without sending it |
| `--yes` | Skip the confirmation prompt |
| `--target <n>` | Total merged PRs to reach; creates only what's missing |
| `--tier <name>` | `base` / `bronce` / `plata` / `oro` (same as `--target`) |
| `--fresh` | Ignore a previous run's checkpoint |
| `--repo <name>` | Sandbox repository (default `archivaments-lab`) |
| `--delay <ms>` | Spacing between writes (default 1200) |
| `--merge-method` | `merge` (default), `squash` or `rebase` |
| `--verbose` | Log every API request |

---

## Why other scripts fail

Three reasons homegrown attempts unlock nothing, all handled here:

**1. Pair Extraordinaire doesn't count for commits pushed straight to `main`.**
The achievement is *"coauthored commits on merged pull request"*. The co-authored commit has to land through a **merged pull request**, so `pair` does branch → commit → PR → merge instead of a direct push.

**2. The co-author's email must be their exact noreply address.**
The format is `<id>+<login>@users.noreply.github.com`, where `<id>` is the account's numeric ID. Make it up and GitHub links the commit to nobody, so nothing counts. The CLI resolves the ID through the API before writing the trailer.

**3. Squash merges throw the trailers away.**
A squash rewrites the commit message — exactly where `Co-authored-by` lives. That's why the default merge method is `merge`.

Plus two settings people miss:

- **The repository must be public.** Private activity doesn't count. The CLI creates the sandbox as public and aborts if it finds a private one.
- **Turn on "Show Achievements on my profile"** at <https://github.com/settings/profile>, or you'll never see them.

Achievements take **minutes to hours** to show up. Don't run things twice assuming they failed.

---

## Rate limits

Each pull request is 5 requests (branch, commit, PR, merge, plus reading the head). GitHub caps you at roughly **80 content-creating requests per minute** and **5000 requests per hour**.

A run to Pull Shark gold is about 5100 requests, so it *will* exceed the hourly quota. The client handles this: it spaces writes, pauses until the quota resets, honours `Retry-After`, and checkpoints every 10 PRs so an interrupted run resumes where it stopped.

| Tier | PRs | Rough wall time |
|---|---|---|
| base | 2 | seconds |
| bronce | 16 | ~1.5 min |
| plata | 128 | ~11 min |
| oro | 1024 | ~85 min + one quota pause |

---

## Layout

```
bin/archivaments.js     entry point
src/cli.js              argument parsing and dispatch
src/github.js           REST client (throttling, retries, readable errors)
src/lab.js              branch → commit → PR → merge cycle
src/config.js           token resolution, defaults, tier tables
src/state.js            local history and run checkpoints
src/log.js              console output
src/commands/           one file per command
test/                   node:test suite, no test framework needed
docs/logros.md          per-achievement reference (Spanish)
```

```bash
npm test
```

---

## A note on all this

GitHub achievements are cosmetic and don't affect your contribution graph. Earning them in a sandbox repository you own is common practice and doesn't break the Terms of Service. **Creating fake accounts** for stars, sponsorships or accepted answers does, and will get you suspended. This project deliberately refuses to do any of that.

## License

MIT

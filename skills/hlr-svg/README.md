# hlr-svg agent skill

An [Agent Skill](https://agentskills.io) that lets Claude Code, Codex, Cursor and other coding agents draw 3D solids as clean SVG line drawings, with hidden edges dashed. The agent writes a small JSON scene and runs one Node command; the [hlr](https://github.com/jiwonMe/hlr-svg) library, bundled in this folder, computes exactly which parts are hidden.

```text
/hlr-svg draw a cube ABCD-EFGH with the space diagonal AG, vertices labelled
```

Requirements: Node.js 20 or later. Nothing to `npm install`, no API keys.

## Install

The skill is the folder `skills/hlr-svg` of the [jiwonMe/hlr-svg](https://github.com/jiwonMe/hlr-svg) repository: `SKILL.md`, `scripts/`, `references/` and `examples/`. Every method below puts that folder where the agent looks for skills.

### With the `skills` CLI (any agent)

The [`skills`](https://github.com/vercel-labs/skills) CLI finds the skill in the repository and installs it for the agents you name. It needs Node.js 22.20 or later; everything else here works on Node 20.

| Agent       | For you (all projects)                             | For one project (run in the project)            |
| ----------- | -------------------------------------------------- | ----------------------------------------------- |
| Claude Code | `npx skills add jiwonMe/hlr-svg -g -a claude-code` | `npx skills add jiwonMe/hlr-svg -a claude-code` |
| Codex       | `npx skills add jiwonMe/hlr-svg -g -a codex`       | `npx skills add jiwonMe/hlr-svg -a codex`       |
| Cursor      | `npx skills add jiwonMe/hlr-svg -g -a cursor`      | `npx skills add jiwonMe/hlr-svg -a cursor`      |

Claude Code gets `~/.claude/skills/hlr-svg` (or `.claude/skills/hlr-svg`). Codex and Cursor share the open standard folder, `~/.agents/skills/hlr-svg` (or `.agents/skills/hlr-svg`). Add `--copy` to copy files instead of symlinking them, and `-y` to skip the prompts. Commit a project install so your team gets it too.

### With one line, no CLI

Download the repository and unpack just the skill folder. Pick the target folder for your agent:

| Agent       | For you                                                                      | For one project                                      |
| ----------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| Claude Code | `~/.claude/skills/hlr-svg`                                                   | `.claude/skills/hlr-svg`                             |
| Codex       | `~/.agents/skills/hlr-svg` (older Codex releases: `~/.codex/skills/hlr-svg`) | `.agents/skills/hlr-svg`                             |
| Cursor      | `~/.cursor/skills/hlr-svg`                                                   | `.cursor/skills/hlr-svg` or `.agents/skills/hlr-svg` |

```sh
DEST=~/.claude/skills/hlr-svg   # or a folder from the table
mkdir -p "$DEST" && curl -L https://github.com/jiwonMe/hlr-svg/archive/refs/heads/main.tar.gz \
  | tar -xz --strip-components=3 -C "$DEST" hlr-svg-main/skills/hlr-svg
```

Or with git, keeping a checkout you can `git pull` later:

```sh
git clone --depth 1 https://github.com/jiwonMe/hlr-svg.git ~/src/hlr-svg
ln -s ~/src/hlr-svg/skills/hlr-svg ~/.claude/skills/hlr-svg   # or a folder from the table
```

Claude Code picks up new skills in a running session; if the `skills` folder did not exist when the session started, run `/reload-skills` or restart. Codex and Cursor read skills when a session starts, so open a new one.

### Agents without skill support: `AGENTS.md` or a Cursor rule

An agent that reads `AGENTS.md` (Codex, Cursor, and many others) can use the skill without skill support. Put the folder anywhere in the project, for example `tools/hlr-svg`, and add:

```markdown
## 3D line drawings

To draw 3D solids (geometry figures, technical sketches) as SVG with hidden lines dashed,
read `tools/hlr-svg/SKILL.md` and follow it. Render with
`node tools/hlr-svg/scripts/render.mjs scene.json -o figure.svg`.
```

For a Cursor project rule instead, save this as `.cursor/rules/hlr-svg.mdc`:

```markdown
---
description: Draw 3D solids, geometry figures or technical sketches as SVG line drawings with hidden lines dashed
alwaysApply: false
---

Read `tools/hlr-svg/SKILL.md` and follow it. Render with
`node tools/hlr-svg/scripts/render.mjs scene.json -o figure.svg`.
```

## Usage

Ask for a figure; you do not have to name the skill.

```text
/hlr-svg a sphere cut by a horizontal plane, with the centre O and the section centre O′ labelled
```

```text
Draw a cone piercing a cylinder for my blog post, as an SVG with the hidden parts dashed.
```

```text
A worksheet figure: square pyramid O-ABCD with its height OH, textbook style.
```

Or run the renderer yourself:

```sh
node scripts/render.mjs examples/cube-diagonal.json -o cube.svg
```

## What is in the folder

| Path                         | What it is                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `SKILL.md`                   | What the agent reads: when to use the skill, the workflow and the rules for clean figures.          |
| `scripts/render.mjs`         | The renderer: JSON scene in, SVG out. Only Node built-ins.                                          |
| `scripts/hlr.mjs`            | The `hlr` library bundled into one file (generated from `src/` by `pnpm skill:build`; do not edit). |
| `references/scene-format.md` | Every key of the scene format.                                                                      |
| `references/recipes.md`      | Ready-made scenes for common figures, and fixes.                                                    |
| `references/library-api.md`  | The TypeScript API, for using the library directly.                                                 |
| `examples/*.json`            | Scenes that render as they are.                                                                     |

## Development

In the repository root: `pnpm skill:build` regenerates `scripts/hlr.mjs` after a change in `src/`, `pnpm skill:check` fails if it is stale (it runs in `pnpm check`), and `pnpm test` renders every example and every scene in the docs.

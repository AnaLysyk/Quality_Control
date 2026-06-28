# Brain Architecture Roadmap

## Status

Base scaffold created for the modular Brain evolution. The detailed product PRD now lives in `docs/brain/brain-knowledge-platform-prd.md`.

## What exists today

- Graph, memory, orchestration and sync layers already exist.
- The Brain page already exposes graph views, pending items and agent entry points.
- Existing APIs cover asking the Brain, syncing the graph and reading memories.

## What this scaffold adds

- A typed screen registry for auto-documenting screens.
- A typed screen context model for route/module/company/item awareness.
- A shared agent contract so future capabilities can grow without scattering rules.
- A Brain Graph taxonomy for products, node types, edge types, colors and filters.
- Permission profile nodes connected to users and RBAC actions during Brain sync.

## Next phases

1. Register the main admin screens in the registry.
2. Feed route context into the Brain assistant entry points.
3. Enrich the Brain Graph side panel by node type.
4. Add memory and document adapters behind stable interfaces.
5. Move tool execution into a dedicated action registry.
6. Add RAG adapters for markdown, OpenAPI and future knowledge sources.

## Notes

- This is intentionally incremental.
- Existing behavior should remain unchanged until each phase is wired and tested.

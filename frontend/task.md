# Tasks — Kaboom V6.6 Zero Information Loss responsive Layout Engine

- `[x]` **Phase 1: Floating Elements & Stacking Context Refactor**
  - `[x]` Refactor `FloatingLayoutContext.tsx` to handle flat `FloatingComponent` layout contracts and numerical geometry-driven reflow (no named modes).
  - `[x]` Adjust `ChatPage.tsx` overlay layering so the searching container sits at `zIndex: 75` (above GestureLayer).
  - `[x]` Update controls dock BC mobile coordinates to return `left: 0; bottom: 0; width: 100%; transform: none` to avoid containing block bugs.
- `[x]` **Phase 2: Searching Animation Separation**
  - `[x]` Remove the `<QueueCard>` from `SearchingAnimation.tsx` and strip it of all business logic.
  - `[x]` Render `QueueCard` directly inside `ChatPage.tsx` at the root stacking context using `getStyle('queue-card')`.
- `[x]` **Phase 3: Component Sizing Decoupling**
  - `[x]` Remove viewport-specific branching and layout modes inside `QueueCard.tsx`.
  - `[x]` Refactor elements to size and wrap using CSS Container Queries and relative flex sizes.
  - `[x]` Consistently register the controls dock in layout context on all viewports (`AdaptiveControlsDock.tsx`).
- `[x]` **Phase 4: Verification & Regression Matrix**
  - `[x]` Run build checks (`npx tsc --noEmit` and `npm run build`).
  - `[x]` Verify WebRTC, matchmaking states, and layout assertions.

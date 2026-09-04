# Dynamic per-slide overlay controls

Owner: EloPhanto
Due: 2026-09-04
Status: In progress

## Definition of done

A reviewer can independently change each slide's text position, horizontal/vertical offsets, background visibility/opacity/padding, and text sizing; see the preview recompose; observe approval invalidation; export PNGs that use the same settings; and run the full test suite plus production build without failures.

## Work

1. Extend compositor geometry with normalized, boundary-clamped per-slide overlay settings.
2. Add accessible per-slide controls and local recomposition without another image API call.
3. Include overlay settings in render freshness so every change invalidates approval and blocks stale exports.
4. Test geometry, invalidation, preview/export propagation, and UI controls.
5. Run full tests and production build, then inspect the diff.

## Risks

| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---:|---:|---|---|
| Rapid slider changes resolve out of order | Medium | High | Per-slide render generation tokens reject stale async results | EloPhanto |
| Text or background leaves TikTok-safe bounds | Medium | High | Clamp normalized geometry and test extremes | EloPhanto |
| Preview and ZIP differ | Low | High | Export the exact composed blob shown in preview and freshness-key overlay state | EloPhanto |
| Existing layout presets regress | Medium | Medium | Defaults preserve automatic preset behavior; run full suite | EloPhanto |

## Dependencies

- Existing browser Canvas and JSZip implementations: acknowledged by current application and tests.
- OpenRouter image generation: not needed for local overlay recomposition; live provider validation remains pending and is outside this change.
- External coding agent: unavailable because only Claude Code is installed; direct implementation selected, acknowledged by EloPhanto.

## Success criteria

- 100% of slides expose all requested controls.
- 100% of overlay changes invalidate that slide's approval.
- All geometry extreme-value tests remain inside the safe area.
- Full automated suite: zero failures.
- Production build: exit code 0.

## Kill switch / rollback

Stop and revert this change if existing default renders cannot remain compatible, if safe-area clamping cannot be proven in tests, or if the full suite/build cannot be returned to zero failures without unrelated scope expansion. Git provides the rollback boundary.

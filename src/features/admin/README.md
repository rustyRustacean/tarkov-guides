# Admin CMS

Dev-only content authoring for rotation guides (Maps feature) and tutorials (Tutorials feature). Sequenced last since it depends on both of those data models existing first. See migration plan Phase 7.

**Ported from:**

- `old/tarkov-tips/src/app/admin/rotations/*`, `src/app/admin/tutorials/*` - rotation/tutorial CRUD pages
- `old/tarkov-tips/src/components/admin/ImageUploader.tsx`, `MapMarkerPicker.tsx`, `StepBuilder.tsx` - rewrite cleanly. Note: `ImageUploader.tsx` here is unrelated to the OCR-excluded `ImageUpload.tsx`/`UploadZone.tsx` in the legacy repo despite similar naming - don't confuse them.

**Decision needed before implementation:** keep dev-only (gated by environment, no public auth in the legacy version) unless there's a concrete reason to expose content authoring publicly. Recommendation per migration plan: dev-only.

**Status:** not yet implemented (Phase 7).

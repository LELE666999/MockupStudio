# Reference studios refinement

Visual thesis: a closely framed real handset against restrained physical surfaces—fine embossed blue metal and purple satin, or glossy welded chrome tubes in a distant real photographic studio.

Content plan: retain the existing Environment → Scene workflow; use actual rendered scene thumbnails, the existing camera inspector, and existing colour controls. Each scene has a single strong composition, with no additional editor chrome.

Interaction thesis: native camera orbit and saved camera poses; phone/media edits remain independent; background and light-colour changes are live and survive full project archives. Cached geometry and filtered maps must not regenerate during orbit.

Quality gates:

- Replace the blue tray's Cartesian channel tessellation with continuous capsule-aligned topology and analytic smooth normals. Fine embossing must not look like a coarse grid, and large coloured softboxes must create distinct cavity highlights.
- Build the chrome rack from continuous cylindrical rods with actual holes and tangent welded crossings, not a flat wire texture.
- The user rejected the hand-held scene: remove its card, runtime, and asset. Read old archives without losing models/media/keyframes.
- Chrome reflections use Poly Haven's CC0 Brown Photostudio 01 HDR (2K, locally bundled). The same equirectangular scene forms the softly blurred distant background, rotating naturally with the camera. No opaque colour plane is placed beneath the rack. Only a distant transparent shadow receiver remains.
- Inspect actual offline renders alongside the supplied references. Verify project save/reopen, colour edits, image/video screen replacement, no-scene return, and video export without affecting the user's browser draft.

Implemented and checked (2026-10-04):

- Hand scene, GLB, thumbnail, and preparation script removed from the app; source moved recoverably to macOS Trash. Old archives disable only the retired scene. Old chrome archives drop only the obsolete warm-floor prop.
- HDR background direction, background blur, and lighting intensity are independent controls stored in the full project. Custom image/video/colour/transparent backgrounds are respected; HDR lighting remains available to the chrome.
- Real offline Playwright checks: actual imported iPhone with screen image/video, native HDR dimensions/range, matching environment/background rotation, camera pitch changes without moving models, unchanged rod geometry through lighting edits, archive reopening, export, no page errors, and no external HTTP requests. Separate browser context: no user draft mutation.
- Native chrome topology is a single indexed cylindrical-rod draw. Blue tray channels and rounded capsule ends use continuous topology and analytic normals. Texture mip filtering and cached geometry are retained while orbiting.

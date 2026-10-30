# OzaBay Custom Studio — Live Preview Update

The custom builder now behaves like a visual configurator rather than a static form.

## What changed
- Live preview updates immediately when form, material, finish, size or tone changes.
- Form choices swap the base preview image (Vessel / Bowl / Lamp / Planter).
- Material applies visual treatment for Clay, Stoneware, Brass and Wood.
- Finish applies Natural, Speckled, Indigo or Hand-painted visual treatments.
- Tone changes the preview environment.
- Size changes the displayed product scale.
- Engraving is shown directly on the preview.
- Preview supports drag-to-inspect, scroll zoom, +/− zoom and reset.
- Live configuration summary and estimated price remain visible.
- Added a clear 01 Choose → 02 Customize → 03 Review → 04 Request flow.
- Added a note that the preview is a visual concept and handmade variation is expected.

This is still frontend-first. No backend or production 3D asset pipeline is connected.

For a production-grade version, replace the image-based preview with real GLB/glTF models and material maps. Real-time 3D configurators commonly use this model/variant approach so customers see the exact configured material, color and size before ordering. See references: VULK, Kickflip, Vieweri and Alter Product.

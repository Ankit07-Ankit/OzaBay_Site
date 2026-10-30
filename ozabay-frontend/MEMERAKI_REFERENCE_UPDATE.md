# OzaBay — MeMeraki Reference Function Update

This update is applied to the uploaded `ozabay-frontend-main(2)` project so the existing product photography and OzaBay visual identity remain intact.

## Preserved
- Existing `public/images` product catalogue and filenames.
- Existing navy / cream / gold visual system.
- Existing Navbar, Hero, product cards, cart, wishlist, custom studio, gift builder, artisan stories, journal and checkout/tracking UI.
- Frontend-only architecture; no backend/API/payment integration added.

## Added / upgraded
- Collections mega-menu in the desktop navigation.
- Discovery hub inspired by modern craft marketplaces:
  - Shop by craft
  - Popular moods/themes
  - Shop by price
  - Explore by place
- Recently viewed products persisted with localStorage.
- Curated editorial collection edits.
- Craft-region exploration section.
- OzaBay trust / marketplace promise strip.
- Price-band filtering connected to the existing product catalogue.
- Generated OzaBay 3D hero video added at `public/videos/ozabay-3d-hero.mp4` and used as the first Hero slide with the existing image as poster/fallback.

## Reference-derived patterns
The reference site was reviewed for navigation and discovery patterns such as recently viewed, popular themes, top artists/artforms, shop-by-price, curated collections, regional discovery, and marketplace trust information. These patterns were adapted to OzaBay rather than copied visually.

Reference: https://www.memeraki.com/

## Important catalogue note
The uploaded project currently contains image-backed product groups for:
- Ceramics
- Blue Pottery
- Terracotta
- Textiles
- Woodcraft
- Metalcraft
- Home Décor

The update does not invent Jewellery or Art & Collectibles products because those images/data are not present in this uploaded project. They can be added later without changing the discovery architecture.

## Verification
A full Vite production build could not be completed in this execution environment because dependency installation timed out. The source was patched directly in the uploaded project and the updated project is packaged below. Run locally:

```bash
npm install
npm run build
```

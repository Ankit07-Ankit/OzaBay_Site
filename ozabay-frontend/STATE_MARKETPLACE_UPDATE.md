# State-specific Craft Marketplace Update

- State craft actions now open a dedicated URL under `/crafts/<state-slug>` rather than scrolling to the general marketplace.
- Each state page only displays entries associated with the selected state; craft chips narrow the page to one listed tradition.
- Product quick detail, wishlist, and add-to-bag interactions reuse the existing frontend flows.
- Browser back/forward updates the rendered route. Direct routes are supported by Vite's SPA fallback.
- Added editorial state-page styling, restrained 3D perspective, hover lift, image sheen, staggered entrance and reduced-motion support.
- Regional listings currently reuse the project's existing product photography and are frontend catalogue entries; dedicated authentic product inventory/photos should replace representative mappings before production.

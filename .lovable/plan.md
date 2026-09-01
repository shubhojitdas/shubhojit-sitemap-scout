# SEO Sitemap Scout landing-page overhaul

## Direction
Build the selected **Midnight Professional Editorial** direction using the locked **Navy & Ice** palette, **Space Grotesk + DM Sans**, and a **staggered masonry** composition.

The current homepage already tells the right product story, but its repeated bordered cards, uniform grids, lime-led styling, and generic dashboard mockup make the experience feel template-driven. The redesign will keep the useful content and routes while replacing that presentation with a more deliberate product narrative inspired by the supplied references.

## What will change

1. **Top navigation**
   - Restyle the homepage header into a crisp, top-mounted editorial navigation inspired by the Awwwards reference.
   - Keep all current destinations, theme control, LinkedIn link, and crawler CTA functional.
   - Scope the new treatment to the landing route so the working crawler header remains familiar.

2. **Hero and primary action**
   - Recompose the hero around a strong technical-SEO statement, concise supporting copy, and a high-emphasis animated crawler CTA.
   - Adapt the Generate Button reference into a directional “Start crawling” interaction rather than adding a non-functional URL field.
   - Put credible crawl output in the first viewport through a refined product-stage visualization rather than a generic browser mockup.

3. **Product story and visual proof**
   - Turn the problem narrative into staggered editorial modules with varied scale and hierarchy.
   - Add a circular crawl-map visualization inspired by the Circular Gallery reference, using real product concepts such as indexed pages, redirects, orphan pages, and metadata health.
   - Use layered/stacked interface fragments inspired by Verse Cards to demonstrate prioritization, audit evidence, and export-ready findings.

4. **Capabilities masonry**
   - Rebuild the capabilities section as a true staggered grid with distinct module proportions, fewer repeated card treatments, and embedded mini-visualizations.
   - Preserve the existing feature claims: metadata extraction, link graphs, duplicates, link equity, redirects, AI insights, and exports.

5. **Workflow, trust, and conversion**
   - Present the three-step workflow as a connected visual sequence instead of three equal cards.
   - Adapt the Stacked Logos idea into a restrained compatibility/input-format strip without inventing customer endorsements.
   - Finish with a focused CTA and retain the existing maker attribution and links.

6. **Motion and responsiveness**
   - Use Framer Motion for staggered section entrances, subtle depth/parallax, active-card emphasis, and precise hover/press feedback.
   - Keep motion restrained, avoid decorative blobs and excessive glow, and fully respect reduced-motion preferences.
   - Recompose the masonry and visualizations for mobile so text, controls, and diagrams never overlap.

## Technical implementation

- Rewrite the landing composition in `src/pages/Landing.tsx` using small local visual components and the existing Button component.
- Add landing-scoped semantic tokens and utilities in `src/index.css`; do not replace the crawler/report theme globally.
- Add Space Grotesk and DM Sans through the document head font links, and update Tailwind font families to semantic heading/body stacks.
- Add a homepage-specific state/class in `src/components/AppHeader.tsx` only where needed for the new top navigation treatment.
- Keep `/app`, crawl state, quick tools, exports, report views, and all backend behavior unchanged.

## Validation

- Verify the homepage at desktop and mobile widths with browser screenshots.
- Check all CTA/navigation links, theme behavior, reduced-motion handling, responsive masonry, text wrapping, and absence of horizontal overflow.
- Confirm `/app` still opens at the top and its outcome-page layout has not changed.

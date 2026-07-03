## 1. CMS WYSIWYG (TipTap)

Replace the current `RichTextArea` (textarea + HTML tag injection) with a true contenteditable TipTap editor. Storage stays as HTML strings in `about_paragraphs` — fully backward compatible with existing content.

**Install:** `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-image`, `@tiptap/extension-underline`, `@tiptap/extension-table` (+ row/cell/header), `@tiptap/extension-placeholder`, `@tiptap/extension-code-block-lowlight`, `lowlight`.

**New component:** `src/components/cms/WysiwygEditor.tsx`
- Sticky toolbar: Bold, Italic, Underline, Strike, H2, H3, Bullet list, Ordered list, Blockquote, Code block, Link (prompt), Image (upload to `profile-images` bucket, insert URL), Table (insert 3×3, add row/col, delete), Undo/Redo, Clear formatting.
- Keyboard shortcuts (Ctrl/Cmd + B/I/U/K).
- Styled with existing theme (green accent, glass panel).

**Wire-up:** `CmsProfileEditor`, `CmsExperienceEditor` (achievements), `CmsFeaturedPostsEditor` — replace every `<RichTextArea>` with `<WysiwygEditor>`. Keep the old `RichTextToolbar.tsx` export as a thin wrapper so nothing breaks, then delete once verified.

**Rendering on public About page:** already uses `dangerouslySetInnerHTML` for paragraphs — sanitize with DOMPurify before injection (new small util) to make the richer HTML safe.

## 2. AI Insights Panel (BYOK, multi-provider)

New results-sidebar tab **"AI Insights"** (visible after a crawl completes) where the user picks a provider, pastes their own API key, picks a model, and asks the AI questions about the crawled dataset or generates new content (meta titles/descriptions, content ideas, cluster suggestions, etc.).

**Providers supported (all BYOK, free tiers available):**
- Lovable AI Gateway — built-in, no key (Gemini 3 Flash, GPT-5 Mini, etc.)
- Google AI Studio — Gemini 1.5/2.0/2.5 Flash & Pro (free tier)
- Anthropic Claude — Sonnet/Haiku (paid; requested by users)
- OpenAI — GPT-4o mini, GPT-5 mini
- Groq — Llama 3.3, Mixtral (generous free tier)
- OpenRouter — access to hundreds of models incl. free ones
- Mistral — free tier via La Plateforme

**Key storage:** browser `localStorage` only, per-provider, never sent to our backend. Clear-key button + "keys never leave your browser" notice.

**New files:**
- `src/lib/ai-providers.ts` — provider registry: id, label, endpoint, default models, header shape, key format hint, docs link.
- `src/lib/ai-client.ts` — unified `chat({provider, apiKey, model, messages})` that adapts to each provider's REST shape (OpenAI-compat for OpenAI/Groq/OpenRouter/Mistral; Google `generateContent`; Anthropic `messages`; Lovable via existing edge/AI-gateway path).
- `src/components/AiInsightsPanel.tsx` — provider dropdown, model dropdown (populated from registry, editable), key input (password field, saved to LS), preset actions ("Summarize crawl issues", "Generate meta titles for top 20 pages", "Cluster URLs by topic", "Find content gaps") + freeform prompt, streamed answer, copy button.
- `src/hooks/use-ai-keys.ts` — LS-backed hook `{keys, setKey, clearKey}`.

**Context building:** compact JSON summary of crawl (URL count, top issues, sample rows with title/description/H1/status) is prepended to the prompt so users get real insights without shipping the whole dataset.

**Integration:** add tab in `ResultsSidebar.tsx` (or `SectionIssues.tsx` neighbor). No changes to crawl logic.

## 3. Out of scope
- No server-side AI features baked in — strictly BYOK per user's ask.
- No changes to crawler, sitemap, or existing tool functionality.

## Technical notes
- All AI calls go directly from browser to provider (CORS allowed by all listed providers). No edge function needed except the existing Lovable AI Gateway path.
- Sanitize HTML at render time (DOMPurify) since WYSIWYG now emits richer markup incl. `<img>` and tables.
- Backward compatibility: existing plain-text/`<b>`/`<i>` content loads unchanged in TipTap.

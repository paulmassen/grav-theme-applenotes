# v1.2.0
##  10/09/2026

1. [](#new)
    * Grav 2 compatibility: `compatibility: grav: ['1.7', '2.0']` in `blueprints.yaml` (without it, Grav 2's GPM and migration wizard treat the theme as 1.7-only). Tested on Grav 1.7.49 and Grav 2.2.5 (PHP 8.3, Twig 3, Admin 2)
    * Content column wrapped in `<main>`, sidebar in `<aside>`: clean Markdown output on Grav 2.1+ (`/page.md`)
    * Note title is now an `<h1>`, note date a `<time>` element
    * Plugin pages extending `partials/base.html.twig` (TNTSearch `/search`, login, forms…) are rendered inside the notes layout
    * Sidebar search works without TNTSearch (local filtering on titles and excerpts) and shows a "No results found" message
    * Search icon in the search field, `/` shortcut to focus it, `Enter` opens the first result
    * The dark/light choice made with `t` is remembered (except when dark mode is disabled)
1. [](#improved)
    * Search uses TNTSearch's JSON endpoint and matches notes by route (no more HTML parsing, no 1 second start-up delay, out-of-order responses ignored)
    * Mobile layout handled in CSS (list on the home page, note elsewhere) instead of inline styles set by JavaScript
    * JavaScript rewritten: dead code and debug logging removed, works when `localStorage` is unavailable
    * Removed the `<style>` blocks repeated inside every sidebar item; styles moved to `source.css`
    * `default_emoji` theme setting is now actually used; page emoji field no longer forces 📝 into the frontmatter
    * Emoji validation accepts multi-codepoint emoji (👨‍💻, ❤️‍🔥…)
    * Accessibility: one tab stop per note, `aria-current` on the open note, labelled search
    * Head JavaScript group (`assets.js()`) is now rendered, so plugin scripts load
    * Sidebar grouping (Pinned, Today, Yesterday, Previous 7/30 Days, Older) is done in Twig again instead of being rebuilt by an inline script: works without JavaScript and no longer flickers on load. The root cause of the 1.1.0 fix (Twig `merge` renumbered the numeric `'7'`/`'30'` group keys) is fixed
    * Sidebar uses Grav's collection filters: unpublished, non-routable and modular pages are excluded, as well as pages with `visible: false`
1. [](#bugfix)
    * Task lists: `- [ ]` inside code blocks was turned into a checkbox; `*`, `+`, numbered and nested task items were not converted
    * Task list post-processing could empty the page content when the regular expression failed on long pages
    * Sidebar excerpts dropped hyphens, underscores and other characters and showed `&amp;`
    * The search field was autofocused on every page, disabling `j`/`k` navigation and opening the keyboard on mobile
    * The search fallback form pointed to a relative URL
    * Hovering the selected note removed its highlight
    * The 404 page was unreadable on mobile (only the notes list was shown)
    * Flash of the light theme on page load in dark/auto mode
    * `npm run prod` failed (`cssnano` was referenced but not installed)
1. [](#removed)
    * Unused `partials/navigation.html.twig`, `dropdown` option and template-skeleton CSS (`.header`, `.footer`, `.main-nav`)
    * Theme override of `partials/tntsearch.html.twig` (the plugin's own partial is used on its search page)

# v1.1.0
##  01/26/2026

1. [](#bugfix)
    * Fix for certain pages not appearing in the sidebar

# v1.0.0
##  12/04/2025

1. [](#new)
    * ChangeLog started...
    * Initial Release

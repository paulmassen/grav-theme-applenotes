/*
 * Apple Notes theme for Grav — front-end behaviour.
 *
 * - Colour scheme: dark mode setting + "t" shortcut, remembered per visitor
 * - Keyboard navigation between notes (j/k, arrows), "/" to search, Esc
 * - Sidebar search: TNTSearch JSON endpoint when the plugin is enabled, local filtering otherwise
 * - Mobile: "Notes" back button reveals the notes list
 *
 * Layout and responsive behaviour are handled in CSS; this script only adds interactions.
 */
(function () {
    'use strict';

    var THEME_KEY = 'apple-notes-theme';
    var root = document.documentElement;

    var storage = {
        get: function (key) {
            try { return window.localStorage.getItem(key); } catch (e) { return null; }
        },
        set: function (key, value) {
            try { window.localStorage.setItem(key, value); } catch (e) { /* storage disabled */ }
        }
    };

    function $(selector, context) {
        return (context || document).querySelector(selector);
    }

    function $all(selector, context) {
        return Array.prototype.slice.call((context || document).querySelectorAll(selector));
    }

    function normalize(text) {
        var value = String(text || '').toLowerCase();
        return value.normalize ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : value;
    }

    /* ------------------------------------------------------------------ */
    /* Colour scheme                                                       */
    /* ------------------------------------------------------------------ */

    // The initial class is applied by an inline script in <head> (no flash); this keeps it in sync.
    function themeMode() {
        return root.getAttribute('data-theme-mode') || 'disabled';
    }

    function initTheme() {
        if (themeMode() !== 'auto' || !window.matchMedia) {
            return;
        }
        var query = window.matchMedia('(prefers-color-scheme: dark)');
        var onChange = function (event) {
            if (!storage.get(THEME_KEY)) {
                root.classList.toggle('dark', event.matches);
            }
        };
        if (query.addEventListener) {
            query.addEventListener('change', onChange);
        } else if (query.addListener) {
            query.addListener(onChange); // Safari < 14
        }
    }

    function toggleTheme() {
        if (themeMode() === 'disabled') {
            return;
        }
        var dark = !root.classList.contains('dark');
        root.classList.toggle('dark', dark);
        storage.set(THEME_KEY, dark ? 'dark' : 'light');
    }

    /* ------------------------------------------------------------------ */
    /* Notes list                                                          */
    /* ------------------------------------------------------------------ */

    function noteItems() {
        return $all('#notes-list .note-item');
    }

    function visibleNoteItems() {
        return noteItems().filter(function (item) {
            return !item.hidden && !(item.closest('section') || {}).hidden;
        });
    }

    function openNote(item) {
        var link = item && $('a[href]', item);
        if (link) {
            window.location.href = link.href;
        }
    }

    function navigateNotes(step) {
        var notes = visibleNoteItems();
        if (!notes.length) {
            return;
        }
        var current = -1;
        for (var i = 0; i < notes.length; i++) {
            if (notes[i].classList.contains('is-selected')) {
                current = i;
                break;
            }
        }
        var next = current === -1
            ? (step > 0 ? 0 : notes.length - 1)
            : (current + step + notes.length) % notes.length;
        openNote(notes[next]);
    }

    function revealSelectedNote() {
        var selected = $('#notes-list .note-item.is-selected');
        var scroller = document.getElementById('sidebar-scroll');
        if (!selected || !scroller) {
            return;
        }
        // Scroll the sidebar only (scrollIntoView could also scroll the page on mobile).
        var top = selected.offsetTop - scroller.offsetTop;
        if (top < scroller.scrollTop || top + selected.offsetHeight > scroller.scrollTop + scroller.clientHeight) {
            scroller.scrollTop = top - (scroller.clientHeight - selected.offsetHeight) / 2;
        }
    }

    function initSidebarScroll() {
        var scroller = document.getElementById('sidebar-scroll');
        var nav = $('.nav-container');
        if (!scroller || !nav) {
            return;
        }
        var update = function () {
            nav.setAttribute('data-scrolled', scroller.scrollTop > 0 ? 'true' : 'false');
        };
        scroller.addEventListener('scroll', update, { passive: true });
        update();
    }

    /* ------------------------------------------------------------------ */
    /* Mobile: "Notes" back button                                         */
    /* ------------------------------------------------------------------ */

    function setSidebarOpen(open) {
        var layout = document.getElementById('sidebar-layout');
        if (!layout) {
            return;
        }
        layout.classList.toggle('sidebar-open', open);
        $all('.mobile-toggle-sidebar').forEach(function (button) {
            button.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        if (open) {
            revealSelectedNote();
        }
    }

    function initMobileSidebar() {
        $all('.mobile-toggle-sidebar').forEach(function (button) {
            button.addEventListener('click', function () {
                setSidebarOpen(true);
            });
        });
    }

    /* ------------------------------------------------------------------ */
    /* Window buttons                                                      */
    /* ------------------------------------------------------------------ */

    function initWindowButtons() {
        $all('[data-action="close-window"]').forEach(function (button) {
            button.addEventListener('click', function () {
                window.close(); // only works for windows opened by a script
            });
        });
        $all('[data-action="new-note"]').forEach(function (button) {
            button.addEventListener('click', function () {
                // Hook for site owners: define window.createNewNote() in your own script.
                if (typeof window.createNewNote === 'function') {
                    window.createNewNote();
                }
                document.dispatchEvent(new CustomEvent('apple-notes:new-note'));
            });
        });
    }

    /* ------------------------------------------------------------------ */
    /* Search                                                              */
    /* ------------------------------------------------------------------ */

    var search = null;

    function initSearch() {
        var form = $('form.notes-search');
        var input = form && $('.notes-search-input', form);
        var list = document.getElementById('notes-list');
        if (!form || !input || !list) {
            return;
        }

        var clear = $('.notes-search-clear', form);
        var empty = $('.notes-search-empty', list);
        var mode = form.getAttribute('data-search-mode') || 'local';
        var uri = form.getAttribute('data-search-uri');
        var min = parseInt(form.getAttribute('data-search-min'), 10) || 1;
        var items = noteItems();
        var timer = null;
        var controller = null;
        var requestId = 0;

        function showResults(matches) {
            // matches: null to show everything, or a function(item) -> boolean
            var anyVisible = false;
            items.forEach(function (item) {
                var visible = !matches || matches(item);
                item.hidden = !visible;
                anyVisible = anyVisible || visible;
            });
            $all('section', list).forEach(function (section) {
                section.hidden = !$all('.note-item', section).some(function (item) { return !item.hidden; });
            });
            if (empty) {
                empty.hidden = anyVisible;
            }
        }

        function localMatcher(query) {
            var words = normalize(query).split(/\s+/).filter(Boolean);
            return function (item) {
                var haystack = normalize(item.getAttribute('data-search-text') || item.textContent);
                return words.every(function (word) { return haystack.indexOf(word) !== -1; });
            };
        }

        function remoteSearch(query) {
            if (controller) {
                controller.abort();
            }
            controller = window.AbortController ? new AbortController() : null;
            var id = ++requestId;
            var url = uri + (uri.indexOf('?') === -1 ? '?' : '&')
                + 'q=' + encodeURIComponent(query) + '&l=' + Math.max(items.length, 20);

            fetch(url, {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
                signal: controller ? controller.signal : undefined
            })
                .then(function (response) {
                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status);
                    }
                    return response.json();
                })
                .then(function (data) {
                    if (id !== requestId) {
                        return; // a newer search is running
                    }
                    if (!data || !Array.isArray(data.hits) || data.execution_time === 'missing index') {
                        throw new Error('No usable TNTSearch results');
                    }
                    var routes = {};
                    data.hits.forEach(function (hit) {
                        if (hit && hit.link) {
                            routes[hit.link] = true;
                        }
                    });
                    showResults(function (item) {
                        return routes[item.getAttribute('data-note-route')] === true;
                    });
                })
                .catch(function (error) {
                    if (error && error.name === 'AbortError') {
                        return;
                    }
                    if (id === requestId) {
                        // TNTSearch unavailable (index not built, plugin disabled...): filter locally.
                        showResults(localMatcher(query));
                    }
                });
        }

        function run() {
            var query = input.value.trim();
            if (clear) {
                clear.hidden = query === '';
            }
            window.clearTimeout(timer);
            if (query.length < min) {
                requestId++;
                if (controller) {
                    controller.abort();
                }
                showResults(null);
                return;
            }
            if (mode === 'tntsearch' && uri && window.fetch) {
                timer = window.setTimeout(function () { remoteSearch(query); }, 200);
            } else {
                showResults(localMatcher(query));
            }
        }

        function reset() {
            input.value = '';
            run();
        }

        input.addEventListener('input', run);
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            openNote(visibleNoteItems()[0]);
        });
        if (clear) {
            clear.addEventListener('click', function () {
                reset();
                input.focus();
            });
        }

        // Browsers may restore the field value when navigating back.
        if (input.value) {
            run();
        }

        search = { input: input, reset: reset };
    }

    /* ------------------------------------------------------------------ */
    /* Keyboard shortcuts                                                  */
    /* ------------------------------------------------------------------ */

    function isTyping(target) {
        return !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    }

    function initKeyboard() {
        document.addEventListener('keydown', function (event) {
            if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
                return;
            }
            var target = event.target;

            if (event.key === 'Escape') {
                if (search && target === search.input && search.input.value) {
                    search.reset();
                } else if (isTyping(target)) {
                    target.blur();
                } else {
                    setSidebarOpen(false);
                }
                return;
            }

            if (isTyping(target)) {
                return;
            }

            switch (event.key) {
                case 'j':
                case 'ArrowDown':
                    event.preventDefault();
                    navigateNotes(1);
                    break;
                case 'k':
                case 'ArrowUp':
                    event.preventDefault();
                    navigateNotes(-1);
                    break;
                case 't':
                    event.preventDefault();
                    toggleTheme();
                    break;
                case '/':
                    if (search) {
                        event.preventDefault();
                        search.input.focus();
                        search.input.select();
                    }
                    break;
            }
        });
    }

    /* ------------------------------------------------------------------ */

    function init() {
        initTheme();
        initSidebarScroll();
        initMobileSidebar();
        initWindowButtons();
        initSearch();
        initKeyboard();
        revealSelectedNote();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

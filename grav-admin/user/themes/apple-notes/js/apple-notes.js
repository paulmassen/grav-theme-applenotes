(function () {
    'use strict';

    // Configuration: Set to true to enable TNTSearch debugging in console
    // Change this to true if you need to debug TNTSearch issues
    const TNTSearch_DEBUG = false;

    // Helper function for conditional debugging
    const debugLog = (...args) => {
        if (TNTSearch_DEBUG) {
            console.log(...args);
        }
    };

    const debugWarn = (...args) => {
        if (TNTSearch_DEBUG) {
            console.warn(...args);
        }
    };

    const debugError = (...args) => {
        if (TNTSearch_DEBUG) {
            console.error(...args);
        }
    };

    // State management
    const state = {
        searchQuery: '',
        searchResults: null,
        highlightedIndex: 0,
        selectedNoteSlug: null,
        isMobile: null,
        theme: localStorage.getItem('theme') || 'system',
        pinnedNotes: JSON.parse(localStorage.getItem('pinnedNotes') || '[]')
    };

    // Initialize
    function init() {
        detectMobile();
        initTheme();
        initKeyboardNavigation();
        initSidebarScroll();
        initMobileBehavior();
        initMobileSidebarToggle();
        updateSelectedNote();
        protectAgainstExtensions();
    }

    // Protect against browser extension conflicts and debug TNTSearch
    function protectAgainstExtensions() {
        const tntsearchInput = document.querySelector('.tntsearch-field');
        const tntsearchForm = document.querySelector('form.tntsearch-form');
        const tntsearchResults = tntsearchForm ? tntsearchForm.querySelector('.tntsearch-results') : null;

        debugLog('[TNTSearch Debug] Checking TNTSearch initialization:', {
            inputExists: !!tntsearchInput,
            formExists: !!tntsearchForm,
            resultsExists: !!tntsearchResults,
            inputId: tntsearchInput ? tntsearchInput.id : 'none',
            inputClasses: tntsearchInput ? tntsearchInput.className : 'none',
            dataAttribute: tntsearchInput ? tntsearchInput.getAttribute('data-tntsearch') : 'none'
        });

        if (tntsearchInput && tntsearchForm && tntsearchResults) {
            // Log the data attribute value
            const dataTntsearch = tntsearchInput.getAttribute('data-tntsearch');
            let parsedData = null;
            try {
                parsedData = dataTntsearch ? JSON.parse(dataTntsearch) : null;
            } catch (e) {
                debugError('[TNTSearch Debug] Failed to parse data-tntsearch:', e);
            }

            debugLog('[TNTSearch Debug] data-tntsearch attribute:', {
                raw: dataTntsearch,
                parsed: parsedData
            });

            // Ensure form-control class exists
            if (!tntsearchInput.classList.contains('form-control')) {
                tntsearchInput.classList.add('form-control');
            }

            // Check if TNTSearch script is loaded
            const scripts = Array.from(document.scripts);
            const tntsearchScript = scripts.find(s => s.src && s.src.includes('tntsearch'));
            debugLog('[TNTSearch Debug] Scripts check:', {
                totalScripts: scripts.length,
                tntsearchScriptFound: !!tntsearchScript,
                tntsearchScriptSrc: tntsearchScript ? tntsearchScript.src : 'none',
                allScriptSrcs: scripts.map(s => s.src).filter(Boolean)
            });

            // Initialize TNTSearch manually if script is not loaded
            setTimeout(() => {
                debugLog('[TNTSearch Debug] Checking if TNTSearch initialized:', {
                    GravTNTSearchFunction: typeof window.GravTNTSearch,
                    formFound: !!tntsearchForm,
                    inputFound: !!tntsearchInput,
                    resultsFound: !!tntsearchResults
                });

                // Always use our custom implementation that filters the sidebar
                // instead of showing a dropdown
                debugLog('[TNTSearch Debug] Using custom sidebar filtering implementation');
                initializeTNTSearchManually(tntsearchForm, tntsearchInput, tntsearchResults);
            }, 1000);

            // Add a test listener to see if events work
            const testListener = (e) => {
                debugLog('[TNTSearch Debug] Input event fired (test listener):', {
                    value: e.target.value,
                    length: e.target.value.length,
                    timestamp: new Date().toISOString()
                });
            };
            tntsearchInput.addEventListener('input', testListener, { once: true });
        } else {
            debugWarn('[TNTSearch Debug] Required elements not found:', {
                input: !!tntsearchInput,
                form: !!tntsearchForm,
                results: !!tntsearchResults
            });
        }
    }

    // Mobile detection
    function detectMobile() {
        const isMobile = window.innerWidth <= 768;
        state.isMobile = isMobile;

        if (document.body) {
            if (isMobile) {
                document.body.classList.add('mobile');
                document.body.classList.remove('desktop');
            } else {
                document.body.classList.remove('mobile');
                document.body.classList.add('desktop');
            }
        }
        return isMobile;
    }

    // Initialize mobile detection immediately (before DOM ready)
    (function initMobileImmediate() {
        const initialMobile = window.innerWidth <= 768;
        state.isMobile = initialMobile;
        const target = document.body || document.documentElement;
        if (initialMobile) {
            target.classList.add('mobile');
            target.classList.remove('desktop');
        } else {
            target.classList.remove('mobile');
            target.classList.add('desktop');
        }
    })();

    // Theme management
    function initTheme() {
        const htmlElement = document.documentElement;
        const themeMode = htmlElement.getAttribute('data-theme-mode') || 'disabled';

        // Handle auto mode: detect system preference
        if (themeMode === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
                htmlElement.classList.add('dark');
            } else {
                htmlElement.classList.remove('dark');
            }

            // Listen for system theme changes
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (themeMode === 'auto') {
                    if (e.matches) {
                        htmlElement.classList.add('dark');
                    } else {
                        htmlElement.classList.remove('dark');
                    }
                }
            });
        } else if (themeMode === 'enabled') {
            // Dark mode enabled: ensure dark class is present
            htmlElement.classList.add('dark');
        } else {
            // Dark mode disabled: ensure dark class is not present
            htmlElement.classList.remove('dark');
        }
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        state.theme = newTheme;
        localStorage.setItem('theme', newTheme);

        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }

    // Search functionality
    // function initSearch() {
    //     const searchInput = document.getElementById('search-input');
    //     const searchClear = document.getElementById('search-clear');

    //     if (!searchInput) return;

    //     searchInput.addEventListener('input', (e) => {
    //         const query = e.target.value.trim();
    //         state.searchQuery = query;

    //         if (query === '') {
    //             clearSearch();
    //             return;
    //         }

    //         performSearch(query);
    //     });

    //     if (searchClear) {
    //         searchClear.addEventListener('click', clearSearch);
    //     }

    //     // Focus search with "/" key
    //     document.addEventListener('keydown', (e) => {
    //         const target = e.target;
    //         const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;

    //         if (e.key === '/' && !isTyping && !(e.metaKey || e.ctrlKey)) {
    //             e.preventDefault();
    //             searchInput.focus();
    //         }
    //     });
    // }

    // function performSearch(query) {
    //     const notes = Array.from(document.querySelectorAll('.note-item'));
    //     const results = [];

    //     notes.forEach((note) => {
    //         const title = note.querySelector('h2')?.textContent || '';
    //         const content = note.querySelector('p')?.textContent || '';
    //         const slug = note.dataset.noteSlug || '';

    //         const titleMatch = title.toLowerCase().includes(query.toLowerCase());
    //         const contentMatch = content.toLowerCase().includes(query.toLowerCase());

    //         if (titleMatch || contentMatch) {
    //             results.push({
    //                 element: note,
    //                 slug: slug
    //             });
    //         }
    //     });

    //     state.searchResults = results;
    //     state.highlightedIndex = 0;

    //     displaySearchResults(results);
    //     updateSearchClearButton();
    // }

    function displaySearchResults(results) {
        const notesList = document.getElementById('notes-list');
        if (!notesList) return;

        // Hide all notes
        const allNotes = notesList.querySelectorAll('.note-item');
        allNotes.forEach(note => {
            note.style.display = 'none';
        });

        // Show search results
        if (results.length > 0) {
            results.forEach((result, index) => {
                result.element.style.display = 'block';
                if (index === state.highlightedIndex) {
                    result.element.classList.add('bg-[#FFE390]', 'dark:bg-[#9D7D28]', 'dark:text-white', 'rounded-md');
                    result.element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } else {
                    result.element.classList.remove('bg-[#FFE390]', 'dark:bg-[#9D7D28]', 'dark:text-white', 'rounded-md');
                }
            });
        } else {
            // Show "No results" message
            let noResults = notesList.querySelector('.no-results');
            if (!noResults) {
                noResults = document.createElement('p');
                noResults.className = 'text-sm text-muted-foreground px-2 mt-4 no-results';
                noResults.textContent = 'No results found';
                notesList.appendChild(noResults);
            }
            noResults.style.display = 'block';
        }
    }

    function clearSearch() {
        // Search is now handled by tnt-search plugin
        // This function is kept for compatibility but does nothing
        state.searchQuery = '';
        state.searchResults = null;
        state.highlightedIndex = 0;
    }

    function updateSearchClearButton() {
        // Search clear button is now handled by tnt-search plugin
        // This function is kept for compatibility but does nothing
    }

    // Keyboard navigation
    function initKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            const target = e.target;
            const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;

            if (isTyping) {
                if (e.key === 'Escape') {
                    // Let tnt-search handle its own search input
                    // Only blur if it's not a tnt-search input
                    if (!target.closest('.tntsearch')) {
                        target.blur();
                    }
                }
                return;
            }

            // Navigation shortcuts
            if (e.key === 'j' || e.key === 'ArrowDown') {
                e.preventDefault();
                navigateNotes('down');
            } else if (e.key === 'k' || e.key === 'ArrowUp') {
                e.preventDefault();
                navigateNotes('up');
            } else if (e.key === 't' && !(e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                toggleTheme();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                target.blur();
                if (state.searchQuery) {
                    clearSearch();
                }
            }
        });
    }

    function navigateNotes(direction) {
        const notes = state.searchResults
            ? state.searchResults.map(r => r.element)
            : Array.from(document.querySelectorAll('.note-item'));

        const currentIndex = notes.findIndex(note => {
            const slug = note.dataset.noteSlug;
            return slug === state.selectedNoteSlug || note.classList.contains('bg-[#FFE390]');
        });

        let nextIndex;
        if (direction === 'down') {
            nextIndex = currentIndex < notes.length - 1 ? currentIndex + 1 : 0;
        } else {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : notes.length - 1;
        }

        const nextNote = notes[nextIndex];
        if (nextNote) {
            const link = nextNote.querySelector('a');
            if (link) {
                link.click();
            }
        }
    }

    function goToHighlightedNote() {
        if (state.searchResults && state.searchResults[state.highlightedIndex]) {
            const result = state.searchResults[state.highlightedIndex];
            const link = result.element.querySelector('a');
            if (link) {
                link.click();
            }
        }
    }

    // Sidebar scroll management
    function initSidebarScroll() {
        const sidebarScroll = document.getElementById('sidebar-scroll');
        const navContainer = document.querySelector('.nav-container');

        if (!sidebarScroll || !navContainer) return;

        sidebarScroll.addEventListener('scroll', () => {
            const scrolled = sidebarScroll.scrollTop > 0;
            navContainer.setAttribute('data-scrolled', scrolled);
        });
    }

    // Mobile behavior - following original logic: showSidebar = !isMobile || pathname === "/notes"
    // In Grav: detect if we're on the list page (default) or a note page
    function initMobileBehavior() {
        const isMobile = detectMobile();
        const sidebarContainer = document.getElementById('sidebar-container');
        const sidebar = document.getElementById('sidebar');

        // Detect page type: check for .note-page or .list-page class
        const isNotePage = document.querySelector('.note-page') !== null;
        const isListPage = document.querySelector('.list-page') !== null;
        const pathname = window.location.pathname;

        // In Grav, the list page is usually the home page (/) or a collection page
        // Individual notes have their own path like /typography, /favorite-movies, etc.
        // Use URL pattern as primary detection since classes might be on all pages
        let finalIsListPage;
        // Primary detection: check URL - list page is root (/)
        if (pathname === '/' || pathname === '' || pathname.match(/^\/notes\/?$/)) {
            finalIsListPage = true;
        } else if (isNotePage) {
            // If .note-page class exists, it's definitely a note page
            finalIsListPage = false;
        } else {
            // Fallback: if pathname is not root, it's likely a note page
            finalIsListPage = false;
        }

        // Logic from original sidebar-layout.tsx line 35:
        // const showSidebar = !isMobile || pathname === "/notes";
        // In Grav: showSidebar = !isMobile || isListPage
        const showSidebar = !isMobile || finalIsListPage;
        // Show content: on desktop always, on mobile only when NOT on list page (i.e., on note page)
        const showContent = !isMobile || !finalIsListPage;

        // Find back button and content area
        const backButton = document.querySelector('.mobile-back-button');
        const contentArea = document.querySelector('.content-area');

        if (sidebarContainer) {
            if (showSidebar) {
                // Show sidebar (desktop always, mobile only on list page)
                sidebarContainer.style.display = 'block';
                if (sidebar) {
                    sidebar.style.display = 'flex';
                }
                // Hide back button on list page - use setProperty with !important
                if (backButton) {
                    backButton.style.setProperty('display', 'none', 'important');
                    backButton.style.setProperty('visibility', 'hidden', 'important');
                }
                // Hide content on mobile list page
                if (contentArea && isMobile) {
                    contentArea.style.setProperty('display', 'none', 'important');
                } else if (contentArea && !isMobile) {
                    contentArea.style.setProperty('display', 'block', 'important');
                }
            } else {
                // Hide sidebar (mobile on note page) - like original, hide the container
                sidebarContainer.style.display = 'none';
                // Show back button on note page - use setProperty with !important to override CSS
                if (backButton) {
                    backButton.style.setProperty('display', 'flex', 'important');
                    backButton.style.setProperty('visibility', 'visible', 'important');
                }
                // Show content on mobile note page
                if (contentArea) {
                    contentArea.style.setProperty('display', 'block', 'important');
                }
            }
        } else {
            // Fallback: if no container, hide/show sidebar directly
            if (sidebar) {
                if (showSidebar) {
                    sidebar.style.display = 'flex';
                    if (backButton) {
                        backButton.style.setProperty('display', 'none', 'important');
                        backButton.style.setProperty('visibility', 'hidden', 'important');
                    }
                    // Hide content on mobile list page
                    if (contentArea && isMobile) {
                        contentArea.style.setProperty('display', 'none', 'important');
                    }
                } else {
                    sidebar.style.display = 'none';
                    if (backButton) {
                        backButton.style.setProperty('display', 'flex', 'important');
                        backButton.style.setProperty('visibility', 'visible', 'important');
                    }
                    // Show content on mobile note page
                    if (contentArea) {
                        contentArea.style.setProperty('display', 'block', 'important');
                    }
                }
            }
        }
    }

    // Update selected note
    function updateSelectedNote() {
        const currentPath = window.location.pathname;
        const slug = currentPath.split('/').pop() || currentPath;
        state.selectedNoteSlug = slug;

        // Highlight selected note
        const notes = document.querySelectorAll('.note-item');
        notes.forEach(note => {
            if (note.dataset.noteSlug === slug) {
                note.classList.add('bg-[#FFE390]', 'dark:bg-[#9D7D28]', 'dark:text-white', 'rounded-md');
                note.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                note.classList.remove('bg-[#FFE390]', 'dark:bg-[#9D7D28]', 'dark:text-white', 'rounded-md');
            }
        });
    }

    // Create new note function (placeholder)
    window.createNewNote = function () {
        // This would be implemented based on your backend
    };

    // Manually initialize TNTSearch if plugin script is not loaded
    // This version filters the sidebar instead of showing a dropdown
    function initializeTNTSearchManually(form, input, results) {
        if (!form || !input || !results) {
            debugError('[TNTSearch Debug] Cannot initialize: missing required elements');
            return;
        }

        debugLog('[TNTSearch Debug] Initializing TNTSearch manually with sidebar filtering');

        // Hide the results dropdown - we'll filter the sidebar instead
        results.style.display = 'none';

        // Parse options from data attribute
        let options = {};
        try {
            const dataAttr = input.getAttribute('data-tntsearch');
            if (dataAttr) {
                options = JSON.parse(dataAttr);
            }
        } catch (e) {
            debugError('[TNTSearch Debug] Failed to parse data-tntsearch:', e);
            return;
        }

        const clear = form.querySelector('.tntsearch-clear');
        const notesList = document.getElementById('notes-list');
        const allNoteItems = notesList ? Array.from(notesList.querySelectorAll('.note-item')) : [];
        let searchTimeout = null;

        // Function to show all notes
        const showAllNotes = () => {
            allNoteItems.forEach(item => {
                item.style.display = '';
                const listItem = item.closest('li');
                if (listItem) listItem.style.display = '';
                // Show parent sections
                const section = item.closest('section');
                if (section) section.style.display = '';
            });
        };

        // Function to filter notes based on search results
        const filterNotes = (matchingSlugs) => {
            const matchingSet = new Set(matchingSlugs);

            allNoteItems.forEach(item => {
                const slug = item.dataset.noteSlug;
                const listItem = item.closest('li');

                if (slug && matchingSet.has(slug)) {
                    // Show matching note
                    item.style.display = '';
                    if (listItem) listItem.style.display = '';
                    // Show parent section
                    const section = item.closest('section');
                    if (section) section.style.display = '';
                } else {
                    // Hide non-matching note
                    item.style.display = 'none';
                    if (listItem) listItem.style.display = 'none';
                }
            });

            // Hide empty sections
            const sections = notesList ? notesList.querySelectorAll('section') : [];
            sections.forEach(section => {
                const visibleItems = section.querySelectorAll('.note-item[style=""], .note-item:not([style*="display: none"])');
                if (visibleItems.length === 0) {
                    section.style.display = 'none';
                } else {
                    section.style.display = '';
                }
            });
        };

        // Extract slugs from search results HTML
        const extractSlugsFromResults = (html) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = doc.querySelectorAll('a');
            const slugs = [];

            links.forEach(link => {
                const href = link.getAttribute('href');
                if (href) {
                    // Extract slug from URL
                    // URLs can be like: /typography, /notes/typography, or full URLs
                    let slug = href;

                    // Remove protocol and domain if present
                    slug = slug.replace(/^https?:\/\/[^\/]+/, '');

                    // Remove leading/trailing slashes and get last segment
                    slug = slug.split('/').filter(Boolean).pop();

                    if (slug) {
                        slugs.push(slug);
                    }
                }
            });

            debugLog('[TNTSearch Debug] Extracted slugs from results:', slugs);
            return slugs;
        };

        // Throttled search function
        const performSearch = (value) => {
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }

            searchTimeout = setTimeout(async () => {
                if (!value || value.trim().length < options.min) {
                    // Show all notes if search is empty or too short
                    showAllNotes();
                    if (clear) clear.style.display = 'none';
                    return;
                }

                if (clear) clear.style.display = '';

                const params = new URLSearchParams({
                    q: value,
                    l: options.limit || 20,
                    sl: options.snippet || 300,
                    search_type: options.search_type || 'auto',
                    ajax: 'true'
                });

                try {
                    debugLog('[TNTSearch Debug] Performing search:', {
                        query: value,
                        uri: options.uri,
                        params: params.toString()
                    });

                    const response = await fetch(`${options.uri}?${params.toString()}`, {
                        credentials: 'same-origin'
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const html = await response.text();
                    const matchingSlugs = extractSlugsFromResults(html);

                    debugLog('[TNTSearch Debug] Search results:', {
                        matchingSlugs: matchingSlugs,
                        count: matchingSlugs.length
                    });

                    // Filter sidebar to show only matching notes
                    filterNotes(matchingSlugs);
                } catch (error) {
                    debugError('[TNTSearch Debug] Search error:', error);
                    // On error, show all notes
                    showAllNotes();
                }
            }, 350);
        };

        // Prevent form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
        });

        // Input event
        input.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            performSearch(value);
        });

        // Focus event
        input.addEventListener('focus', () => {
            if (input.value.trim().length >= options.min) {
                performSearch(input.value.trim());
            }
        });

        // Clear button - show all notes again
        if (clear) {
            clear.addEventListener('click', () => {
                input.value = '';
                showAllNotes();
                clear.style.display = 'none';
            });
        }

        debugLog('[TNTSearch Debug] TNTSearch manually initialized successfully with sidebar filtering');
    }

    // Toggle sidebar on mobile when clicking "Notes" button
    function initMobileSidebarToggle() {
        const toggleButton = document.querySelector('.mobile-toggle-sidebar');
        if (!toggleButton) return;

        toggleButton.addEventListener('click', (e) => {
            e.preventDefault();
            showMobileSidebar();
        });

        // When clicking on a note in the sidebar on mobile, hide sidebar and show content
        const noteItems = document.querySelectorAll('.note-item a');
        noteItems.forEach(item => {
            item.addEventListener('click', (e) => {
                if (state.isMobile) {
                    // Let the navigation happen, but the page will reload and initMobileBehavior will handle it
                    // Alternatively, we could prevent default and navigate programmatically
                    hideMobileSidebar();
                }
            });
        });
    }

    function showMobileSidebar() {
        const sidebarContainer = document.getElementById('sidebar-container');
        const contentArea = document.querySelector('.content-area');
        const backButton = document.querySelector('.mobile-back-button');

        if (sidebarContainer && state.isMobile) {
            sidebarContainer.style.setProperty('display', 'block', 'important');
            const sidebar = sidebarContainer.querySelector('#sidebar');
            if (sidebar) {
                sidebar.style.setProperty('display', 'flex', 'important');
            }
            if (contentArea) {
                contentArea.style.setProperty('display', 'none', 'important');
            }
            if (backButton) {
                backButton.style.setProperty('display', 'flex', 'important');
                backButton.style.setProperty('visibility', 'visible', 'important');
            }
        }
    }

    function hideMobileSidebar() {
        const sidebarContainer = document.getElementById('sidebar-container');
        const contentArea = document.querySelector('.content-area');
        const backButton = document.querySelector('.mobile-back-button');

        if (sidebarContainer && state.isMobile) {
            sidebarContainer.style.setProperty('display', 'none', 'important');
            if (contentArea) {
                contentArea.style.setProperty('display', 'block', 'important');
            }
            if (backButton) {
                backButton.style.setProperty('display', 'flex', 'important');
                backButton.style.setProperty('visibility', 'visible', 'important');
            }
        }
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            detectMobile();
            initMobileBehavior();
        }, 250);
    });

})();


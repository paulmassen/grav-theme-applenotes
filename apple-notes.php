<?php
namespace Grav\Theme;

use Grav\Common\Theme;

class AppleNotes extends Theme
{
    // Access plugin events in this class
    
    public static function getSubscribedEvents()
    {
        return [
            'onThemeInitialized' => ['onThemeInitialized', 0],
            'onPageContentRaw' => ['onPageContentRaw', 0],
            'onPageContentProcessed' => ['onPageContentProcessed', 0],
        ];
    }

    public function onThemeInitialized()
    {
        // Ensure assets are loaded
        $this->grav['assets']->addCss('theme://css/apple-notes.css');
        $this->grav['assets']->addCss('theme://css/github-markdown.css');
        $this->grav['assets']->addCss('theme://css/custom.css');
        $this->grav['assets']->addJs('theme://js/apple-notes.js', ['group' => 'bottom', 'loading' => 'defer']);
    }
    public function onPageContentRaw($event)
    {
        $page = $event['page'];
        $content = $page->getRawContent();

        // Replace unchecked checkboxes [ ] with input checkbox
        // The markdown processor will wrap this in <li>, we'll add task-list-item class later
        $content = preg_replace(
            '/^- \[ \] (.*)$/m',
            '- <input type="checkbox"> $1',
            $content
        );

        // Replace checked checkboxes [x] with checked input checkbox
        $content = preg_replace(
            '/^- \[x\] (.*)$/mi',
            '- <input type="checkbox" checked> $1',
            $content
        );

        $page->setRawContent($content);
    }

    public function onPageContentProcessed($event)
    {
        $page = $event['page'];
        // Use getRawContent() to get the processed content in this context
        $content = $page->getRawContent();

        // Add task-list-item class to list items containing checkboxes (both checked and unchecked)
        // Match both <input type="checkbox"> and <input type="checkbox" checked>
        // Handle cases with or without existing class attribute on <li>
        $content = preg_replace_callback(
            '/<li([^>]*)>([^<]*(?:<input\s+type="checkbox"[^>]*>).*?)<\/li>/s',
            function($matches) {
                $liAttrs = $matches[1];
                $liContent = $matches[2];
                
                // Check if class attribute already exists
                if (strpos($liAttrs, 'class=') !== false) {
                    // Add task-list-item if not already present
                    if (strpos($liAttrs, 'task-list-item') === false) {
                        $liAttrs = preg_replace('/class="([^"]*)"/', 'class="$1 task-list-item"', $liAttrs);
                    }
                } else {
                    $liAttrs .= ' class="task-list-item"';
                }
                
                return '<li' . $liAttrs . '>' . $liContent . '</li>';
            },
            $content
        );

        // Add contains-task-list class to ul elements that contain task-list-item
        $content = preg_replace_callback(
            '/<ul([^>]*)>((?:(?!<\/ul>).)*<li class="task-list-item".*?<\/li>(?:(?!<\/ul>).)*)<\/ul>/s',
            function($matches) {
                $ulAttrs = $matches[1];
                $ulContent = $matches[2];
                // Check if class attribute already exists
                if (strpos($ulAttrs, 'class=') !== false) {
                    $ulAttrs = preg_replace('/class="([^"]*)"/', 'class="$1 contains-task-list"', $ulAttrs);
                } else {
                    $ulAttrs .= ' class="contains-task-list"';
                }
                return '<ul' . $ulAttrs . '>' . $ulContent . '</ul>';
            },
            $content
        );

        // Use setRawContent() to set the modified processed content
        $page->setRawContent($content);
    }

    
}

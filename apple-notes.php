<?php

namespace Grav\Theme;

use Grav\Common\Theme;
use RocketTheme\Toolbox\Event\Event;

/**
 * Apple Notes theme for Grav (compatible with Grav 1.7 and Grav 2.x).
 */
class AppleNotes extends Theme
{
    /**
     * A list item marker followed by a task box, e.g. "- [ ] ", "* [x] ", "1. [ ] ",
     * optionally indented (nested lists) or quoted ("> - [ ] ").
     */
    private const TASK_MARKER = '/^((?:[ \t]*>)*[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+)\[([ xX])\](?=[ \t]|\r?\n|$)/';

    /** Opening / closing line of a fenced code block (``` or ~~~), optionally quoted. */
    private const CODE_FENCE = '/^(?:[ \t]*>)*[ \t]*(`{3,}|~{3,})/';

    public static function getSubscribedEvents(): array
    {
        return [
            'onPageContentRaw' => ['onPageContentRaw', 0],
            'onPageContentProcessed' => ['onPageContentProcessed', 0],
        ];
    }

    /**
     * Turns GitHub-style task list markers into checkboxes before Markdown is parsed.
     * Grav 1.7's Markdown parser has no task list support, and Grav 2's renders disabled
     * checkboxes: converting them here gives the same result on both versions.
     */
    public function onPageContentRaw(Event $event): void
    {
        $page = $event['page'] ?? null;
        if (!$page || !$page->shouldProcess('markdown')) {
            return;
        }

        $content = (string) $page->getRawContent();
        if (strpos($content, '[') === false) {
            return;
        }

        $page->setRawContent(self::convertTaskMarkers($content));
    }

    /**
     * Adds the GitHub `task-list-item` / `contains-task-list` classes used by the stylesheet.
     */
    public function onPageContentProcessed(Event $event): void
    {
        $page = $event['page'] ?? null;
        if (!$page) {
            return;
        }

        // In this event, getRawContent() returns the processed (HTML) content.
        $content = (string) $page->getRawContent();
        if (stripos($content, 'checkbox') === false) {
            return;
        }

        $page->setRawContent(self::decorateTaskLists($content));
    }

    public static function convertTaskMarkers(string $markdown): string
    {
        $lines = preg_split('/(?<=\n)/', $markdown);
        if ($lines === false) {
            return $markdown;
        }

        $fence = null; // ['char' => '`' or '~', 'length' => int] while inside a fenced code block

        foreach ($lines as $i => $line) {
            if (preg_match(self::CODE_FENCE, $line, $match)) {
                $char = $match[1][0];
                $length = strlen($match[1]);
                if ($fence === null) {
                    $fence = ['char' => $char, 'length' => $length];
                } elseif ($char === $fence['char'] && $length >= $fence['length']) {
                    $fence = null;
                }
                continue;
            }

            if ($fence !== null) {
                continue;
            }

            $converted = preg_replace_callback(self::TASK_MARKER, static function (array $m): string {
                $checked = strtolower($m[2]) === 'x' ? ' checked' : '';

                return $m[1] . '<input type="checkbox"' . $checked . '>';
            }, $line);

            if (is_string($converted)) {
                $lines[$i] = $converted;
            }
        }

        return implode('', $lines);
    }

    public static function decorateTaskLists(string $html): string
    {
        // <li> whose content starts with a checkbox (optionally wrapped in a <p> for "loose" lists).
        $result = preg_replace_callback(
            '/<li\b([^>]*)>(\s*(?:<p>\s*)?<input\b[^>]*\btype=["\']?checkbox)/i',
            static function (array $m): string {
                return '<li' . self::addClass($m[1], 'task-list-item') . '>' . $m[2];
            },
            $html
        );
        if (!is_string($result)) {
            return $html;
        }

        // Lists starting with a task item. Lists where tasks come later are styled with :has() in CSS.
        $decorated = preg_replace_callback(
            '/<(ul|ol)\b([^>]*)>(\s*<li\b[^>]*\btask-list-item\b)/i',
            static function (array $m): string {
                return '<' . $m[1] . self::addClass($m[2], 'contains-task-list') . '>' . $m[3];
            },
            $result
        );

        return is_string($decorated) ? $decorated : $result;
    }

    private static function addClass(string $attributes, string $class): string
    {
        if (preg_match('/\bclass\s*=\s*(["\'])(.*?)\1/i', $attributes, $m)) {
            $classes = preg_split('/\s+/', trim($m[2]), -1, PREG_SPLIT_NO_EMPTY) ?: [];
            if (in_array($class, $classes, true)) {
                return $attributes;
            }
            $classes[] = $class;

            return str_replace($m[0], 'class="' . implode(' ', $classes) . '"', $attributes);
        }

        return $attributes . ' class="' . $class . '"';
    }
}

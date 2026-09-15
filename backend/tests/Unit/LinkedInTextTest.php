<?php

namespace Tests\Unit;

use App\Support\LinkedInText;
use Tests\TestCase;

class LinkedInTextTest extends TestCase
{
    public function test_hook_reads_first_non_empty_line(): void
    {
        $this->assertSame('First line', LinkedInText::hook("\n\nFirst line\n\nSecond"));
        $this->assertSame('', LinkedInText::hook("\n  \n"));
    }

    public function test_strip_leading_hook_line_removes_a_duplicated_hook(): void
    {
        $body = "The hook line\n\nFirst paragraph.\n\nSecond paragraph.";

        $clean = LinkedInText::stripLeadingHookLine($body, 'The hook line');

        $this->assertSame("First paragraph.\n\nSecond paragraph.", $clean);
    }

    public function test_strip_leading_hook_line_ignores_case_and_extra_spaces(): void
    {
        $body = "  the   HOOK line  \n\nContent stays.";

        $this->assertSame('Content stays.', LinkedInText::stripLeadingHookLine($body, 'The Hook Line'));
    }

    public function test_strip_leading_hook_line_leaves_mismatches_untouched(): void
    {
        $body = "Different opening\n\nContent.";

        $this->assertSame($body, LinkedInText::stripLeadingHookLine($body, 'The Hook Line'));
    }

    public function test_strip_leading_hook_line_needs_a_hook(): void
    {
        $body = "Some body\n\nMore";

        $this->assertSame($body, LinkedInText::stripLeadingHookLine($body, null));
        $this->assertSame($body, LinkedInText::stripLeadingHookLine($body, '  '));
    }

    public function test_normalize_strips_markdown_display_markers(): void
    {
        $input = implode("\n", [
            '### Section',
            'This is **bold** and _italic_ and `inline code`.',
            'A [link](https://example.com?x=1) inline.',
            '```ts',
            'const x = 1; // keep **this** as code',
            '```',
        ]);

        $out = LinkedInText::normalize($input);

        $this->assertStringContainsString("Section\n", $out);
        $this->assertStringContainsString('This is bold and italic and inline code.', $out);
        $this->assertStringContainsString('A link (https://example.com?x=1) inline.', $out);
        $this->assertStringNotContainsString('```', $out);
        $this->assertStringNotContainsString('###', $out);
        $this->assertStringNotContainsString('**bold**', $out);

        // Fenced code survives verbatim — markers inside code are not display markers.
        $this->assertStringContainsString('const x = 1; // keep **this** as code', $out);
    }

    public function test_normalize_keeps_underscores_inside_identifiers(): void
    {
        $out = LinkedInText::normalize('Use my_file_name and snake_case_here.');

        $this->assertSame('Use my_file_name and snake_case_here.', $out);
    }

    public function test_normalize_collapses_excess_blank_lines(): void
    {
        $out = LinkedInText::normalize("One\n\n\n\nTwo");

        $this->assertSame("One\n\nTwo", $out);
    }

    public function test_normalize_keeps_an_unclosed_fence_content(): void
    {
        $out = LinkedInText::normalize("Intro\n```php\n\$x = 1;");

        $this->assertStringContainsString('$x = 1;', $out);
        $this->assertStringNotContainsString('```', $out);
    }
}

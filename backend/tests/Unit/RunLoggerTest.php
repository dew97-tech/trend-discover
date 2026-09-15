<?php

namespace Tests\Unit;

use App\Support\RunLogger;
use Tests\TestCase;

class RunLoggerTest extends TestCase
{
    public function test_file_stem_maps_fqcn_and_basename_to_kebab_case(): void
    {
        $this->assertSame('collect-source-items', RunLogger::fileStem(\App\Jobs\CollectSourceItemsJob::class));
        $this->assertSame('collect-source-items', RunLogger::fileStem('CollectSourceItemsJob'));
        $this->assertSame('generate-image-prompt', RunLogger::fileStem('App\\Jobs\\GenerateImagePromptJob'));
        $this->assertSame('detect-trends', RunLogger::fileStem('DetectTrendsJob'));
        $this->assertSame('suggest-snippet', RunLogger::fileStem('SuggestSnippetJob'));
    }
}

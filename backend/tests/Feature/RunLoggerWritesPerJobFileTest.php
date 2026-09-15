<?php

namespace Tests\Feature;

use App\Support\RunLogger;
use Illuminate\Support\Facades\File;
use ReflectionProperty;
use Tests\TestCase;

class RunLoggerWritesPerJobFileTest extends TestCase
{
    private string $dir;

    protected function setUp(): void
    {
        parent::setUp();

        $this->dir = 'framework/testing/job-logs-'.uniqid();
        config(['logging.jobs.path' => $this->dir]);

        // RunLogger memoizes loggers statically — drop them so each test
        // writes against its own temp path.
        $loggers = new ReflectionProperty(RunLogger::class, 'loggers');
        $loggers->setAccessible(true);
        $loggers->setValue(null, []);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory(storage_path($this->dir));

        parent::tearDown();
    }

    public function test_each_job_writes_its_own_daily_file(): void
    {
        (new RunLogger(101, 'CollectSourceItemsJob'))->info('collect line');
        (new RunLogger(202, 'GeneratePostJob'))->info('post line');

        $date = now()->toDateString();
        $collectFile = storage_path("{$this->dir}/collect-source-items-{$date}.log");
        $postFile = storage_path("{$this->dir}/generate-post-{$date}.log");

        $this->assertFileExists($collectFile);
        $this->assertFileExists($postFile);

        $collect = (string) file_get_contents($collectFile);
        $post = (string) file_get_contents($postFile);

        $this->assertStringContainsString('[CollectSourceItemsJob run=101] collect line', $collect);
        $this->assertStringContainsString('[GeneratePostJob run=202] post line', $post);

        // The regression this guards: jobs must NOT share one pipeline file.
        $this->assertStringNotContainsString('post line', $collect);
        $this->assertStringNotContainsString('collect line', $post);
    }

    public function test_warning_and_error_levels_land_in_the_same_job_file(): void
    {
        $log = new RunLogger(303, 'DetectTrendsJob');
        $log->warning('careful');
        $log->error('broke');

        $file = storage_path("{$this->dir}/detect-trends-".now()->toDateString().'.log');

        $this->assertFileExists($file);

        $contents = (string) file_get_contents($file);

        $this->assertStringContainsString('WARNING: [DetectTrendsJob run=303] careful', $contents);
        $this->assertStringContainsString('ERROR: [DetectTrendsJob run=303] broke', $contents);
    }
}

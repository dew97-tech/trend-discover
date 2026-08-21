<?php

namespace App\Domain\Trending\Collectors;

use App\Models\Source;
use Illuminate\Support\Collection;

interface CollectorInterface
{
    /**
     * Fetch fresh items from the remote source.
     *
     * @return Collection<int, RawItem>
     */
    public function collect(Source $source): Collection;
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\JobRunResource;
use App\Repositories\Contracts\JobRunRepositoryInterface;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class JobRunController extends Controller
{
    public function __construct(private readonly JobRunRepositoryInterface $jobRuns) {}

    public function index(): AnonymousResourceCollection
    {
        return JobRunResource::collection(
            $this->jobRuns->latest(50),
        );
    }
}

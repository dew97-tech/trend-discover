<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default AI provider
    |--------------------------------------------------------------------------
    | 'opencode_go' or 'mock'. If the OpenCode Go key is missing at runtime,
    | the manager falls back to 'mock' automatically (with a log warning).
    */
    'default_provider' => env('AI_PROVIDER', 'opencode_go'),

    'providers' => [

        'opencode_go' => [
            'base_url' => env('OPENCODE_GO_BASE_URL', 'https://api.opencode.go/v1'),
            'api_key' => env('OPENCODE_GO_API_KEY'),
            'model' => env('OPENCODE_GO_MODEL', 'ox-alpha-free'),

            /*
            | STRICT allowlist per product decision — the provider refuses to
            | send requests for any model outside this list. Switch models via
            | OPENCODE_GO_MODEL only.
            */
            'allowed_models' => [
                'ox-alpha-free',
                'hy3',
                'mimo-v2.5',
            ],

            'timeout' => 120,
            'max_retries' => 2,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Cost control
    |--------------------------------------------------------------------------
    | Hard ceilings enforced in code; soft targets live in system_settings.
    */
    'max_tokens_per_call' => 2000,
];

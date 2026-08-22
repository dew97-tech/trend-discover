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
            // API root — the provider appends /chat/completions. Pasting the
            // full endpoint also works (defensively normalized).
            'base_url' => env('OPENCODE_GO_BASE_URL', 'https://opencode.ai/zen/go/v1'),
            'api_key' => env('OPENCODE_GO_API_KEY'),

            // Runtime override from Settings UI lives in system_settings
            // ('ai.model') and wins over this env default.
            'model' => env('OPENCODE_GO_MODEL', 'ox-alpha-free'),

            /*
            | STRICT allowlist per product decision — requests for anything
            | outside these ids are refused. Switch models via Settings.
            |
            | Profiles explain HOW each model behaves:
            |   reasoning        — model streams chain-of-thought into a
            |                      separate reasoning_content field; needs a
            |                      large output budget + reasoning_effort control
            |                      (Hy3: high/medium/low/none — Tencent Hunyuan 3)
            |   effort           — reasoning_effort sent for reasoning models
            |   max_output       — safe max_tokens ceiling for this model
            */
            'allowed_models' => [
                // NOTE: the Go tier (/zen/go/v1) exposes its own ids — always
                // cross-check against GET /settings/models (on_gateway flag)
                // rather than the public Zen docs table.
                'ox-alpha-free' => [
                    'label' => 'Ox Alpha Free',
                    'reasoning' => false,
                    'max_output' => 4096,
                ],
                'mimo-v2.5' => [
                    'label' => 'MiMo-V2.5 Free',
                    'reasoning' => true,
                    'effort' => 'low',
                    'max_output' => 8192,
                ],
                'hy3' => [
                    'label' => 'Hy3',
                    'reasoning' => true,
                    'effort' => 'none',
                    'max_output' => 16384,
                ],
            ],

            'timeout' => 120,
            'max_retries' => 2,

            /*
            | Cost-ordered fallback chain (per OpenCode Go pricing):
            | when the active model fails with gateway errors (5xx/unsupported),
            | requests walk this order — cheapest first — until one answers.
            */
            'fallback_order' => [
                'ox-alpha-free',
                'mimo-v2.5',
                'hy3',
            ],
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Cost control
    |--------------------------------------------------------------------------
    | Fallback ceiling when a profile has no max_output.
    */
    'max_tokens_per_call' => 4096,
];

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

            /*
            | The Go gateway now REQUIRES an x-opencode-session header on every
            | chat request — without it all models fail with MissingSessionID.
            | Set OPENCODE_GO_SESSION_ID to pin a value; otherwise the provider
            | generates one UUID and persists it in system_settings('ai.session_id').
            */
            'session_id' => env('OPENCODE_GO_SESSION_ID'),

            // Runtime override from Settings UI lives in system_settings
            // ('ai.model') and wins over this env default. If the stored id is
            // no longer allowlisted, the provider logs and falls back to this.
            'model' => env('OPENCODE_GO_MODEL', 'mimo-v2.5'),

            /*
            | STRICT allowlist per product decision — requests for anything
            | outside these ids are refused. Switch models via Settings.
            |
            | Profiles explain HOW each model behaves:
            |   reasoning        — model streams chain-of-thought into a
            |                      separate reasoning_content field; needs a
            |                      large output budget + reasoning_effort control
            |   effort           — reasoning_effort sent for reasoning models.
            |                      Verified live: glm-5.3-flash rejects 'none'
            |                      ("always engages in thinking") — use 'low';
            |                      mimo-v2.5 accepts 'none' for direct answers.
            |   max_output       — safe max_tokens ceiling for this model
            |
            | Verified live 2026-09-12 (tiny probe + session header):
            |   mimo-v2.5, deepseek-v4-flash, glm-5.3-flash -> working
            |   ox-alpha-free -> REMOVED (not supported), hy3 -> upstream 400
            */
            'allowed_models' => [
                // NOTE: the Go tier (/zen/go/v1) exposes its own ids — always
                // cross-check against GET /settings/models (on_gateway flag)
                // and `php artisan ai:check-models` rather than the public docs.
                'mimo-v2.5' => [
                    'label' => 'MiMo-V2.5',
                    'reasoning' => true,
                    'effort' => 'none',
                    'max_output' => 8192,
                ],
                'deepseek-v4-flash' => [
                    'label' => 'DeepSeek V4 Flash',
                    'reasoning' => true,
                    'effort' => 'low',
                    'max_output' => 8192,
                ],
                'glm-5.3-flash' => [
                    'label' => 'GLM 5.3 Flash',
                    'reasoning' => true,
                    'effort' => 'low',
                    'max_output' => 8192,
                ],
            ],

            'timeout' => 120,
            'max_retries' => 2,

            /*
            | Reliability-ordered fallback chain: when the active model fails
            | with gateway errors (5xx/unsupported) or burns its budget on
            | reasoning, requests walk this order until one answers. All Go-tier
            | calls report cost 0, so this order favors verified reliability.
            */
            'fallback_order' => [
                'mimo-v2.5',
                'deepseek-v4-flash',
                'glm-5.3-flash',
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

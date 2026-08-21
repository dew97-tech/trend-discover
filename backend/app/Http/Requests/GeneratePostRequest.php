<?php

namespace App\Http\Requests;

use App\Enums\ContentFormat;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GeneratePostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'format' => ['required', 'string', Rule::enum(ContentFormat::class)],
            'tone' => ['nullable', 'string', 'in:technical,conversational,storytelling,contrarian'],
            'angle' => ['nullable', 'string', 'max:500'],
            'force' => ['nullable', 'boolean'],
        ];
    }
}

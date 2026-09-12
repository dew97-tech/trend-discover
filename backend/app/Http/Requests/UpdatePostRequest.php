<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:255'],
            'hook' => ['sometimes', 'nullable', 'string', 'max:500'],
            'body' => ['required', 'string', 'min:50', 'max:5000'],
            'hashtags' => ['sometimes', 'array', 'max:8'],
            'hashtags.*' => ['string', 'max:30'],
        ];
    }
}

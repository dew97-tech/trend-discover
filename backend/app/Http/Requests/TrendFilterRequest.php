<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class TrendFilterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:255'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'technology_id' => ['nullable', 'integer', 'exists:technologies,id'],
            'status' => ['nullable', 'string', 'in:discovered,researching,researched,archived'],
            'min_trend_score' => ['nullable', 'numeric', 'between:0,100'],
            'min_novelty_score' => ['nullable', 'numeric', 'between:0,100'],
            'max_saturation' => ['nullable', 'numeric', 'between:0,100'],
            'from' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:50'],
            'cursor' => ['nullable', 'string'],
        ];
    }

    public function filters(): array
    {
        return $this->safe()->only([
            'search',
            'category_id',
            'technology_id',
            'status',
            'min_trend_score',
            'min_novelty_score',
            'max_saturation',
            'from',
        ]);
    }
}

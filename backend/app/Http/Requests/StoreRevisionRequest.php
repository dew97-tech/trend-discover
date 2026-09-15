<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreRevisionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'target' => ['required', 'string', 'in:hook,body'],
            'instruction' => ['required', 'string', 'min:3', 'max:1000'],
            'reference' => ['nullable', 'string', 'max:5000'],
        ];
    }
}

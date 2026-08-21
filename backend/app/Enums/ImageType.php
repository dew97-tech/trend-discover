<?php

namespace App\Enums;

enum ImageType: string
{
    case CodeSnippet = 'code_snippet';
    case Prompt = 'prompt';
    case ManualUpload = 'manual_upload';
}

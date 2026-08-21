<?php

namespace App\Enums;

enum AiGenerationKind: string
{
    case Research = 'research';
    case Post = 'post';
    case Quality = 'quality';
    case ImagePrompt = 'image_prompt';
    case Snippet = 'snippet';
    case NoveltyBatch = 'novelty_batch';
}

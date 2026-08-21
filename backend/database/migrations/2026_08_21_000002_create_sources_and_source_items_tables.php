<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sources', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('type', 32);
            $table->string('base_url')->nullable();
            $table->json('config')->nullable();
            $table->boolean('is_enabled')->default(true);
            $table->timestamp('last_collected_at')->nullable();
            $table->unsignedInteger('consecutive_failures')->default(0);
            $table->timestamps();

            $table->index(['is_enabled', 'type']);
        });

        Schema::create('source_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained()->cascadeOnDelete();
            $table->string('external_id', 255);
            $table->string('url', 1024);
            $table->string('title');
            $table->text('summary')->nullable();
            $table->string('author')->nullable();
            $table->json('metrics')->nullable();
            $table->json('metadata')->nullable();
            $table->char('content_hash', 64);
            $table->timestamp('published_at')->nullable();
            $table->timestamp('normalized_at')->nullable();
            $table->timestamps();

            $table->unique(['source_id', 'external_id']);
            $table->index('content_hash');
            $table->index('published_at');
            $table->index(['normalized_at', 'published_at']);
            $table->fullText('title');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('source_items');
        Schema::dropIfExists('sources');
    }
};

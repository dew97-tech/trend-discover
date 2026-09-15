<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('post_revisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('content_post_id')->constrained()->cascadeOnDelete();
            $table->string('target', 8);                // hook | body
            $table->text('instruction');
            $table->text('reference')->nullable();      // optional pasted "better version"
            $table->text('hook_before')->nullable();
            $table->longText('body_before');
            $table->text('hook_after')->nullable();
            $table->longText('body_after')->nullable();
            $table->text('notes')->nullable();          // AI summary of what changed
            $table->string('status', 12)->default('pending'); // pending|ready|failed|applied|discarded
            $table->string('error', 500)->nullable();
            $table->timestamps();

            $table->index(['content_post_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_revisions');
    }
};

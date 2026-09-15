<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('trends', function (Blueprint $table) {
            // Manual workflow state (draft|ready|posted) — separate from the
            // automation-owned `status` lifecycle column.
            $table->string('workflow_status', 16)->default('draft')->after('status');
            $table->index(['workflow_status', 'trend_score']);
        });
    }

    public function down(): void
    {
        Schema::table('trends', function (Blueprint $table) {
            $table->dropIndex(['workflow_status', 'trend_score']);
            $table->dropColumn('workflow_status');
        });
    }
};

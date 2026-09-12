<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('trends', function (Blueprint $table) {
            $table->decimal('focus_score', 5, 2)->nullable()->after('usefulness_score');
        });
    }

    public function down(): void
    {
        Schema::table('trends', function (Blueprint $table) {
            $table->dropColumn('focus_score');
        });
    }
};

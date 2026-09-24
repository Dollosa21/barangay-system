<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['student_applications', 'beneficiary_applications', 'livelihood_applications'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table): void {
                $table->date('release_date')->nullable()->index();
                $table->decimal('release_amount', 12, 2)->nullable();
            });
        }
    }

    public function down(): void
    {
        foreach (['student_applications', 'beneficiary_applications', 'livelihood_applications'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table): void {
                $table->dropIndex(['release_date']);
                $table->dropColumn(['release_date', 'release_amount']);
            });
        }
    }
};

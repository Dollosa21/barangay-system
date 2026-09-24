<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('livelihood_applications', function (Blueprint $table): void {
            $table->string('program', 150)->nullable()->index()->after('project_name');
        });
    }

    public function down(): void
    {
        Schema::table('livelihood_applications', function (Blueprint $table): void {
            $table->dropColumn('program');
        });
    }
};

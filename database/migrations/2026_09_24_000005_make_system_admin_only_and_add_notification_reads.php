<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->timestamp('notifications_read_at')->nullable()->index();
        });

        DB::table('users')->update([
            'role' => 'administrator',
            'notifications_read_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropIndex(['notifications_read_at']);
            $table->dropColumn('notifications_read_at');
        });
    }
};

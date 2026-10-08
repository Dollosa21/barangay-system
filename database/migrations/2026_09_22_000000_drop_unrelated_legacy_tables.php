<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $requiredTables = array_map('strtolower', [
            config('database.migrations.table', 'migrations'),
            'users',
            'password_reset_tokens',
            'sessions',
            'cache',
            'cache_locks',
            'jobs',
            'job_batches',
            'failed_jobs',
            'program_records',
            'beneficiary_applications',
            'livelihood_applications',
            'audit_logs',
            'program_qualification_rules',
        ]);

        Schema::disableForeignKeyConstraints();
        try {
            $tables = DB::connection()->getDriverName() === 'mysql'
                ? array_map(fn ($row) => array_values((array) $row)[0] ?? null, DB::select('SHOW TABLES'))
                : Schema::getTableListing(schemaQualified: false);

            foreach ($tables as $table) {
                if (is_string($table) && ! in_array(strtolower($table), $requiredTables, true)) Schema::drop($table);
            }
        } finally {
            Schema::enableForeignKeyConstraints();
        }
    }

    public function down(): void
    {
    }
};
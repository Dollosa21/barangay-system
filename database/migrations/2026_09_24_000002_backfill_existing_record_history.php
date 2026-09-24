<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        foreach ([
            'student_applications' => 'student',
            'beneficiary_applications' => 'beneficiary',
            'livelihood_applications' => 'livelihood',
        ] as $table => $type) {
            if (! DB::getSchemaBuilder()->hasTable($table)) continue;
            DB::table($table)->orderBy('id')->chunkById(100, function ($records) use ($type): void {
                foreach ($records as $record) {
                    $exists = DB::table('audit_logs')->where('reference', $record->reference)->exists();
                    if ($exists) continue;
                    $timestamp = $record->created_at ?? $record->submitted_at ?? now();
                    DB::table('audit_logs')->insert([
                        'user_id' => $record->user_id,
                        'action' => 'application.created',
                        'record_type' => $type,
                        'record_id' => (string) $record->id,
                        'reference' => $record->reference,
                        'ip_address' => null,
                        'metadata' => json_encode(['legacy_import' => true]),
                        'created_at' => $timestamp,
                        'updated_at' => $timestamp,
                    ]);
                }
            });
        }

        if (DB::getSchemaBuilder()->hasTable('program_records')) {
            DB::table('program_records')->orderBy('id')->chunkById(100, function ($records): void {
                foreach ($records as $record) {
                    $exists = DB::table('audit_logs')->where('reference', $record->reference)->exists();
                    if ($exists) continue;
                    $timestamp = $record->created_at ?? $record->submitted_at ?? now();
                    DB::table('audit_logs')->insert([
                        'user_id' => $record->user_id,
                        'action' => $record->type . '.created',
                        'record_type' => $record->type,
                        'record_id' => (string) $record->id,
                        'reference' => $record->reference,
                        'ip_address' => null,
                        'metadata' => json_encode(['legacy_import' => true]),
                        'created_at' => $timestamp,
                        'updated_at' => $timestamp,
                    ]);
                }
            });
        }
    }

    public function down(): void
    {
        DB::table('audit_logs')->where('metadata->legacy_import', true)->delete();
    }
};

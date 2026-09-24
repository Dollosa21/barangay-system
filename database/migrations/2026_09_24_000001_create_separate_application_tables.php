<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $createApplicationTable = function (string $name, bool $livelihood = false): void {
            Schema::create($name, function (Blueprint $table) use ($livelihood): void {
                $table->id();
                $table->foreignId('user_id')->constrained()->restrictOnDelete();
                $table->string('reference', 32)->unique();
                $table->string('full_name', 180)->index();
                if ($livelihood) {
                    $table->string('project_name', 180)->index();
                } else {
                    $table->date('birth_date')->nullable()->index();
                    $table->string('program', 150)->nullable()->index();
                }
                $table->string('status', 20)->default('Pending')->index();
                $table->longText('data'); 
                $table->timestamp('submitted_at')->useCurrent()->index();
                $table->timestamps();
            });
        };

        $createApplicationTable('student_applications');
        $createApplicationTable('beneficiary_applications');
        $createApplicationTable('livelihood_applications', true);

        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 80)->index();
            $table->string('record_type', 40)->nullable()->index();
            $table->string('record_id', 40)->nullable();
            $table->string('reference', 32)->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });


        DB::table('program_records')
            ->whereIn('type', ['student', 'beneficiary', 'livelihood'])
            ->orderBy('id')
            ->chunkById(100, function ($records): void {
                foreach ($records as $record) {
                    $data = is_array($record->data) ? $record->data : json_decode($record->data ?? '{}', true);
                    $data = is_array($data) ? $data : [];
                    $table = match ($record->type) {
                        'student' => 'student_applications',
                        'beneficiary' => 'beneficiary_applications',
                        default => 'livelihood_applications',
                    };
                    $entry = [
                        'user_id' => $record->user_id,
                        'reference' => $record->reference,
                        'full_name' => $record->full_name,
                        'status' => $record->status,
                        'data' => Crypt::encryptString(json_encode($data, JSON_THROW_ON_ERROR)),
                        'submitted_at' => $record->submitted_at,
                        'created_at' => $record->created_at,
                        'updated_at' => $record->updated_at,
                    ];
                    if ($record->type === 'livelihood') {
                        $entry['project_name'] = $data['Business / project name'] ?? 'Unnamed project';
                    } else {
                        $entry['birth_date'] = $data['Birth date'] ?? null;
                        $entry['program'] = $data['Assistance program'] ?? $data['Support requested'] ?? null;
                    }
                    DB::table($table)->insert($entry);
                }
            });

        DB::table('program_records')->whereIn('type', ['student', 'beneficiary', 'livelihood'])->delete();
    }

    public function down(): void
    {
        foreach (['student_applications' => 'student', 'beneficiary_applications' => 'beneficiary', 'livelihood_applications' => 'livelihood'] as $table => $type) {
            if (! Schema::hasTable($table)) continue;
            foreach (DB::table($table)->orderBy('id')->get() as $record) {
                $data = json_decode(Crypt::decryptString($record->data), true) ?: [];
                DB::table('program_records')->insert([
                    'user_id' => $record->user_id,
                    'type' => $type,
                    'reference' => $record->reference,
                    'full_name' => $record->full_name,
                    'program' => $type === 'livelihood' ? ($data['Support requested'] ?? null) : $record->program,
                    'status' => $record->status,
                    'data' => json_encode($data, JSON_THROW_ON_ERROR),
                    'submitted_at' => $record->submitted_at,
                    'created_at' => $record->created_at,
                    'updated_at' => $record->updated_at,
                ]);
            }
            Schema::dropIfExists($table);
        }
        Schema::dropIfExists('audit_logs');
    }
};

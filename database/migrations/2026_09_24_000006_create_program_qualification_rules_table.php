<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('program_qualification_rules', function (Blueprint $table): void {
            $table->id();
            $table->string('program', 120)->unique();
            $table->json('required_documents');
            $table->string('required_activity', 150)->nullable();
            $table->timestamps();
        });

        $now = now();
        foreach ([
            ['Food assistance', ['Valid barangay ID', 'Proof of residency'], 'Community assembly'],
            ['Medical assistance', ['Valid barangay ID', 'Medical certificate'], 'Health assessment'],
            ['Educational assistance', ['Valid barangay ID', 'School enrollment document'], 'Orientation'],
            ['Senior citizen support', ['Valid barangay ID', 'Senior citizen ID'], 'Community assembly'],
            ['Emergency relief', ['Valid barangay ID'], 'Emergency validation'],
        ] as [$program, $documents, $activity]) {
            DB::table('program_qualification_rules')->insert([
                'program' => $program,
                'required_documents' => json_encode($documents),
                'required_activity' => $activity,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('program_qualification_rules');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('student_applications', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('reference', 32)->unique();
            $table->string('full_name', 180)->index();
            $table->date('birth_date')->nullable()->index();
            $table->string('program', 150)->nullable()->index();
            $table->string('status', 20)->default('Pending')->index();
            $table->date('release_date')->nullable()->index();
            $table->decimal('release_amount', 12, 2)->nullable();
            $table->longText('data');
            $table->timestamp('submitted_at')->useCurrent()->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_applications');
    }
};
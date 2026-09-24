<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{



    public function up(): void
    {
        Schema::create('program_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 30)->index();
            $table->string('reference', 32)->unique();
            $table->string('full_name')->index();
            $table->string('program')->nullable()->index();
            $table->string('status', 20)->default('Pending')->index();
            $table->json('data');
            $table->timestamp('submitted_at')->useCurrent();
            $table->timestamps();
        });
    }




    public function down(): void
    {
        Schema::dropIfExists('program_records');
    }
};

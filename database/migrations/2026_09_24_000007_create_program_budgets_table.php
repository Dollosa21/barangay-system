<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('program_budgets', function (Blueprint $table): void {
            $table->id();
            $table->string('program', 120);
            $table->unsignedSmallInteger('fiscal_year');
            $table->decimal('allocated_amount', 14, 2)->default(0);
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
            $table->unique(['program', 'fiscal_year']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('program_budgets');
    }
};

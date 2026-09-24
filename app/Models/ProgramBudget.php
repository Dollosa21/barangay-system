<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProgramBudget extends Model
{
    protected $fillable = ['program', 'fiscal_year', 'allocated_amount', 'user_id'];

    protected function casts(): array
    {
        return ['fiscal_year' => 'integer', 'allocated_amount' => 'decimal:2'];
    }
}

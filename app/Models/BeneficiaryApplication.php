<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BeneficiaryApplication extends Model
{
    protected $fillable = ['user_id', 'reference', 'full_name', 'birth_date', 'program', 'status', 'release_date', 'release_amount', 'data', 'submitted_at'];

    protected function casts(): array
    {
        return ['birth_date' => 'date:Y-m-d', 'release_date' => 'date:Y-m-d', 'release_amount' => 'decimal:2', 'data' => 'encrypted:array', 'submitted_at' => 'datetime'];
    }
}

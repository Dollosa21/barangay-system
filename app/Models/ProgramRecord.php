<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProgramRecord extends Model
{
    protected $fillable = ['user_id', 'type', 'reference', 'full_name', 'program', 'status', 'data', 'submitted_at'];

    protected function casts(): array
    {
        return ['data' => 'array', 'submitted_at' => 'datetime'];
    }
}

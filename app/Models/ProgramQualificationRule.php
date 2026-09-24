<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProgramQualificationRule extends Model
{
    protected $fillable = ['program', 'required_documents', 'required_activity'];

    protected function casts(): array
    {
        return ['required_documents' => 'array'];
    }
}

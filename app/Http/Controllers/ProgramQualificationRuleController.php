<?php

namespace App\Http\Controllers;

use App\Models\ProgramQualificationRule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProgramQualificationRuleController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => ProgramQualificationRule::query()->orderBy('program')->get()]);
    }

    public function update(Request $request, string $program): JsonResponse
    {
        $rule = ProgramQualificationRule::query()->where('program', $program)->firstOrFail();
        $validated = $request->validate([
            'required_documents' => 'required|array|min:1|max:20',
            'required_documents.*' => 'required|string|max:150|distinct',
            'required_activity' => 'nullable|string|max:150',
        ]);
        $documents = array_values(array_filter(array_map('trim', $validated['required_documents']), fn (string $document): bool => $document !== ''));
        if (! $documents) return response()->json(['message' => 'Add at least one non-empty required document.'], 422);
        $rule->update([
            'required_documents' => $documents,
            'required_activity' => trim((string) ($validated['required_activity'] ?? '')) ?: null,
        ]);

        return response()->json(['message' => 'Qualification rule saved.', 'data' => $rule->fresh()]);
    }
}

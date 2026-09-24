<?php

namespace App\Http\Controllers;

use App\Models\ProgramRecord;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ProgramRecordController extends Controller
{
    public function index(Request $request)
    {
        $query = ProgramRecord::query()->latest('submitted_at');

        if ($request->filled('type')) {
            $query->where('type', (string) $request->input('type'));
        }

        if ($request->filled('status')) {
            $query->where('status', (string) $request->input('status'));
        }

        if ($request->filled('audience')) {
            $query->where('data->audience', (string) $request->input('audience'));
        }

        if ($request->filled('q')) {
            $term = trim((string) $request->input('q'));
            $query->where(fn ($builder) => $builder
                ->where('full_name', 'like', "%{$term}%")
                ->orWhere('reference', 'like', "%{$term}%")
                ->orWhere('program', 'like', "%{$term}%"));
        }

        return $query->paginate(min(max((int) $request->input('per_page', 50), 1), 100));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'type' => 'required|in:student,beneficiary,livelihood,attendance,training',
            'data' => 'required|array',
        ]);

        $specificRules = match ($validated['type']) {
            'student', 'beneficiary' => [
                'data.First name' => 'required|string|max:100',
                'data.Last name' => 'required|string|max:100',
                'data.Birth date' => 'required|date',
            ],
            'livelihood' => [
                'data.Applicant / owner name' => 'required|string|max:150',
                'data.Business / project name' => 'required|string|max:150',
            ],
            'attendance' => [
                'data.participantName' => 'required|string|max:150',
                'data.activity' => 'required|string|max:150',
                'data.date' => 'required|date',
                'data.status' => 'required|in:Present,Absent,Late',
            ],
            'training' => [
                'data.title' => 'required|string|max:150',
                'data.date' => 'required|date',
                'data.location' => 'required|string|max:150',
            ],
        };
        $request->validate($specificRules);

        $data = $validated['data'];
        $name = $data['Applicant / owner name'] ?? trim(implode(' ', array_filter([
            $data['First name'] ?? '', $data['Middle name'] ?? '', $data['Last name'] ?? '',
        ])));

        if ($validated['type'] === 'attendance') {
            $name = $data['participantName'] ?? '';
            $participant = ProgramRecord::query()->whereIn('type', ['student', 'beneficiary', 'livelihood'])->where('full_name', $name)->first();
            if (! $participant) {
                return response()->json(['message' => 'Choose a registered student, beneficiary, or livelihood participant.'], 422);
            }
            $data['participantReference'] = $participant?->reference;
            $data['beneficiaryReference'] = in_array($participant?->type, ['student', 'beneficiary'], true) ? $participant->reference : null;
            if (($data['participantType'] ?? '') === 'Student' && str_contains(strtolower($data['activity'] ?? ''), 'orientation')) {
                $data['activity'] = 'Orientation';
            }
            if (strtolower($data['activity'] ?? '') === 'senior citizen briefing') {
                $data['activity'] = 'Community assembly';
            }
            if (($data['status'] ?? '') === 'Present') $data['status'] = 'Attended';
        }
        if ($validated['type'] === 'training') {
            $name = $data['title'] ?? 'Program activity';
        }

        if ($name === '') {
            return response()->json(['message' => 'A name is required.'], 422);
        }

        if (in_array($validated['type'], ['student', 'beneficiary'], true) && ! empty($data['Birth date'])) {
            $duplicate = ProgramRecord::query()->where('type', $validated['type'])
                ->where('full_name', $name)->where('data->Birth date', $data['Birth date'])->first();
            if ($duplicate) return response()->json(['message' => 'A matching application already exists (' . $duplicate->reference . ').'], 422);
        }
        if ($validated['type'] === 'livelihood' && ! empty($data['Business / project name'])) {
            $duplicate = ProgramRecord::query()->where('type', 'livelihood')->where('full_name', $name)
                ->where('data->Business / project name', $data['Business / project name'])->first();
            if ($duplicate) return response()->json(['message' => 'A matching livelihood record already exists (' . $duplicate->reference . ').'], 422);
        }
        if ($validated['type'] === 'attendance') {
            $existing = ProgramRecord::query()->where('type', 'attendance')
                ->where('full_name', $name)
                ->where('data->activity', $data['activity'])
                ->where('data->date', $data['date'])
                ->first();
            if ($existing) {
                $oldStatus = $existing->status;
                $history = $existing->data['history'] ?? [];
                $history[] = [
                    'action' => 'Attendance changed from ' . $oldStatus . ' to ' . $data['status'],
                    'user_id' => $request->user()->id,
                    'at' => now()->toIso8601String(),
                ];
                $data['history'] = $history;
                $existing->data = $data;
                $existing->status = $data['status'];
                $existing->save();
                return response()->json($existing, 200);
            }
        }

        $program = $data['Assistance program'] ?? $data['Support requested'] ?? $data['program'] ?? null;
        $prefix = ['student' => 'EDU', 'beneficiary' => 'BEN', 'livelihood' => 'LIV', 'attendance' => 'ATT', 'training' => 'TRN'][$validated['type']];

        $record = ProgramRecord::create([
            'user_id' => $request->user()->id,
            'type' => $validated['type'],
            'reference' => $prefix . '-' . Str::upper(Str::random(8)),
            'full_name' => $name,
            'program' => $program,
            'status' => $validated['type'] === 'attendance' ? ($data['status'] ?? 'Attended') : ($validated['type'] === 'training' ? 'Scheduled' : 'Pending'),
            'data' => $data,
        ]);

        return response()->json($record, 201);
    }

    public function update(Request $request, ProgramRecord $record)
    {
        $validated = $request->validate([
            'status' => 'sometimes|required|in:Pending,Approved,Rejected,Released',
            'data' => 'sometimes|required|array',
        ]);

        if (($validated['status'] ?? null) === 'Released') {
            $hasReleaseDate = ! empty($validated['data']['Release date'] ?? $record->data['Release date'] ?? null);
            if ($record->status !== 'Approved' && $record->status !== 'Released') {
                return response()->json(['message' => 'Approve the application before recording a release.'], 422);
            }
            if (! $hasReleaseDate) {
                return response()->json(['message' => 'Enter the release date before marking assistance as released.'], 422);
            }
        }

        if (($validated['status'] ?? null) === 'Approved' && in_array($record->type, ['student', 'beneficiary'], true)) {
            $program = $record->data['Assistance program'] ?? '';
            $requirementsByProgram = [
                'Food assistance' => ['Valid barangay ID', 'Proof of residency'],
                'Medical assistance' => ['Valid barangay ID', 'Medical certificate'],
                'Educational assistance' => ['Valid barangay ID', 'School enrollment document'],
                'Senior citizen support' => ['Valid barangay ID', 'Senior citizen ID'],
                'Emergency relief' => ['Valid barangay ID'],
            ];
            $activityByProgram = [
                'Food assistance' => 'Community assembly', 'Medical assistance' => 'Health assessment',
                'Educational assistance' => 'Orientation', 'Senior citizen support' => 'Community assembly',
                'Emergency relief' => 'Emergency validation',
            ];
            $required = $requirementsByProgram[$program] ?? ['Valid barangay ID'];
            $submitted = $record->data['requirements'] ?? [];
            $missing = array_diff($required, is_array($submitted) ? $submitted : []);
            $activity = $activityByProgram[$program] ?? 'Community assembly';
            $attended = ProgramRecord::query()->where('type', 'attendance')
                ->where('data->beneficiaryReference', $record->reference)
                ->where('data->activity', $activity)
                ->where('status', 'Attended')->exists();
            if ($missing || ! $attended) {
                return response()->json(['message' => 'Approval requires all listed documents and the assigned activity attendance.'], 422);
            }
        }

        $previousStatus = $record->status;
        $record->fill($validated);
        if ($previousStatus !== $record->status) {
            $data = $record->data ?? [];
            $history = $data['history'] ?? [];
            $history[] = [
                'action' => 'Status changed from ' . $previousStatus . ' to ' . $record->status,
                'user_id' => $request->user()->id,
                'at' => now()->toIso8601String(),
            ];
            $data['history'] = $history;
            $record->data = $data;
        }
        if (isset($validated['data'])) {
            $record->full_name = $validated['data']['Applicant / owner name'] ?? trim(implode(' ', array_filter([
                $validated['data']['First name'] ?? '', $validated['data']['Middle name'] ?? '', $validated['data']['Last name'] ?? '',
            ]))) ?: $record->full_name;
        }
        $record->save();

        return $record;
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\BeneficiaryApplication;
use App\Models\LivelihoodApplication;
use App\Models\ProgramQualificationRule;
use App\Models\ProgramRecord;
use App\Models\StudentApplication;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProgramManagementController extends Controller
{
    private const APPLICATION_MODELS = [
        'student' => StudentApplication::class,
        'beneficiary' => BeneficiaryApplication::class,
        'livelihood' => LivelihoodApplication::class,
    ];

    public function index(Request $request)
    {
        $filters = $request->validate([
            'type' => 'nullable|in:student,beneficiary,livelihood,attendance,training',
            'q' => 'nullable|string|max:150',
            'status' => 'nullable|string|max:30',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);
        $type = $filters['type'] ?? null;
        $term = trim($filters['q'] ?? '');

        if (isset(self::APPLICATION_MODELS[$type])) {
            $model = self::APPLICATION_MODELS[$type];
            $query = $model::query();
            if (! empty($filters['status'])) $query->where('status', $filters['status']);
            if ($term !== '') $query->where(fn (Builder $builder) => $builder
                ->where('full_name', 'like', "%{$term}%")
                ->orWhere('reference', 'like', "%{$term}%")
                ->orWhere($type === 'livelihood' ? 'project_name' : 'program', 'like', "%{$term}%"));

            $page = $query->latest('submitted_at')->paginate($filters['per_page'] ?? 50)->withQueryString();
            $page->getCollection()->transform(fn ($record) => $this->applicationPayload($type, $record));

            return response()->json([
                'data' => $page->items(),
                'links' => ['first' => $page->url(1), 'last' => $page->url($page->lastPage()), 'prev' => $page->previousPageUrl(), 'next' => $page->nextPageUrl()],
                'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
            ]);
        }

        if (in_array($type, ['attendance', 'training'], true)) {
            $query = ProgramRecord::query()->where('type', $type);
            if (! empty($filters['status'])) $query->where('status', $filters['status']);
            if ($term !== '') $query->where(fn (Builder $builder) => $builder
                ->where('full_name', 'like', "%{$term}%")
                ->orWhere('reference', 'like', "%{$term}%")
                ->orWhere('program', 'like', "%{$term}%")
                ->orWhere('data->activity', 'like', "%{$term}%"));

            $page = $query->latest('submitted_at')->paginate($filters['per_page'] ?? 50)->withQueryString();
            return response()->json(['data' => $page->items(), 'links' => ['first' => $page->url(1), 'last' => $page->url($page->lastPage()), 'prev' => $page->previousPageUrl(), 'next' => $page->nextPageUrl()], 'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()]]);
        }

        return response()->json(['message' => 'Choose a student, beneficiary, livelihood, attendance, or training record type.'], 422);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'type' => 'required|in:student,beneficiary,livelihood,attendance,training',
            'data' => 'required|array',
        ]);
        $type = $validated['type'];
        $data = $validated['data'];

        $rules = match ($type) {
            'student' => [
                'data.First name' => 'required|string|max:100',
                'data.Middle name' => 'nullable|string|max:100',
                'data.Last name' => 'required|string|max:100',
                'data.Birth date' => 'required|date|before:today',
                'data.Contact number' => 'required|string|max:30',
                'data.Complete address' => 'required|string|max:255',
                'data.School name' => 'required|string|max:180',
                'data.Grade / year level' => 'required|string|max:80',
                'data.Assistance program' => 'required|string|exists:program_qualification_rules,program',
                'data.Requested assistance' => 'required|string|max:180',
            ],
            'beneficiary' => [
                'data.First name' => 'required|string|max:100',
                'data.Middle name' => 'nullable|string|max:100',
                'data.Last name' => 'required|string|max:100',
                'data.Birth date' => 'required|date|before:today',
                'data.Contact number' => 'required|string|max:30',
                'data.Complete address' => 'required|string|max:255',
                'data.Assistance program' => 'required|string|exists:program_qualification_rules,program',
                'data.Requested assistance' => 'required|string|max:180',
            ],
            'livelihood' => [
                'data.Applicant / owner name' => 'required|string|max:150',
                'data.Contact number' => 'required|string|max:30',
                'data.Business type' => 'required|string|max:100',
                'data.Business / project name' => 'required|string|max:150',
                'data.Business location' => 'required|string|max:255',
                'data.Estimated capital' => 'required|numeric|min:0|max:999999999.99',
                'data.Expected workers' => 'required|integer|min:0|max:10000',
                'data.Support requested' => 'required|string|max:180',
                'data.Project description' => 'required|string|max:2000',
            ],
            'attendance' => [
                'data.participantReference' => 'required|string|max:32',
                'data.activity' => 'required|string|max:150',
                'data.date' => 'required|date',
                'data.status' => 'required|in:Present,Absent,Late',
                'data.trainingReference' => 'nullable|string|max:32',
            ],
            'training' => [
                'data.title' => 'required|string|max:150',
                'data.program' => 'required|string|max:150',
                'data.date' => 'required|date',
                'data.time' => 'nullable|date_format:H:i',
                'data.capacity' => 'nullable|integer|min:1|max:500',
                'data.location' => 'required|string|max:180',
            ],
        };
        $request->validate($rules);

        if (isset(self::APPLICATION_MODELS[$type])) return $this->storeApplication($request, $type, $data);
        if ($type === 'attendance') return $this->storeAttendance($request, $data);

        $record = ProgramRecord::create([
            'user_id' => $request->user()->id,
            'type' => 'training',
            'reference' => 'TRN-' . Str::upper(Str::random(8)),
            'full_name' => $data['title'],
            'program' => $data['program'],
            'status' => 'Scheduled',
            'data' => $data,
        ]);
        $this->audit($request, 'training.created', 'training', $record->id, $record->reference);

        return response()->json($record, 201);
    }

    private function storeApplication(Request $request, string $type, array $data)
    {
        $name = in_array($type, ['student', 'beneficiary'], true)
            ? trim(implode(' ', array_filter([$data['First name'], $data['Middle name'] ?? '', $data['Last name']])))
            : trim($data['Applicant / owner name']);
        $model = self::APPLICATION_MODELS[$type];
        $duplicate = $model::query()->where('full_name', $name)
            ->when(in_array($type, ['student', 'beneficiary'], true), fn (Builder $query) => $query->whereDate('birth_date', $data['Birth date']))
            ->when($type === 'livelihood', fn (Builder $query) => $query->where('project_name', $data['Business / project name']))
            ->first();
        if ($duplicate) return response()->json(['message' => 'A matching application already exists (' . $duplicate->reference . ').'], 422);

        $record = $model::create([
            'user_id' => $request->user()->id,
            'reference' => ($type === 'student' ? 'STU-' : ($type === 'beneficiary' ? 'BEN-' : 'LIV-')) . Str::upper(Str::random(8)),
            'full_name' => $name,
            'birth_date' => $data['Birth date'] ?? null,
            'program' => in_array($type, ['student', 'beneficiary'], true) ? $data['Assistance program'] : $data['Support requested'],
            'project_name' => $type === 'livelihood' ? $data['Business / project name'] : null,
            'status' => 'Pending',
            'data' => $data,
        ]);
        $this->audit($request, 'application.created', $type, $record->id, $record->reference);

        return response()->json($this->applicationPayload($type, $record), 201);
    }

    private function storeAttendance(Request $request, array $data)
    {
        $participant = null;
        $participantType = null;
        foreach (self::APPLICATION_MODELS as $candidateType => $model) {
            $participant = $model::query()->where('reference', $data['participantReference'])->first();
            if ($participant) {
                $participantType = $candidateType;
                break;
            }
        }
        if (! $participant) return response()->json(['message' => 'Select a registered student, beneficiary, or livelihood participant.'], 422);

        $data['participantName'] = $participant->full_name;
        $data['participantType'] = $participantType;
        $data['beneficiaryReference'] = in_array($participantType, ['student', 'beneficiary'], true) ? $participant->reference : null;
        if (! empty($data['trainingReference'])) {
            $training = ProgramRecord::query()->where('type', 'training')->where('reference', $data['trainingReference'])->first();
            if (! $training) return response()->json(['message' => 'Select a valid scheduled training.'], 422);
            $data['activity'] = $training->data['title'];
            $data['program'] = $training->program;
        }

        return DB::transaction(function () use ($request, $data, $participant): \Illuminate\Http\JsonResponse {
            $record = ProgramRecord::query()->where('type', 'attendance')
                ->where('data->participantReference', $participant->reference)
                ->where('data->activity', $data['activity'])
                ->where('data->date', $data['date'])
                ->first();
            if ($record) {
                $record->data = array_merge($record->data ?? [], $data);
                $record->status = $data['status'];
                $record->save();
                $this->audit($request, 'attendance.updated', 'attendance', $record->id, $record->reference, ['status' => $record->status]);
                return response()->json($record);
            }

            $record = ProgramRecord::create([
                'user_id' => $request->user()->id,
                'type' => 'attendance',
                'reference' => 'ATT-' . Str::upper(Str::random(8)),
                'full_name' => $participant->full_name,
                'program' => $data['program'] ?? $data['activity'],
                'status' => $data['status'],
                'data' => $data,
            ]);
            $this->audit($request, 'attendance.created', 'attendance', $record->id, $record->reference, ['status' => $record->status]);
            return response()->json($record, 201);
        });
    }

    public function update(Request $request, string $record)
    {
        if (preg_match('/^(student|beneficiary|livelihood)-(\d+)$/', $record, $matches)) {
            return $this->updateApplication($request, $matches[1], (int) $matches[2]);
        }
        if (! preg_match('/^(attendance|training)-(\d+)$/', $record, $matches)) abort(404);

        $entry = ProgramRecord::query()->where('type', $matches[1])->findOrFail((int) $matches[2]);
        $allowedStatuses = $entry->type === 'training' ? 'Scheduled,Completed,Cancelled' : 'Present,Absent,Late';
        $validated = $request->validate(['status' => 'sometimes|required|in:' . $allowedStatuses, 'data' => 'sometimes|required|array']);
        $previousStatus = $entry->status;
        if (isset($validated['status'])) $entry->status = $validated['status'];
        if (isset($validated['data'])) $entry->data = array_merge($entry->data ?? [], $validated['data']);
        $entry->save();
        $this->audit($request, 'record.updated', $entry->type, $entry->id, $entry->reference, ['from' => $previousStatus, 'to' => $entry->status]);

        return response()->json($entry);
    }

    private function updateApplication(Request $request, string $type, int $id)
    {
        $application = self::APPLICATION_MODELS[$type]::query()->findOrFail($id);
        $validated = $request->validate([
            'status' => 'sometimes|required|in:Pending,Approved,Rejected,Released',
            'data' => 'sometimes|required|array',
            'data.Review note' => 'sometimes|nullable|string|max:1000',
            'data.verifiedRequirements' => 'sometimes|array',
            'data.verifiedRequirements.*' => 'required|string|max:150',
            'data.Release amount' => 'sometimes|nullable|numeric|min:0|max:9999999999.99',
            'data.Release date' => 'sometimes|nullable|date',
        ]);
        $details = array_merge($application->data ?? [], $validated['data'] ?? []);
        $oldStatus = $application->status;
        $newStatus = $validated['status'] ?? $oldStatus;

        if ($newStatus === 'Rejected' && trim((string) ($details['Review note'] ?? '')) === '') {
            return response()->json(['message' => 'Add a review note before rejecting an application.'], 422);
        }
        if ($newStatus === 'Approved' && in_array($type, ['student', 'beneficiary'], true)) {
            $qualification = $this->beneficiaryQualification($application, $details);
            if (! $qualification['eligible']) return response()->json(['message' => $qualification['message'], 'qualification' => $qualification], 422);
        }
        if ($newStatus === 'Released') {
            if ($oldStatus !== 'Approved') return response()->json(['message' => 'Approve the application before recording a release.'], 422);
            if (empty($details['Release date'])) return response()->json(['message' => 'Enter the release date before marking assistance as released.'], 422);
            if (! isset($details['Release amount']) || $details['Release amount'] === '') return response()->json(['message' => 'Enter the release amount. Use 0 for in-kind assistance.'], 422);
        }

        if ($newStatus !== $oldStatus) {
            $details['history'] = $details['history'] ?? [];
            $details['history'][] = ['action' => 'Status changed from ' . $oldStatus . ' to ' . $newStatus, 'user_id' => $request->user()->id, 'at' => now()->toIso8601String()];
        }
        $application->data = $details;
        $application->status = $newStatus;
        if (in_array($type, ['student', 'beneficiary'], true)) {
            $application->full_name = trim(implode(' ', array_filter([$details['First name'] ?? '', $details['Middle name'] ?? '', $details['Last name'] ?? '']))) ?: $application->full_name;
            $application->program = $details['Assistance program'] ?? $application->program;
        } else {
            $application->full_name = $details['Applicant / owner name'] ?? $application->full_name;
            $application->program = $details['Support requested'] ?? $application->program;
            $application->project_name = $details['Business / project name'] ?? $application->project_name;
        }
        $application->release_date = $details['Release date'] ?? null;
        $application->release_amount = $details['Release amount'] ?? null;
        $application->save();

        if ($newStatus !== $oldStatus || isset($validated['data'])) {
            $this->audit($request, $newStatus !== $oldStatus ? 'application.status_changed' : 'application.updated', $type, $application->id, $application->reference, ['from' => $oldStatus, 'to' => $newStatus]);
        }

        return response()->json($this->applicationPayload($type, $application));
    }

    private function beneficiaryQualification($application, array $details): array
    {
        $rule = ProgramQualificationRule::query()->where('program', $details['Assistance program'] ?? $application->program)->first();
        if (! $rule) return ['eligible' => false, 'missing_documents' => [], 'required_activity' => null, 'activity_attended' => false, 'message' => 'Assign a qualification rule to this assistance program before approving.'];

        $verified = array_unique($details['verifiedRequirements'] ?? []);
        $missing = array_values(array_diff($rule->required_documents ?? [], $verified));
        $activityAttended = ! $rule->required_activity || ProgramRecord::query()->where('type', 'attendance')
            ->where('data->beneficiaryReference', $application->reference)
            ->where('data->activity', $rule->required_activity)
            ->whereIn('status', ['Present', 'Attended'])->exists();
        $eligible = ! $missing && $activityAttended;

        return [
            'eligible' => $eligible,
            'missing_documents' => $missing,
            'required_activity' => $rule->required_activity,
            'activity_attended' => $activityAttended,
            'message' => $eligible ? 'Beneficiary meets the program requirements.' : 'Verify all required documents and record attendance at the assigned activity before approval.',
        ];
    }

    public function history(Request $request, string $record)
    {
        if (preg_match('/^(student|beneficiary|livelihood)-(\d+)$/', $record, $matches)) {
            $type = $matches[1];
            $model = self::APPLICATION_MODELS[$type]::query()->findOrFail((int) $matches[2]);
        } elseif (preg_match('/^(attendance|training)-(\d+)$/', $record, $matches)) {
            $type = $matches[1];
            $model = ProgramRecord::query()->where('type', $type)->findOrFail((int) $matches[2]);
        } else {
            abort(404);
        }

        $history = AuditLog::query()->with('user:id,name')->where('reference', $model->reference)->oldest()->get()->map(fn (AuditLog $entry): array => [
            'action' => Str::headline(str_replace('.', ' ', $entry->action)),
            'from' => $entry->metadata['from'] ?? null,
            'to' => $entry->metadata['to'] ?? $entry->metadata['status'] ?? null,
            'user' => $entry->user?->name ?? 'Administrator',
            'at' => $entry->created_at?->toIso8601String(),
        ])->all();

        return response()->json(['reference' => $model->reference, 'full_name' => $model->full_name, 'history' => $history]);
    }

    public function reportHistory(Request $request)
    {
        $filters = $request->validate([
            'q' => 'nullable|string|max:150',
            'type' => 'nullable|in:student,beneficiary,livelihood,attendance,training',
            'from' => 'nullable|date',
            'to' => 'nullable|date|after_or_equal:from',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);
        $query = AuditLog::query()->with('user:id,name')->latest();
        if (! empty($filters['type'])) $query->where('record_type', $filters['type']);
        if (! empty($filters['from'])) $query->whereDate('created_at', '>=', $filters['from']);
        if (! empty($filters['to'])) $query->whereDate('created_at', '<=', $filters['to']);
        if (! empty($filters['q'])) $query->where(fn (Builder $builder) => $builder->where('action', 'like', '%' . $filters['q'] . '%')->orWhere('reference', 'like', '%' . $filters['q'] . '%'));

        $page = $query->paginate($filters['per_page'] ?? 50);
        return response()->json(['data' => $page->items(), 'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()]]);
    }

    private function applicationPayload(string $type, $record): array
    {
        return [
            'id' => $type . '-' . $record->id,
            'type' => $type,
            'reference' => $record->reference,
            'full_name' => $record->full_name,
            'program' => $record->program,
            'project_name' => $type === 'livelihood' ? $record->project_name : null,
            'status' => $record->status,
            'release_date' => $record->release_date?->format('Y-m-d'),
            'release_amount' => $record->release_amount,
            'data' => $record->data,
            'submitted_at' => $record->submitted_at?->toISOString(),
            'created_at' => $record->created_at?->toISOString(),
            'updated_at' => $record->updated_at?->toISOString(),
        ];
    }

    private function audit(Request $request, string $action, string $type, int $id, string $reference, array $metadata = []): void
    {
        AuditLog::create([
            'user_id' => $request->user()?->id,
            'action' => $action,
            'record_type' => $type,
            'record_id' => (string) $id,
            'reference' => $reference,
            'ip_address' => $request->ip(),
            'metadata' => $metadata ?: null,
        ]);
    }
}
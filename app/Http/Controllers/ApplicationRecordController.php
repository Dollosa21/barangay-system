<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\BeneficiaryApplication;
use App\Models\LivelihoodApplication;
use App\Models\ProgramRecord;
use App\Models\ProgramQualificationRule;
use App\Models\StudentApplication;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ApplicationRecordController extends Controller
{
    private const APPLICATION_MODELS = [
        'student' => StudentApplication::class,
        'beneficiary' => BeneficiaryApplication::class,
        'livelihood' => LivelihoodApplication::class,
    ];

    public function index(Request $request)
    {
        $type = $request->input('type');
        $term = trim((string) $request->input('q', ''));
        $rows = [];

        if ($type && isset(self::APPLICATION_MODELS[$type])) {
            $model = self::APPLICATION_MODELS[$type];
            $query = $model::query();
            if ($request->filled('status')) $query->where('status', $request->input('status'));
            if ($term !== '') $query->where(fn (Builder $builder) => $builder
                ->where('full_name', 'like', "%{$term}%")
                ->orWhere('reference', 'like', "%{$term}%")
                ->orWhere($type === 'livelihood' ? 'project_name' : 'program', 'like', "%{$term}%"));
            $page = $query->orderByDesc('submitted_at')->paginate(min(max((int) $request->input('per_page', 50), 1), 100))->withQueryString();
            $page->getCollection()->transform(fn ($record) => $this->applicationPayload($type, $record));
            return response()->json(['data' => $page->items(), 'links' => ['first' => $page->url(1), 'last' => $page->url($page->lastPage()), 'prev' => $page->previousPageUrl(), 'next' => $page->nextPageUrl()], 'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()]]);
        }

        if (in_array($type, ['attendance', 'training'], true)) {
            $query = ProgramRecord::query()->where('type', $type);
            if ($request->filled('status')) $query->where('status', $request->input('status'));
            if ($request->filled('audience')) $query->where('data->audience', (string) $request->input('audience'));
            if ($term !== '') $query->where(fn (Builder $builder) => $builder
                ->where('full_name', 'like', "%{$term}%")
                ->orWhere('reference', 'like', "%{$term}%")
                ->orWhere('program', 'like', "%{$term}%"));
            $page = $query->orderByDesc('submitted_at')->paginate(min(max((int) $request->input('per_page', 50), 1), 100))->withQueryString();
            return response()->json(['data' => $page->items(), 'links' => ['first' => $page->url(1), 'last' => $page->url($page->lastPage()), 'prev' => $page->previousPageUrl(), 'next' => $page->nextPageUrl()], 'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()]]);
        }

        $applicationTypes = $type ? (isset(self::APPLICATION_MODELS[$type]) ? [$type] : []) : array_keys(self::APPLICATION_MODELS);
        foreach ($applicationTypes as $applicationType) {
            $model = self::APPLICATION_MODELS[$applicationType];
            $query = $model::query();
            if ($request->filled('status')) $query->where('status', $request->input('status'));
            if ($term !== '') $query->where(fn (Builder $builder) => $builder
                ->where('full_name', 'like', "%{$term}%")
                ->orWhere('reference', 'like', "%{$term}%")
                ->orWhere($applicationType === 'livelihood' ? 'project_name' : 'program', 'like', "%{$term}%"));
            foreach ($query->get() as $record) $rows[] = $this->applicationPayload($applicationType, $record);
        }

        if (! $type || in_array($type, ['attendance', 'training'], true)) {
            $query = ProgramRecord::query()->whereIn('type', $type ? [$type] : ['attendance', 'training']);
            if ($request->filled('status')) $query->where('status', $request->input('status'));
            if ($request->filled('audience')) $query->where('data->audience', (string) $request->input('audience'));
            if ($term !== '') $query->where(fn (Builder $builder) => $builder
                ->where('full_name', 'like', "%{$term}%")
                ->orWhere('reference', 'like', "%{$term}%")
                ->orWhere('program', 'like', "%{$term}%"));
            foreach ($query->get() as $record) $rows[] = $record->toArray();
        }

        usort($rows, fn ($a, $b) => strtotime($b['submitted_at'] ?? '') <=> strtotime($a['submitted_at'] ?? ''));
        $perPage = min(max((int) $request->input('per_page', 50), 1), 100);
        $page = max((int) $request->input('page', 1), 1);
        $total = count($rows);
        $lastPage = max((int) ceil($total / $perPage), 1);
        $base = $request->url();
        $queryString = $request->query();
        $link = fn ($pageNumber) => $pageNumber >= 1 && $pageNumber <= $lastPage
            ? $base . '?' . http_build_query(array_merge($queryString, ['page' => $pageNumber]))
            : null;

        return response()->json([
            'data' => array_slice($rows, ($page - 1) * $perPage, $perPage),
            'links' => ['first' => $link(1), 'last' => $link($lastPage), 'prev' => $link($page - 1), 'next' => $link($page + 1)],
            'meta' => ['current_page' => $page, 'from' => $total ? (($page - 1) * $perPage + 1) : null, 'last_page' => $lastPage, 'path' => $base, 'per_page' => $perPage, 'to' => min($page * $perPage, $total) ?: null, 'total' => $total],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'type' => 'required|in:student,beneficiary,livelihood,attendance,training',
            'data' => 'required|array',
        ]);
        $type = $validated['type'];
        $data = $validated['data'];
        $specificRules = match ($type) {
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

        $name = $data['Applicant / owner name'] ?? trim(implode(' ', array_filter([
            $data['First name'] ?? '', $data['Middle name'] ?? '', $data['Last name'] ?? '',
        ])));

        if ($type === 'student' || $type === 'beneficiary') {
            $model = self::APPLICATION_MODELS[$type];
            $duplicate = $model::query()->where('full_name', $name)->whereDate('birth_date', $data['Birth date'])->first();
            if ($duplicate) return response()->json(['message' => 'A matching application already exists (' . $duplicate->reference . ').'], 422);

            $program = $data['Assistance program'] ?? $data['Support requested'] ?? null;
            $prefix = $type === 'student' ? 'EDU' : 'BEN';
            $record = $model::create([
                'user_id' => $request->user()->id,
                'reference' => $prefix . '-' . Str::upper(Str::random(8)),
                'full_name' => $name,
                'birth_date' => $data['Birth date'],
                'program' => $program,
                'status' => 'Pending',
                'data' => $data,
            ]);
            $payload = $this->applicationPayload($type, $record);
            $this->audit($request, 'application.created', $type, $record->id, $record->reference);
            return response()->json($payload, 201);
        }

        if ($type === 'livelihood') {
            $duplicate = LivelihoodApplication::query()->where('full_name', $name)
                ->where('project_name', $data['Business / project name'])->first();
            if ($duplicate) return response()->json(['message' => 'A matching livelihood record already exists (' . $duplicate->reference . ').'], 422);

            $record = LivelihoodApplication::create([
                'user_id' => $request->user()->id,
                'reference' => 'LIV-' . Str::upper(Str::random(8)),
                'full_name' => $name,
                'project_name' => $data['Business / project name'],
                'program' => $data['Support requested'] ?? null,
                'status' => 'Pending',
                'data' => $data,
            ]);
            $payload = $this->applicationPayload($type, $record);
            $this->audit($request, 'application.created', $type, $record->id, $record->reference);
            return response()->json($payload, 201);
        }

        if ($type === 'attendance') {
            $name = trim($data['participantName']);
            $participantType = null;
            $participant = null;
            foreach (self::APPLICATION_MODELS as $candidateType => $model) {
                $participant = $model::query()->where('full_name', $name)->first();
                if ($participant) { $participantType = $candidateType; break; }
            }
            if (! $participant) return response()->json(['message' => 'Choose a registered student, beneficiary, or livelihood participant.'], 422);
            $data['participantReference'] = $participant->reference;
            $data['beneficiaryReference'] = in_array($participantType, ['student', 'beneficiary'], true) ? $participant->reference : null;
            if (($data['participantType'] ?? '') === 'Student' && str_contains(strtolower($data['activity']), 'orientation')) $data['activity'] = 'Orientation';
            if (strtolower($data['activity']) === 'senior citizen briefing') $data['activity'] = 'Community assembly';
            if ($data['status'] === 'Present') $data['status'] = 'Attended';

            $existing = ProgramRecord::query()->where('type', 'attendance')->where('full_name', $name)
                ->where('data->activity', $data['activity'])->where('data->date', $data['date'])->first();
            if ($existing) {
                $oldStatus = $existing->status;
                $data['history'] = $existing->data['history'] ?? [];
                $data['history'][] = ['action' => 'Attendance changed from ' . $oldStatus . ' to ' . $data['status'], 'user_id' => $request->user()->id, 'at' => now()->toIso8601String()];
                $existing->data = $data;
                $existing->status = $data['status'];
                $existing->save();
                $this->audit($request, 'attendance.updated', $type, $existing->id, $existing->reference, ['status' => $data['status']]);
                return response()->json($existing);
            }
        }

        if ($type === 'training') $name = $data['title'] ?? 'Program activity';
        $prefix = $type === 'attendance' ? 'ATT' : 'TRN';
        $record = ProgramRecord::create([
            'user_id' => $request->user()->id,
            'type' => $type,
            'reference' => $prefix . '-' . Str::upper(Str::random(8)),
            'full_name' => $name,
            'program' => $data['Assistance program'] ?? $data['Support requested'] ?? $data['program'] ?? null,
            'status' => $type === 'attendance' ? ($data['status'] ?? 'Attended') : 'Scheduled',
            'data' => $data,
        ]);
        $this->audit($request, $type . '.created', $type, $record->id, $record->reference);
        return response()->json($record, 201);
    }

    public function history(Request $request, string $record)
    {
        $type = null;
        $model = null;
        if (preg_match('/^(student|beneficiary|livelihood)-(\d+)$/', $record, $matches)) {
            $type = $matches[1];
            $applicationModel = self::APPLICATION_MODELS[$type];
            $model = $applicationModel::query()->findOrFail((int) $matches[2]);
        } else {
            $model = ProgramRecord::query()->findOrFail($record);
            $type = $model->type;
        }

        $history = AuditLog::query()->with('user:id,name')->where('reference', $model->reference)->oldest()->get()->map(function (AuditLog $entry): array {
            $metadata = $entry->metadata ?? [];
            $action = match ($entry->action) {
                'application.created' => 'Application submitted',
                'application.status_changed' => 'Application status changed',
                'application.updated' => 'Application details updated',
                'attendance.created' => 'Attendance recorded',
                'attendance.updated' => 'Attendance updated',
                'record.updated' => 'Record updated',
                default => Str::headline(str_replace('.', ' ', $entry->action)),
            };

            return [
                'action' => $action,
                'from' => $metadata['from'] ?? null,
                'to' => $metadata['to'] ?? $metadata['status'] ?? null,
                'user' => $entry->user?->name ?? 'Administrator',
                'at' => $entry->created_at?->toIso8601String(),
            ];
        })->all();

        if (! $history) {
            $legacyHistory = $model->data['history'] ?? [];
            foreach ($legacyHistory as $entry) {
                $history[] = [
                    'action' => $entry['action'] ?? 'Record updated',
                    'from' => null,
                    'to' => $entry['status'] ?? null,
                    'user' => 'Administrator',
                    'at' => $entry['at'] ?? null,
                ];
            }
        }

        if (! $history) {
            $history[] = [
                'action' => $type === 'attendance' ? 'Attendance recorded' : 'Application submitted',
                'from' => null,
                'to' => $model->status,
                'user' => 'Administrator',
                'at' => $model->submitted_at?->toIso8601String(),
            ];
        }

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
        $term = trim($filters['q'] ?? '');
        $query = AuditLog::query()->with('user:id,name')->latest();
        if (! empty($filters['type'])) $query->where('record_type', $filters['type']);
        if (! empty($filters['from'])) $query->whereDate('created_at', '>=', $filters['from']);
        if (! empty($filters['to'])) $query->whereDate('created_at', '<=', $filters['to']);
        if ($term !== '') {
            $references = collect();
            foreach (self::APPLICATION_MODELS as $model) {
                $references = $references->merge($model::query()->where('full_name', 'like', "%{$term}%")->pluck('reference'));
            }
            $references = $references->merge(ProgramRecord::query()->where('full_name', 'like', "%{$term}%")->pluck('reference'));
            $query->where(function (Builder $builder) use ($term, $references) {
                $builder->where('action', 'like', "%{$term}%")
                    ->orWhere('reference', 'like', "%{$term}%")
                    ->orWhere('metadata->program', 'like', "%{$term}%")
                    ->orWhereHas('user', fn (Builder $userQuery) => $userQuery->where('name', 'like', "%{$term}%"));
                if ($references->isNotEmpty()) $builder->orWhereIn('reference', $references->unique()->all());
            });
        }

        $entries = $query->paginate(min((int) ($filters['per_page'] ?? 50), 100));
        $names = [];
        $pageRows = collect($entries->items());
        foreach (self::APPLICATION_MODELS as $type => $model) {
            $refs = $pageRows->where('record_type', $type)->pluck('reference')->filter()->unique();
            if ($refs->isNotEmpty()) $names += $model::query()->whereIn('reference', $refs)->pluck('full_name', 'reference')->all();
        }
        $programRefs = $pageRows->whereIn('record_type', ['attendance', 'training'])->pluck('reference')->filter()->unique();
        if ($programRefs->isNotEmpty()) $names += ProgramRecord::query()->whereIn('reference', $programRefs)->pluck('full_name', 'reference')->all();

        $data = $pageRows->map(function (AuditLog $entry) use ($names): array {
            $metadata = $entry->metadata ?? [];
            $action = match ($entry->action) {
                'application.created' => 'Application submitted',
                'application.status_changed' => 'Application status changed',
                'application.updated' => 'Application details updated',
                'attendance.created' => 'Attendance recorded',
                'attendance.updated' => 'Attendance updated',
                'record.updated' => 'Record updated',
                'training.created' => 'Training scheduled',
                default => Str::headline(str_replace('.', ' ', $entry->action)),
            };
            return [
                'at' => $entry->created_at?->toIso8601String(),
                'type' => $entry->record_type,
                'name' => $names[$entry->reference] ?? $entry->reference ?? 'Unknown record',
                'reference' => $entry->reference,
                'action' => $action,
                'from' => $metadata['from'] ?? null,
                'to' => $metadata['to'] ?? $metadata['status'] ?? null,
                'user' => $entry->user?->name ?? 'Administrator',
            ];
        });

        return response()->json(['data' => $data, 'meta' => ['current_page' => $entries->currentPage(), 'last_page' => $entries->lastPage(), 'per_page' => $entries->perPage(), 'total' => $entries->total()]]);
    }

    public function update(Request $request, string $record)
    {
        $validated = $request->validate([
            'status' => 'sometimes|required|in:Pending,Approved,Rejected,Released',
            'data' => 'sometimes|required|array',
            'data.Review note' => 'sometimes|nullable|string|max:1000',
            'data.verifiedRequirements' => 'sometimes|array',
            'data.verifiedRequirements.*' => 'string|max:150',
            'data.Release amount' => 'sometimes|nullable|numeric|min:0|max:9999999999.99',
        ]);
        $applicationType = null;
        $application = null;
        if (preg_match('/^(student|beneficiary|livelihood)-(\d+)$/', $record, $matches)) {
            $applicationType = $matches[1];
            $model = self::APPLICATION_MODELS[$applicationType];
            $application = $model::query()->findOrFail((int) $matches[2]);
        }

        if ($application) {
            $details = array_merge($application->data ?? [], $validated['data'] ?? []);
            $currentStatus = $application->status;
            $nextStatus = $validated['status'] ?? $currentStatus;
            if ($nextStatus !== $currentStatus && ! in_array($request->user()->role, ['administrator', 'approver'], true)) {
                return response()->json(['message' => 'Only an approver or administrator can change application status.'], 403);
            }
            if ($nextStatus === 'Rejected' && trim((string) ($details['Review note'] ?? '')) === '') {
                return response()->json(['message' => 'Add a review note explaining why the application is rejected.'], 422);
            }
            if ($nextStatus === 'Released') {
                if (! in_array($currentStatus, ['Approved', 'Released'], true)) return response()->json(['message' => 'Approve the application before recording a release.'], 422);
                if (empty($details['Release date'] ?? null)) return response()->json(['message' => 'Enter the release date before marking assistance as released.'], 422);
                if ($currentStatus !== 'Released' && (! isset($details['Release amount']) || $details['Release amount'] === '')) return response()->json(['message' => 'Enter the release amount. Use 0 for in-kind assistance.'], 422);
            }
            if ($nextStatus === 'Approved' && in_array($applicationType, ['student', 'beneficiary'], true)) {
                $program = $details['Assistance program'] ?? '';
                $rule = ProgramQualificationRule::query()->where('program', $program)->first();
                $required = $rule?->required_documents ?? ['Valid barangay ID'];
                $missing = array_diff($required, is_array($details['verifiedRequirements'] ?? null) ? $details['verifiedRequirements'] : []);
                $activity = $rule?->required_activity;
                $attended = ! $activity || ProgramRecord::query()->where('type', 'attendance')->where('data->beneficiaryReference', $application->reference)
                    ->where('data->activity', $activity)->where('status', 'Attended')->exists();
                if ($missing || ! $attended) return response()->json(['message' => 'Approval requires all listed documents and the assigned activity attendance.'], 422);
            }
            if ($nextStatus === 'Approved' && $applicationType === 'livelihood') {
                $required = ['Applicant / owner name', 'Contact number', 'Business type', 'Business / project name', 'Business location', 'Estimated capital', 'Expected workers', 'Support requested', 'Project description'];
                $missing = array_values(array_filter($required, fn (string $field): bool => ! isset($details[$field]) || trim((string) $details[$field]) === ''));
                if ($missing) return response()->json(['message' => 'Complete the livelihood application fields before marking the applicant qualified: ' . implode(', ', $missing) . '.'], 422);
            }

            if ($nextStatus !== $currentStatus) {
                $details['history'] = $details['history'] ?? [];
                $details['history'][] = ['action' => 'Status changed from ' . $currentStatus . ' to ' . $nextStatus, 'user_id' => $request->user()->id, 'at' => now()->toIso8601String()];
            }
            $application->data = $details;
            $application->status = $nextStatus;
            $application->full_name = $details['Applicant / owner name'] ?? trim(implode(' ', array_filter([$details['First name'] ?? '', $details['Middle name'] ?? '', $details['Last name'] ?? '']))) ?: $application->full_name;
            if ($applicationType === 'livelihood') {
                $application->project_name = $details['Business / project name'] ?? $application->project_name;
                $application->program = $details['Support requested'] ?? $application->program;
            }
            else $application->program = $details['Assistance program'] ?? $details['Support requested'] ?? $application->program;
            $application->release_date = $details['Release date'] ?? null;
            $application->release_amount = $details['Release amount'] ?? null;
            $application->save();
            if ($nextStatus !== $currentStatus || isset($validated['data'])) $this->audit($request, $nextStatus !== $currentStatus ? 'application.status_changed' : 'application.updated', $applicationType, $application->id, $application->reference, ['from' => $currentStatus, 'to' => $nextStatus]);
            return response()->json($this->applicationPayload($applicationType, $application));
        }

        $recordModel = ProgramRecord::query()->findOrFail($record);
        $previousStatus = $recordModel->status;
        if (isset($validated['status']) && $validated['status'] !== $previousStatus && ! in_array($request->user()->role, ['administrator', 'approver'], true)) {
            return response()->json(['message' => 'Only an approver or administrator can change record status.'], 403);
        }
        if (isset($validated['status'])) $recordModel->status = $validated['status'];
        if (isset($validated['data'])) $recordModel->data = array_merge($recordModel->data ?? [], $validated['data']);
        if ($previousStatus !== $recordModel->status) {
            $details = $recordModel->data ?? [];
            $details['history'] = $details['history'] ?? [];
            $details['history'][] = ['action' => 'Status changed from ' . $previousStatus . ' to ' . $recordModel->status, 'user_id' => $request->user()->id, 'at' => now()->toIso8601String()];
            $recordModel->data = $details;
        }
        $recordModel->save();
        $this->audit($request, 'record.updated', $recordModel->type, $recordModel->id, $recordModel->reference, ['from' => $previousStatus, 'to' => $recordModel->status]);
        return response()->json($recordModel);
    }

    private function applicationPayload(string $type, $record): array
    {
        return [
            'id' => $type . '-' . $record->id,
            'type' => $type,
            'user_id' => $record->user_id,
            'reference' => $record->reference,
            'full_name' => $record->full_name,
            'program' => $type === 'livelihood' ? ($record->data['Support requested'] ?? null) : $record->program,
            'status' => $record->status,
            'release_date' => $record->release_date?->format('Y-m-d'),
            'release_amount' => $record->release_amount,
            'data' => $record->data,
            'submitted_at' => $record->submitted_at?->toISOString(),
            'created_at' => $record->created_at?->toISOString(),
            'updated_at' => $record->updated_at?->toISOString(),
        ];
    }

    private function audit(Request $request, string $action, ?string $type, $id, ?string $reference, array $metadata = []): void
    {
        AuditLog::create([
            'user_id' => $request->user()?->id,
            'action' => $action,
            'record_type' => $type,
            'record_id' => $id === null ? null : (string) $id,
            'reference' => $reference,
            'ip_address' => $request->ip(),
            'metadata' => $metadata ?: null,
        ]);
    }
}

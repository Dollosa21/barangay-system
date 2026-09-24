<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\BeneficiaryApplication;
use App\Models\LivelihoodApplication;
use App\Models\ProgramRecord;
use App\Models\StudentApplication;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    private const ACTIONS = [
        'application.created',
        'application.status_changed',
        'application.updated',
        'attendance.created',
        'attendance.updated',
        'training.created',
        'record.updated',
    ];

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $base = AuditLog::query()->whereIn('action', self::ACTIONS);
        $unread = (clone $base)->when($user->notifications_read_at, fn ($query) => $query->where('created_at', '>', $user->notifications_read_at));
        $rows = (clone $base)->with('user:id,name')->latest()->limit(30)->get();
        $names = $this->namesFor($rows);
        $readAt = $user->notifications_read_at;

        return response()->json([
            'unread_count' => $unread->count(),
            'notifications' => $rows->map(function (AuditLog $entry) use ($names, $readAt): array {
                $title = match ($entry->action) {
                    'application.created' => 'New application received',
                    'application.status_changed' => 'Application status changed',
                    'application.updated' => 'Application details updated',
                    'attendance.created', 'attendance.updated' => 'Attendance recorded',
                    'training.created' => 'Program activity scheduled',
                    default => 'Program record updated',
                };
                $metadata = $entry->metadata ?? [];
                $detail = match ($entry->action) {
                    'application.status_changed', 'record.updated' => 'Status: ' . ($metadata['to'] ?? $metadata['status'] ?? 'updated'),
                    'attendance.created', 'attendance.updated' => 'Attendance: ' . ($metadata['status'] ?? 'updated'),
                    default => ucfirst($entry->record_type ?? 'system') . ' record',
                };
                $createdAt = $entry->created_at;

                return [
                    'id' => $entry->id,
                    'title' => $title,
                    'name' => $names[$entry->reference] ?? $entry->reference ?? 'Program record',
                    'detail' => $detail,
                    'reference' => $entry->reference,
                    'type' => $entry->record_type,
                    'at' => $createdAt?->toIso8601String(),
                    'unread' => $createdAt && (! $readAt || $createdAt->gt($readAt)),
                ];
            }),
            'checked_at' => now()->toIso8601String(),
        ]);
    }

    public function markRead(Request $request): JsonResponse
    {
        $request->user()->forceFill(['notifications_read_at' => now()])->save();

        return response()->json(['message' => 'Notifications marked as read.']);
    }

    private function namesFor($rows): array
    {
        $names = [];
        foreach ([
            'student' => StudentApplication::class,
            'beneficiary' => BeneficiaryApplication::class,
            'livelihood' => LivelihoodApplication::class,
        ] as $type => $model) {
            $references = $rows->where('record_type', $type)->pluck('reference')->filter()->unique();
            if ($references->isNotEmpty()) $names += $model::query()->whereIn('reference', $references)->pluck('full_name', 'reference')->all();
        }

        $references = $rows->whereIn('record_type', ['attendance', 'training'])->pluck('reference')->filter()->unique();
        if ($references->isNotEmpty()) $names += ProgramRecord::query()->whereIn('reference', $references)->pluck('full_name', 'reference')->all();

        return $names;
    }
}

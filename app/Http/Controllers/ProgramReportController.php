<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProgramReportController extends Controller
{
    public function summary(Request $request)
    {
        $filters = $request->validate([
            'from' => 'nullable|date',
            'to' => 'nullable|date|after_or_equal:from',
        ]);

        $applicationCounts = [];
        $releasedAmount = 0;
        foreach ([
            'student' => 'student_applications',
            'beneficiary' => 'beneficiary_applications',
            'livelihood' => 'livelihood_applications',
        ] as $type => $table) {
            $query = DB::table($table);
            if (! empty($filters['from'])) $query->whereDate('submitted_at', '>=', $filters['from']);
            if (! empty($filters['to'])) $query->whereDate('submitted_at', '<=', $filters['to']);
            $applicationCounts[$type] = [
                'total' => (clone $query)->count(),
                'pending' => (clone $query)->where('status', 'Pending')->count(),
                'approved' => (clone $query)->where('status', 'Approved')->count(),
                'released' => (clone $query)->where('status', 'Released')->count(),
                'rejected' => (clone $query)->where('status', 'Rejected')->count(),
            ];
            $releasedQuery = DB::table($table)->where('status', 'Released');
            if (! empty($filters['from'])) $releasedQuery->whereDate('release_date', '>=', $filters['from']);
            if (! empty($filters['to'])) $releasedQuery->whereDate('release_date', '<=', $filters['to']);
            $releasedAmount += (float) $releasedQuery->sum('release_amount');
        }
        $pendingQuery = function (string $table) use ($filters) {
            $query = DB::table($table)->where('status', 'Pending')->whereDate('submitted_at', '<', now()->subDays(7));
            if (! empty($filters['from'])) $query->whereDate('submitted_at', '>=', $filters['from']);
            if (! empty($filters['to'])) $query->whereDate('submitted_at', '<=', $filters['to']);
            return $query;
        };
        $pendingOverSevenDays = collect(['student_applications', 'beneficiary_applications'])
            ->sum(fn (string $table) => $pendingQuery($table)->count());

        $activityQuery = function (string $type) use ($filters) {
            $query = DB::table('program_records')->where('type', $type);
            if (! empty($filters['from'])) $query->whereDate('data->date', '>=', $filters['from']);
            if (! empty($filters['to'])) $query->whereDate('data->date', '<=', $filters['to']);
            return $query;
        };
        $attendance = $activityQuery('attendance');
        $training = $activityQuery('training');

        return response()->json([
            'filters' => ['from' => $filters['from'] ?? null, 'to' => $filters['to'] ?? null],
            'applications' => $applicationCounts,
            'totals' => [
                'applications' => array_sum(array_column($applicationCounts, 'total')),
                'pending' => array_sum(array_column($applicationCounts, 'pending')),
                'pendingOverSevenDays' => $pendingOverSevenDays,
                'approved' => array_sum(array_column($applicationCounts, 'approved')),
                'released' => array_sum(array_column($applicationCounts, 'released')),
                'releasedAmount' => round($releasedAmount, 2),
                'livelihoodParticipants' => $applicationCounts['livelihood']['total'],
                'attendance' => (clone $attendance)->count(),
                'present' => (clone $attendance)->whereIn('status', ['Attended', 'Present'])->count(),
                'absent' => (clone $attendance)->where('status', 'Absent')->count(),
                'trainings' => (clone $training)->count(),
            ],
            'generated_at' => now()->toIso8601String(),
        ]);
    }
}

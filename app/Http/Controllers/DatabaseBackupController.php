<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\BeneficiaryApplication;
use App\Models\LivelihoodApplication;
use App\Models\ProgramRecord;
use App\Models\ProgramBudget;
use App\Models\ProgramQualificationRule;
use App\Models\StudentApplication;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Crypt;

class DatabaseBackupController extends Controller
{
    public function export()
    {
        $payload = [
            'format' => 'barangay-system-backup-v1',
            'created_at' => now()->toIso8601String(),
            'users' => User::query()->get(['id', 'name', 'email', 'role', 'is_active', 'created_at'])->toArray(),
            'applications' => [
                'student' => StudentApplication::query()->get()->toArray(),
                'beneficiary' => BeneficiaryApplication::query()->get()->toArray(),
                'livelihood' => LivelihoodApplication::query()->get()->toArray(),
            ],
            'program_records' => ProgramRecord::query()->get()->toArray(),
            'qualification_rules' => ProgramQualificationRule::query()->get()->toArray(),
            'program_budgets' => ProgramBudget::query()->get()->toArray(),
            'audit_logs' => AuditLog::query()->get()->toArray(),
        ];
        $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        return response()->json(['format' => 'barangay-system-encrypted-backup-v1', 'encrypted_payload' => Crypt::encryptString($encoded)])
            ->header('Content-Disposition', 'attachment; filename="barangay-backup-' . now()->format('Y-m-d-His') . '.json"');
    }

    public function restore(Request $request)
    {
        $request->validate(['backup' => 'required|file|mimes:json,txt|max:51200']);
        try {
            $document = json_decode(file_get_contents($request->file('backup')->getRealPath()), true, 512, JSON_THROW_ON_ERROR);
            $payload = json_decode(Crypt::decryptString($document['encrypted_payload'] ?? ''), true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            return response()->json(['message' => 'The backup is invalid or cannot be decrypted. Confirm it was created by this installation and that the current APP_KEY is unchanged.'], 422);
        }
        if (! is_array($payload) || ($document['format'] ?? null) !== 'barangay-system-encrypted-backup-v1' || ($payload['format'] ?? null) !== 'barangay-system-backup-v1') {
            return response()->json(['message' => 'This backup format is not supported.'], 422);
        }

        $counts = DB::transaction(function () use ($payload, $request): array {
            $counts = ['applications' => 0, 'program_records' => 0, 'qualification_rules' => 0, 'program_budgets' => 0, 'audit_logs' => 0];
            $userId = $request->user()->id;
            $userMap = [];
            foreach (($payload['users'] ?? []) as $backupUser) {
                if (empty($backupUser['id']) || empty($backupUser['email'])) continue;
                $matchedUser = User::query()->where('email', $backupUser['email'])->value('id');
                if ($matchedUser) $userMap[$backupUser['id']] = $matchedUser;
            }
            foreach ([
                'student' => StudentApplication::class,
                'beneficiary' => BeneficiaryApplication::class,
                'livelihood' => LivelihoodApplication::class,
            ] as $type => $model) {
                foreach (($payload['applications'][$type] ?? []) as $row) {
                    if (empty($row['reference']) || ! is_array($row['data'] ?? null)) continue;
                    $data = $row;
                    unset($data['id']);
                    $data['user_id'] = $userMap[$row['user_id'] ?? 0] ?? $userId;
                    $model::query()->updateOrCreate(['reference' => $row['reference']], $data);
                    $counts['applications']++;
                }
            }
            foreach (($payload['program_records'] ?? []) as $row) {
                if (empty($row['reference']) || ! is_array($row['data'] ?? null)) continue;
                $data = $row;
                unset($data['id']);
                $data['user_id'] = $userMap[$row['user_id'] ?? 0] ?? $userId;
                ProgramRecord::query()->updateOrCreate(['reference' => $row['reference']], $data);
                $counts['program_records']++;
            }
            foreach (($payload['qualification_rules'] ?? []) as $row) {
                if (empty($row['program']) || ! is_array($row['required_documents'] ?? null)) continue;
                ProgramQualificationRule::query()->updateOrCreate(
                    ['program' => $row['program']],
                    ['required_documents' => $row['required_documents'], 'required_activity' => $row['required_activity'] ?? null],
                );
                $counts['qualification_rules']++;
            }
            foreach (($payload['program_budgets'] ?? []) as $row) {
                if (empty($row['program']) || empty($row['fiscal_year']) || ! isset($row['allocated_amount'])) continue;
                ProgramBudget::query()->updateOrCreate(
                    ['program' => $row['program'], 'fiscal_year' => $row['fiscal_year']],
                    ['allocated_amount' => $row['allocated_amount'], 'user_id' => $userMap[$row['user_id'] ?? 0] ?? $userId],
                );
                $counts['program_budgets']++;
            }
            foreach (($payload['audit_logs'] ?? []) as $row) {
                if (empty($row['action']) || empty($row['created_at'])) continue;
                $duplicate = AuditLog::query()->where('reference', $row['reference'] ?? null)->where('action', $row['action'])->where('created_at', $row['created_at'])->exists();
                if ($duplicate) continue;
                AuditLog::create([
                    'user_id' => $userMap[$row['user_id'] ?? 0] ?? $userId,
                    'action' => $row['action'],
                    'record_type' => $row['record_type'] ?? null,
                    'record_id' => $row['record_id'] ?? null,
                    'reference' => $row['reference'] ?? null,
                    'ip_address' => null,
                    'metadata' => $row['metadata'] ?? null,
                    'created_at' => $row['created_at'],
                    'updated_at' => $row['updated_at'] ?? $row['created_at'],
                ]);
                $counts['audit_logs']++;
            }
            AuditLog::create(['user_id' => $userId, 'action' => 'database.restored', 'record_type' => 'system', 'record_id' => null, 'reference' => null, 'ip_address' => $request->ip(), 'metadata' => $counts]);
            return $counts;
        });

        return response()->json(['message' => 'Backup data merged successfully. Matching references were updated; unmatched records were added. Existing records were not deleted.', 'restored' => $counts]);
    }
}

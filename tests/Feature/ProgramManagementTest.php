<?php

namespace Tests\Feature;

use App\Models\ProgramRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProgramManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_schema_contains_only_required_program_tables_and_framework_support(): void
    {
        $this->assertTrue(Schema::hasTable('beneficiary_applications'));
        $this->assertTrue(Schema::hasTable('livelihood_applications'));
        $this->assertTrue(Schema::hasTable('program_records'));
        $this->assertTrue(Schema::hasTable('program_qualification_rules'));
        $this->assertTrue(Schema::hasTable('audit_logs'));
        $this->assertFalse(Schema::hasTable('program_budgets'));
        $this->getJson('/student-appointments')->assertNotFound();
    }

    public function test_first_administrator_can_register_only_once(): void
    {
        $this->postJson('/auth/register', [
            'name' => 'Paglaum Administrator',
            'email' => 'admin@example.test',
            'password' => 'PaglaumSecurePass123!',
            'password_confirmation' => 'PaglaumSecurePass123!',
        ])->assertCreated();

        $this->getJson('/auth/session')->assertOk()->assertJsonPath('authenticated', true)->assertJsonPath('role', 'administrator');
        $this->getJson('/auth/setup')->assertOk()->assertJsonPath('canRegister', false);
        $this->postJson('/auth/register', [
            'name' => 'Second Administrator',
            'email' => 'second@example.test',
            'password' => 'PaglaumSecurePass123!',
            'password_confirmation' => 'PaglaumSecurePass123!',
        ])->assertForbidden();
    }

    public function test_beneficiary_approval_requires_documents_and_assigned_activity_then_tracks_release(): void
    {
        $administrator = User::factory()->create(['role' => 'administrator', 'is_active' => true]);
        $this->actingAs($administrator);

        $application = $this->postJson('/records', [
            'type' => 'beneficiary',
            'data' => [
                'First name' => 'Mila',
                'Last name' => 'Santos',
                'Birth date' => '1990-06-12',
                'Contact number' => '09171234567',
                'Complete address' => 'Barangay Paglaum, Binalbagan',
                'Assistance program' => 'Food assistance',
                'Requested assistance' => 'Food package',
            ],
        ])->assertCreated()->assertJsonPath('status', 'Pending')->json();

        $recordId = $application['id'];
        $this->patchJson('/records/' . $recordId, ['status' => 'Approved'])
            ->assertUnprocessable()
            ->assertJsonPath('qualification.eligible', false);

        ProgramRecord::create([
            'user_id' => $administrator->id,
            'type' => 'attendance',
            'reference' => 'ATT-TEST0001',
            'full_name' => 'Mila Santos',
            'program' => 'Food assistance',
            'status' => 'Present',
            'data' => [
                'participantReference' => $application['reference'],
                'beneficiaryReference' => $application['reference'],
                'participantName' => 'Mila Santos',
                'activity' => 'Community assembly',
                'date' => now()->toDateString(),
                'status' => 'Present',
            ],
        ]);

        $this->patchJson('/records/' . $recordId, [
            'status' => 'Approved',
            'data' => ['verifiedRequirements' => ['Valid barangay ID', 'Proof of residency']],
        ])->assertOk()->assertJsonPath('status', 'Approved');

        $this->patchJson('/records/' . $recordId, [
            'status' => 'Released',
            'data' => ['Release date' => '2026-10-01', 'Release amount' => 0],
        ])->assertOk()->assertJsonPath('status', 'Released')->assertJsonPath('release_date', '2026-10-01');

        $this->getJson('/records/' . $recordId . '/history')->assertOk()->assertJsonCount(3, 'history');
        $this->getJson('/records?type=beneficiary&q=Mila')->assertOk()->assertJsonPath('meta.total', 1);
    }

    public function test_student_assistance_uses_the_same_qualification_release_and_history_flow(): void
    {
        $administrator = User::factory()->create(['role' => 'administrator', 'is_active' => true]);
        $this->actingAs($administrator);

        $application = $this->postJson('/records', [
            'type' => 'student',
            'data' => [
                'First name' => 'Lia',
                'Last name' => 'Reyes',
                'Birth date' => '2007-04-18',
                'Contact number' => '09171112222',
                'Complete address' => 'Barangay Paglaum, Binalbagan',
                'School name' => 'Binalbagan National High School',
                'Grade / year level' => 'Grade 11',
                'Assistance program' => 'Educational assistance',
                'Requested assistance' => 'School supplies',
            ],
        ])->assertCreated()->assertJsonPath('type', 'student')->json();

        $this->patchJson('/records/' . $application['id'], ['status' => 'Approved'])
            ->assertUnprocessable()
            ->assertJsonPath('qualification.eligible', false);

        ProgramRecord::create([
            'user_id' => $administrator->id,
            'type' => 'attendance',
            'reference' => 'ATT-STU0001',
            'full_name' => 'Lia Reyes',
            'program' => 'Educational assistance',
            'status' => 'Present',
            'data' => [
                'participantReference' => $application['reference'],
                'beneficiaryReference' => $application['reference'],
                'participantName' => 'Lia Reyes',
                'activity' => 'Orientation',
                'date' => now()->toDateString(),
                'status' => 'Present',
            ],
        ]);

        $this->patchJson('/records/' . $application['id'], [
            'status' => 'Approved',
            'data' => ['verifiedRequirements' => ['Valid barangay ID', 'School enrollment document']],
        ])->assertOk()->assertJsonPath('status', 'Approved');

        $this->patchJson('/records/' . $application['id'], [
            'status' => 'Released',
            'data' => ['Release date' => '2026-10-01', 'Release amount' => 0],
        ])->assertOk()->assertJsonPath('status', 'Released');

        $this->getJson('/records?type=student&q=Lia')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/reports/summary')->assertOk()->assertJsonPath('applications.student.total', 1);
    }

    public function test_livelihood_participants_trainings_attendance_search_and_reports_use_the_database(): void
    {
        $administrator = User::factory()->create(['role' => 'administrator', 'is_active' => true]);
        $this->actingAs($administrator);

        $participant = $this->postJson('/records', [
            'type' => 'livelihood',
            'data' => [
                'Applicant / owner name' => 'Rosa Dela Cruz',
                'Contact number' => '09179876543',
                'Business type' => 'Food processing',
                'Business / project name' => 'Paglaum Native Sweets',
                'Business location' => 'Barangay Paglaum',
                'Estimated capital' => 15000,
                'Expected workers' => 2,
                'Support requested' => 'Equipment and training',
                'Project description' => 'Small native candy livelihood project.',
            ],
        ])->assertCreated()->assertJsonPath('status', 'Pending')->json();

        $training = $this->postJson('/records', [
            'type' => 'training',
            'data' => [
                'title' => 'Food Safety Workshop',
                'program' => 'Livelihood skills',
                'date' => now()->addDay()->toDateString(),
                'time' => '09:00',
                'capacity' => 24,
                'location' => 'Paglaum Barangay Hall',
            ],
        ])->assertCreated()->assertJsonPath('status', 'Scheduled')->json();

        $this->postJson('/records', [
            'type' => 'attendance',
            'data' => [
                'participantReference' => $participant['reference'],
                'activity' => 'Food Safety Workshop',
                'trainingReference' => $training['reference'],
                'date' => now()->addDay()->toDateString(),
                'status' => 'Present',
            ],
        ])->assertCreated()->assertJsonPath('data.participantName', 'Rosa Dela Cruz');

        $this->getJson('/records?type=livelihood&q=Paglaum%20Native')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/records?type=training&q=Food%20Safety')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/records?type=attendance&q=Rosa')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/reports/summary')->assertOk()->assertJsonPath('applications.livelihood.total', 1)->assertJsonPath('totals.trainings', 1)->assertJsonPath('totals.attendance', 1);
    }
}
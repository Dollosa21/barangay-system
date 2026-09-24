<?php
use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Http\Controllers\ApplicationRecordController;
use App\Http\Controllers\ProgramReportController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\DatabaseBackupController;
use App\Http\Controllers\ProgramQualificationRuleController;

Route::get('/', function () {
    return response()->file(public_path('login.html'));
});

Route::get('/admin', function () {
    return response()->file(public_path('login.html'));
});

Route::get('/auth/session', fn (Request $request) => response()->json([
    'authenticated' => $request->user() !== null,
    'name' => $request->user()?->name,
    'email' => $request->user()?->email,
    'role' => $request->user()?->role,
    'active' => $request->user()?->is_active,
]));
Route::get('/auth/token', fn () => response()->json(['token' => csrf_token()]));
Route::get('/auth/setup', fn () => response()->json(['canRegister' => ! User::query()->exists()]));

Route::post('/auth/login', function (Request $request) {
    $credentials = $request->validate(['email' => 'required|email', 'password' => 'required|string']);
    $credentials['email'] = mb_strtolower(trim($credentials['email']));
    if (! Auth::attempt($credentials, $request->boolean('remember'))) {
        return response()->json(['message' => 'Email or password is incorrect.'], 422);
    }
    if (! $request->user()->is_active) {
        Auth::logout();
        return response()->json(['message' => 'Email or password is incorrect.'], 422);
    }
    $request->session()->regenerate();
    return response()->json(['authenticated' => true]);
})->middleware('throttle:5,1');

Route::post('/auth/register', function (Request $request) {
    if (User::query()->exists()) {
        return response()->json(['message' => 'Account registration is closed. Ask the system administrator to create an account.'], 403);
    }
    $validated = $request->validate([
        'name' => 'required|string|max:120',
        'email' => 'required|email|max:255|unique:users,email',
        'password' => 'required|string|min:12|confirmed',
    ]);
    $user = User::create([
        'name' => $validated['name'],
        'email' => mb_strtolower(trim($validated['email'])),
        'password' => Hash::make($validated['password']),
        'role' => 'administrator',
        'is_active' => true,
    ]);
    Auth::login($user);
    $request->session()->regenerate();
    return response()->json(['authenticated' => true], 201);
});

Route::middleware(['auth', 'active'])->group(function () {
    Route::post('/auth/logout', function (Request $request) {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return response()->json(['authenticated' => false]);
    });
    Route::post('/auth/password', function (Request $request) {
        $validated = $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:12|confirmed',
        ]);
        if (! Hash::check($validated['current_password'], $request->user()->password)) {
            return response()->json(['message' => 'Current password is incorrect.'], 422);
        }
        $request->user()->update(['password' => Hash::make($validated['password'])]);
        return response()->json(['message' => 'Password updated.']);
    });
    Route::patch('/auth/profile', function (Request $request) {
        $validated = $request->validate([
            'name' => 'required|string|max:120',
            'email' => 'required|email|max:255|unique:users,email,' . $request->user()->id,
        ]);
        $request->user()->update($validated);
        return response()->json(['name' => $request->user()->name, 'email' => $request->user()->email]);
    });
    Route::get('/reports/history', [ApplicationRecordController::class, 'reportHistory']);
    Route::get('/reports/summary', [ProgramReportController::class, 'summary']);
    Route::get('/records', [ApplicationRecordController::class, 'index']);
    Route::post('/records', [ApplicationRecordController::class, 'store'])->middleware('role:administrator');
    Route::get('/records/{record}/history', [ApplicationRecordController::class, 'history']);
    Route::patch('/records/{record}', [ApplicationRecordController::class, 'update'])->middleware('role:administrator');
    Route::middleware('role:administrator')->group(function (): void {
        Route::get('/qualification-rules', [ProgramQualificationRuleController::class, 'index']);
        Route::put('/qualification-rules/{program}', [ProgramQualificationRuleController::class, 'update']);
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::post('/notifications/read', [NotificationController::class, 'markRead']);
        Route::get('/admin/backup', [DatabaseBackupController::class, 'export']);
        Route::post('/admin/restore', [DatabaseBackupController::class, 'restore']);
    });
});

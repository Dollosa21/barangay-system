@php
    $appBase = rtrim(request()->getBaseUrl(), '/');
    if (str_ends_with($appBase, '/index.php')) $appBase = substr($appBase, 0, -10);
@endphp
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="app-base" content="{{ $appBase }}">
    <title>Paglaum Programs | Binalbagan</title>
    <link rel="stylesheet" href="{{ $appBase }}/programs.css?v=2">
    <script src="{{ $appBase }}/programs.js?v=4" defer></script>
</head>
<body style="--auth-image: url('{{ $appBase }}/Picture/bg.png')">
    <div class="toast" id="toast" role="status" aria-live="polite"></div>

    <main class="auth-screen" id="authScreen" hidden>
        <div class="auth-panel">
            <a class="auth-brand" href="/" aria-label="Paglaum programs home">
                <img src="{{ $appBase }}/Picture/binalbagan logo.jpg" alt="Binalbagan municipal seal">
                <span><strong>BARANGAY PAGLAUM</strong><small>Binalbagan, Negros Occidental</small></span>
                <img src="{{ $appBase }}/Picture/paglaum.jpg" alt="Barangay Paglaum seal">
            </a>
            <div class="auth-copy"><p class="eyebrow">Barangay services</p><h1>Beneficiary &amp;<br>Livelihood Programs</h1><p>Paglaum program records and assistance management.</p></div>
            <form id="loginForm" class="auth-form" hidden>
                <h2>Sign in</h2>
                <label>Email address<input name="email" type="email" autocomplete="username" required></label>
                <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
                <button class="button button-primary" type="submit">Sign in</button>
            </form>
            <form id="setupForm" class="auth-form" hidden>
                <h2>Create administrator</h2>
                <label>Full name<input name="name" autocomplete="name" required maxlength="120"></label>
                <label>Email address<input name="email" type="email" autocomplete="email" required></label>
                <label>Password<input name="password" type="password" autocomplete="new-password" required minlength="12"></label>
                <label>Confirm password<input name="password_confirmation" type="password" autocomplete="new-password" required minlength="12"></label>
                <button class="button button-primary" type="submit">Create administrator</button>
            </form>
            <p class="form-message" id="authMessage" role="alert"></p>
            <footer>Municipality of Binalbagan <span>·</span> Negros Occidental</footer>
        </div>
    </main>

    <div class="app-shell" id="appShell" hidden>
        <aside class="sidebar" id="sidebar">
            <a class="brand" href="#overview" data-page="overview">
                <img src="{{ $appBase }}/Picture/paglaum.jpg" alt="Barangay Paglaum seal">
                <span><strong>PAGLAUM</strong><small>Program Management</small></span>
            </a>
            <nav class="side-nav" aria-label="Main navigation">
                <p class="nav-label">Workspace</p>
                <button class="nav-link is-active" data-page="overview"><span class="nav-icon">01</span>Overview</button>
                <p class="nav-label">Beneficiary assistance</p>
                <button class="nav-link" data-page="students"><span class="nav-icon">02</span>Student assistance</button>
                <button class="nav-link" data-page="beneficiaries"><span class="nav-icon">03</span>Beneficiaries</button>
                <button class="nav-link" data-page="requirements"><span class="nav-icon">04</span>Qualification rules</button>
                <button class="nav-link" data-page="attendance"><span class="nav-icon">05</span>Attendance records</button>
                <p class="nav-label">Livelihood programs</p>
                <button class="nav-link" data-page="livelihood"><span class="nav-icon">06</span>Participants</button>
                <button class="nav-link" data-page="training"><span class="nav-icon">07</span>Training schedule</button>
                <p class="nav-label">Monitoring</p>
                <button class="nav-link" data-page="reports"><span class="nav-icon">08</span>Basic reports</button>
            </nav>
            <div class="sidebar-foot"><span class="online-mark"></span><span>Connected to program database</span></div>
        </aside>

        <div class="main-column">
            <header class="topbar">
                <button class="icon-button menu-button" id="menuButton" type="button" aria-label="Toggle navigation">☰</button>
                <div><span class="topbar-kicker">BARANGAY PAGLAUM</span><h1 id="pageTitle">Overview</h1></div>
                <div class="user-menu"><span class="user-name" id="userName">Administrator</span><button class="button button-quiet" id="logoutButton" type="button">Sign out</button></div>
            </header>

            <main class="content-area">
                <section class="page-view" data-view="overview">
                    <div class="page-intro"><div><p class="eyebrow">Program office</p><h2>Assistance &amp; livelihood</h2><p>Applications, qualification, participation and release records.</p></div><span class="date-chip" id="todayLabel"></span></div>
                    <div class="metric-grid">
                        <button class="metric metric-green" data-page="students"><span>Student assistance</span><strong data-metric="students">0</strong><small>Educational applications</small></button>
                        <button class="metric metric-coral" data-page="beneficiaries"><span>Beneficiary applications</span><strong data-metric="beneficiaries">0</strong><small>All assistance programs</small></button>
                        <button class="metric metric-blue" data-page="livelihood"><span>Livelihood participants</span><strong data-metric="livelihood">0</strong><small>Registered participants</small></button>
                        <button class="metric metric-amber" data-page="training"><span>Training &amp; activities</span><strong data-metric="trainings">0</strong><small>Scheduled programs</small></button>
                    </div>
                    <div class="overview-grid">
                        <section class="panel">
                            <div class="panel-heading"><div><p class="eyebrow">Needs attention</p><h3>Pending applications</h3></div><button class="text-button" data-page="beneficiaries">View all</button></div>
                            <div class="table-wrap"><table><thead><tr><th>Applicant</th><th>Program</th><th>Submitted</th><th>Status</th></tr></thead><tbody id="pendingRows"></tbody></table></div>
                        </section>
                        <section class="panel overview-report">
                            <div class="panel-heading"><div><p class="eyebrow">Current totals</p><h3>Program activity</h3></div><button class="text-button" data-page="reports">Open reports</button></div>
                            <div class="report-stat"><span>Assistance released</span><strong data-metric="released">0</strong></div>
                            <div class="report-stat"><span>Recorded attendance</span><strong data-metric="attendance">0</strong></div>
                            <div class="report-stat"><span>Present</span><strong data-metric="present">0</strong></div>
                            <div class="report-stat"><span>Pending over 7 days</span><strong data-metric="overdue">0</strong></div>
                        </section>
                    </div>
                </section>

                <section class="page-view" data-view="students" hidden>
                    <div class="page-intro"><div><p class="eyebrow">Student assistance</p><h2>Educational applications</h2><p>Register student applicants, verify requirements and record assistance releases.</p></div><button class="button button-primary" data-scroll="studentForm">+ Register student</button></div>
                    <section class="panel form-panel">
                        <div class="panel-heading"><div><p class="eyebrow">New record</p><h3>Student assistance registration</h3></div></div>
                        <form id="studentForm" class="form-grid">
                            <label>First name<input name="First name" required maxlength="100"></label>
                            <label>Middle name<input name="Middle name" maxlength="100"></label>
                            <label>Last name<input name="Last name" required maxlength="100"></label>
                            <label>Birth date<input name="Birth date" type="date" required></label>
                            <label>Contact number<input name="Contact number" type="tel" required maxlength="30"></label>
                            <label class="span-2">Complete address<input name="Complete address" required maxlength="255"></label>
                            <label>School name<input name="School name" required maxlength="180"></label>
                            <label>Grade / year level<input name="Grade / year level" required maxlength="80" placeholder="e.g. Grade 11 or 2nd year"></label>
                            <label>Assistance program<select name="Assistance program" id="studentProgram" required><option value="">Select program</option></select></label>
                            <label>Requested assistance<input name="Requested assistance" required maxlength="180" placeholder="e.g. school supplies"></label>
                            <div class="form-actions span-2"><p class="inline-message" data-form-message></p><button class="button button-primary" type="submit">Save application</button></div>
                        </form>
                    </section>
                    <section class="panel">
                        <div class="panel-heading list-heading"><div><p class="eyebrow">Database records</p><h3>Student applications</h3></div><div class="filters"><input id="studentSearch" type="search" placeholder="Search name, school, reference" aria-label="Search student applications"><select id="studentStatus"><option value="">All statuses</option><option>Pending</option><option>Approved</option><option>Rejected</option><option>Released</option></select></div></div>
                        <div class="table-wrap"><table><thead><tr><th>Student</th><th>School / program</th><th>Qualification</th><th>Release</th><th>Status</th><th></th></tr></thead><tbody id="studentRows"></tbody></table></div>
                    </section>
                </section>

                <section class="page-view" data-view="beneficiaries" hidden>
                    <div class="page-intro"><div><p class="eyebrow">Beneficiary list</p><h2>Assistance applications</h2><p>Register applicants, verify requirements and record assistance releases.</p></div><button class="button button-primary" data-scroll="beneficiaryForm">+ Register beneficiary</button></div>
                    <section class="panel form-panel">
                        <div class="panel-heading"><div><p class="eyebrow">New record</p><h3>Beneficiary registration &amp; assistance application</h3></div></div>
                        <form id="beneficiaryForm" class="form-grid">
                            <label>First name<input name="First name" required maxlength="100"></label>
                            <label>Middle name<input name="Middle name" maxlength="100"></label>
                            <label>Last name<input name="Last name" required maxlength="100"></label>
                            <label>Birth date<input name="Birth date" type="date" required></label>
                            <label>Contact number<input name="Contact number" type="tel" required maxlength="30"></label>
                            <label class="span-2">Complete address<input name="Complete address" required maxlength="255"></label>
                            <label>Assistance program<select name="Assistance program" id="beneficiaryProgram" required><option value="">Select program</option></select></label>
                            <label>Requested assistance<input name="Requested assistance" required maxlength="180" placeholder="e.g. food package"></label>
                            <div class="form-actions span-2"><p class="inline-message" data-form-message></p><button class="button button-primary" type="submit">Save application</button></div>
                        </form>
                    </section>
                    <section class="panel">
                        <div class="panel-heading list-heading"><div><p class="eyebrow">Database records</p><h3>Beneficiary applications</h3></div><div class="filters"><input id="beneficiarySearch" type="search" placeholder="Search name, reference, program" aria-label="Search beneficiaries"><select id="beneficiaryStatus"><option value="">All statuses</option><option>Pending</option><option>Approved</option><option>Rejected</option><option>Released</option></select></div></div>
                        <div class="table-wrap"><table><thead><tr><th>Applicant</th><th>Assistance program</th><th>Qualification</th><th>Release</th><th>Status</th><th></th></tr></thead><tbody id="beneficiaryRows"></tbody></table></div>
                    </section>
                </section>

                <section class="page-view" data-view="requirements" hidden>
                    <div class="page-intro"><div><p class="eyebrow">Assistance requirements</p><h2>Qualification rules</h2><p>Each program needs verified documents and, when applicable, an attended activity before approval.</p></div></div>
                    <div class="rule-list" id="ruleList"></div>
                </section>

                <section class="page-view" data-view="attendance" hidden>
                    <div class="page-intro"><div><p class="eyebrow">Program participation</p><h2>Attendance records</h2><p>Record attendance for registered beneficiaries and livelihood participants.</p></div></div>
                    <section class="panel form-panel">
                        <div class="panel-heading"><div><p class="eyebrow">New record</p><h3>Record program or activity attendance</h3></div></div>
                        <form id="attendanceForm" class="form-grid">
                            <label class="span-2">Registered participant<select name="participantReference" id="attendanceParticipant" required><option value="">Select participant</option></select></label>
                            <label>Program activity<input name="activity" id="attendanceActivity" list="activitySuggestions" required maxlength="150"><datalist id="activitySuggestions"></datalist></label>
                            <label>Scheduled training (optional)<select name="trainingReference" id="attendanceTraining"><option value="">Not linked to a training schedule</option></select></label>
                            <label>Date<input name="date" type="date" required></label>
                            <label>Attendance status<select name="status" required><option>Present</option><option>Absent</option><option>Late</option></select></label>
                            <div class="form-actions span-2"><p class="inline-message" data-form-message></p><button class="button button-primary" type="submit">Save attendance</button></div>
                        </form>
                    </section>
                    <section class="panel"><div class="panel-heading list-heading"><div><p class="eyebrow">Participation history</p><h3>Attendance history</h3></div><input id="attendanceSearch" type="search" placeholder="Search participant or activity" aria-label="Search attendance"></div>
                        <div class="table-wrap"><table><thead><tr><th>Participant</th><th>Program / activity</th><th>Date</th><th>Status</th><th>Reference</th></tr></thead><tbody id="attendanceRows"></tbody></table></div>
                    </section>
                </section>

                <section class="page-view" data-view="livelihood" hidden>
                    <div class="page-intro"><div><p class="eyebrow">Livelihood program list</p><h2>Participant registration</h2><p>Track project support, participant status and program participation history.</p></div></div>
                    <section class="panel form-panel">
                        <div class="panel-heading"><div><p class="eyebrow">New participant</p><h3>Register livelihood participant</h3></div></div>
                        <form id="livelihoodForm" class="form-grid">
                            <label>Applicant / owner name<input name="Applicant / owner name" required maxlength="150"></label>
                            <label>Contact number<input name="Contact number" type="tel" required maxlength="30"></label>
                            <label>Business type<input name="Business type" required maxlength="100"></label>
                            <label>Business / project name<input name="Business / project name" required maxlength="150"></label>
                            <label class="span-2">Business location<input name="Business location" required maxlength="255"></label>
                            <label>Estimated capital<input name="Estimated capital" type="number" min="0" step="0.01" required></label>
                            <label>Expected workers<input name="Expected workers" type="number" min="0" step="1" required></label>
                            <label>Support requested<input name="Support requested" required maxlength="180"></label>
                            <label class="span-2">Project description<textarea name="Project description" rows="3" required maxlength="2000"></textarea></label>
                            <div class="form-actions span-2"><p class="inline-message" data-form-message></p><button class="button button-primary" type="submit">Save participant</button></div>
                        </form>
                    </section>
                    <section class="panel"><div class="panel-heading list-heading"><div><p class="eyebrow">Participant records</p><h3>Livelihood participants</h3></div><input id="livelihoodSearch" type="search" placeholder="Search person, project, reference" aria-label="Search livelihood participants"></div>
                        <div class="table-wrap"><table><thead><tr><th>Participant</th><th>Project</th><th>Support</th><th>Participation</th><th>Release</th><th>Status</th><th></th></tr></thead><tbody id="livelihoodRows"></tbody></table></div>
                    </section>
                </section>

                <section class="page-view" data-view="training" hidden>
                    <div class="page-intro"><div><p class="eyebrow">Livelihood program list</p><h2>Training schedule</h2><p>Schedule activities and connect attendance records to each training.</p></div></div>
                    <section class="panel form-panel">
                        <div class="panel-heading"><div><p class="eyebrow">New schedule</p><h3>Schedule training or program activity</h3></div></div>
                        <form id="trainingForm" class="form-grid">
                            <label>Training title<input name="title" required maxlength="150"></label>
                            <label>Program<input name="program" required maxlength="150" value="Livelihood program"></label>
                            <label>Date<input name="date" type="date" required></label>
                            <label>Time<input name="time" type="time"></label>
                            <label>Participant capacity<input name="capacity" type="number" min="1" max="500" value="30"></label>
                            <label>Location<input name="location" required maxlength="180" value="Barangay Hall"></label>
                            <div class="form-actions span-2"><p class="inline-message" data-form-message></p><button class="button button-primary" type="submit">Save schedule</button></div>
                        </form>
                    </section>
                    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">Training records</p><h3>Upcoming and completed activities</h3></div></div>
                        <div class="table-wrap"><table><thead><tr><th>Training</th><th>Program</th><th>Date &amp; time</th><th>Location</th><th>Capacity</th><th>Status</th></tr></thead><tbody id="trainingRows"></tbody></table></div>
                    </section>
                </section>

                <section class="page-view" data-view="reports" hidden>
                    <div class="page-intro"><div><p class="eyebrow">Basic reports</p><h2>Program reports</h2><p>Live counts from beneficiary, livelihood, training and attendance records.</p></div></div>
                    <section class="panel report-filters"><label>From<input id="reportFrom" type="date"></label><label>To<input id="reportTo" type="date"></label><button class="button button-primary" id="refreshReport" type="button">Run report</button><button class="button button-outline" id="printReport" type="button">Print</button></section>
                    <div class="report-grid" id="reportCards"></div>
                    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">By assistance program</p><h3>Application status</h3></div></div><div class="table-wrap"><table><thead><tr><th>Program</th><th>Applications</th><th>Pending</th><th>Approved</th><th>Released</th><th>Rejected</th></tr></thead><tbody id="reportBreakdown"></tbody></table></div></section>
                </section>
            </main>
            <footer class="app-footer">Barangay Paglaum <span>·</span> Municipality of Binalbagan <span>·</span> Negros Occidental</footer>
        </div>
    </div>

    <dialog class="record-dialog" id="reviewDialog"><form id="reviewForm"><div class="dialog-heading"><div><p class="eyebrow">Application review</p><h2 id="reviewTitle">Review record</h2><p id="reviewReference" class="reference-text"></p></div><button class="icon-button" type="button" data-close-dialog aria-label="Close">×</button></div><div id="reviewDetails" class="review-details"></div><div id="verificationFields" class="verification-fields"></div><label>Review note<textarea id="reviewNote" rows="2" maxlength="1000" placeholder="Required when rejecting"></textarea></label><div class="form-grid review-release"><label>Release amount<input id="releaseAmount" type="number" min="0" step="0.01" placeholder="0 for in-kind assistance"></label><label>Release date<input id="releaseDate" type="date"></label></div><label>Status<select id="reviewStatus"><option>Pending</option><option>Approved</option><option>Rejected</option><option>Released</option></select></label><p class="inline-message" id="reviewMessage"></p><div class="form-actions"><button class="button button-outline" type="button" data-close-dialog>Cancel</button><button class="button button-primary" type="submit">Save review</button></div></form></dialog>
    <dialog class="history-dialog" id="historyDialog"><div class="dialog-heading"><div><p class="eyebrow">Record history</p><h2 id="historyTitle">History</h2></div><button class="icon-button" type="button" data-close-dialog aria-label="Close">×</button></div><ol id="historyList" class="history-list"></ol></dialog>
</body>
</html>
(() => {
    const appBase = document.querySelector('meta[name="app-base"]')?.content.replace(/\/$/, '') || '';
    let csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
    const state = { user: null, rules: [], students: [], beneficiaries: [], livelihoods: [], attendance: [], trainings: [], review: null };
    const viewTitles = { overview: 'Overview', students: 'Student assistance', beneficiaries: 'Beneficiaries', requirements: 'Qualification rules', attendance: 'Attendance records', livelihood: 'Livelihood participants', training: 'Training schedule', reports: 'Basic reports' };
    let toastTimer;

    const api = async (path, options = {}) => {
        const headers = { Accept: 'application/json', 'X-CSRF-TOKEN': csrfToken, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers };
        const response = await fetch(`${appBase}/${path.replace(/^\//, '')}`, { credentials: 'same-origin', ...options, headers });
        const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.message || `Request failed (${response.status}).`);
        return payload;
    };
    const refreshCsrfToken = async () => {
        const result = await api('auth/token');
        csrfToken = result.token;
        document.querySelector('meta[name="csrf-token"]').content = result.token;
    };
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    const appData = (record) => record?.data || {};
    const formatDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
    const formatDateTime = (value) => value ? new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
    const statusClass = (value) => `status-${String(value || '').toLowerCase().replace(/[^a-z]+/g, '-')}`;
    const statusPill = (value) => `<span class="status-pill ${statusClass(value)}">${escapeHtml(value || 'Pending')}</span>`;
    const rowsOrEmpty = (rows, columns, message) => rows || `<tr><td class="empty-cell" colspan="${columns}">${escapeHtml(message)}</td></tr>`;
    const showToast = (message, isError = false) => {
        const toast = document.querySelector('#toast');
        toast.textContent = message;
        toast.classList.toggle('is-error', isError);
        toast.classList.add('is-visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
    };
    const setFormMessage = (form, message, isError = false) => {
        const target = form.querySelector('[data-form-message]');
        if (!target) return;
        target.textContent = message;
        target.classList.toggle('is-error', isError);
    };
    const formData = (form) => Object.fromEntries(new FormData(form).entries());
    const submitJson = (type, data) => api('records', { method: 'POST', body: JSON.stringify({ type, data }) });
    const statusValue = (status) => status === 'Attended' ? 'Present' : status;

    const showAuth = (canRegister) => {
        document.querySelector('#authScreen').hidden = false;
        document.querySelector('#appShell').hidden = true;
        document.querySelector('#loginForm').hidden = canRegister;
        document.querySelector('#setupForm').hidden = !canRegister;
        document.querySelector('#authMessage').textContent = '';
    };
    const showApp = (session) => {
        state.user = session;
        document.querySelector('#authScreen').hidden = true;
        document.querySelector('#appShell').hidden = false;
        document.querySelector('#userName').textContent = session.name || session.email || 'Administrator';
        document.querySelector('#todayLabel').textContent = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
        loadWorkspace();
    };

    const loadRows = async (type) => {
        const result = await api(`records?type=${type}&per_page=100`);
        return result.data || [];
    };
    const loadWorkspace = async () => {
        try {
            const [students, beneficiaries, livelihoods, attendance, trainings, rules] = await Promise.all([
                loadRows('student'), loadRows('beneficiary'), loadRows('livelihood'), loadRows('attendance'), loadRows('training'), api('qualification-rules'),
            ]);
            state.students = students;
            state.beneficiaries = beneficiaries;
            state.livelihoods = livelihoods;
            state.attendance = attendance;
            state.trainings = trainings;
            state.rules = rules.data || [];
            renderAll();
            populatePrograms();
            populateParticipants();
            renderRules();
            loadReport();
        } catch (error) {
            showToast(error.message, true);
        }
    };

    const qualificationFor = (record) => {
        const data = appData(record);
        const rule = state.rules.find((item) => item.program === (data['Assistance program'] || record.program));
        if (!rule) return { rule: null, missing: [], attended: false, eligible: false };
        const missing = (rule.required_documents || []).filter((document) => !(data.verifiedRequirements || []).includes(document));
        const attended = !rule.required_activity || state.attendance.some((entry) => {
            const attendance = appData(entry);
            return attendance.beneficiaryReference === record.reference
                && attendance.activity === rule.required_activity
                && ['Present', 'Attended'].includes(statusValue(entry.status));
        });
        return { rule, missing, attended, eligible: missing.length === 0 && attended };
    };

    const renderAll = () => {
        renderBeneficiaries();
        renderStudents();
        renderLivelihoods();
        renderAttendance();
        renderTrainings();
        renderOverview();
    };
    const renderOverview = () => {
        const pending = state.beneficiaries.filter((record) => record.status === 'Pending');
        const metrics = {
            students: state.students.length,
            beneficiaries: state.beneficiaries.length,
            pending: pending.length,
            livelihood: state.livelihoods.length,
            trainings: state.trainings.filter((record) => record.status === 'Scheduled').length,
            attendance: state.attendance.length,
            present: state.attendance.filter((record) => ['Present', 'Attended'].includes(statusValue(record.status))).length,
            released: state.beneficiaries.filter((record) => record.status === 'Released').length,
            overdue: pending.filter((record) => Date.now() - new Date(record.submitted_at).getTime() > 7 * 86400000).length,
        };
        Object.entries(metrics).forEach(([key, value]) => document.querySelectorAll(`[data-metric="${key}"]`).forEach((node) => { node.textContent = value; }));
        document.querySelector('#pendingRows').innerHTML = rowsOrEmpty(pending.slice(0, 6).map((record) => `<tr><td><strong>${escapeHtml(record.full_name)}</strong><small>${escapeHtml(record.reference)}</small></td><td>${escapeHtml(record.program)}</td><td>${formatDateTime(record.submitted_at)}</td><td>${statusPill(record.status)}</td></tr>`).join(''), 4, 'No pending beneficiary applications.');
    };

    const renderStudents = () => {
        const query = document.querySelector('#studentSearch').value.trim().toLowerCase();
        const status = document.querySelector('#studentStatus').value;
        const filtered = state.students.filter((record) => {
            const data = appData(record);
            return (!status || record.status === status) && `${record.full_name} ${record.reference} ${record.program} ${data['School name'] || ''}`.toLowerCase().includes(query);
        });
        const html = filtered.map((record) => {
            const qualification = qualificationFor(record);
            const data = appData(record);
            const reason = qualification.rule ? `${qualification.missing.length ? `Missing ${qualification.missing.length} document(s)` : 'Documents verified'} · ${qualification.attended ? 'activity attended' : `Awaiting ${qualification.rule.required_activity}`}` : 'No qualification rule assigned';
            return `<tr><td><strong>${escapeHtml(record.full_name)}</strong><small>${escapeHtml(record.reference)} · ${escapeHtml(data['Contact number'] || '')}</small></td><td>${escapeHtml(data['School name'] || '—')}<small>${escapeHtml(record.program || '')} · ${escapeHtml(data['Grade / year level'] || '')}</small></td><td><span class="qual-pill ${qualification.eligible ? 'qual-ready' : 'qual-waiting'}">${qualification.eligible ? 'Eligible' : 'Needs review'}</span><small>${escapeHtml(reason)}</small></td><td>${record.release_date ? `${formatDate(record.release_date)}<small>${record.release_amount ?? ''}</small>` : '—'}</td><td>${statusPill(record.status)}</td><td><div class="row-actions"><button class="mini-button" data-review="${escapeHtml(record.id)}">Review</button><button class="mini-button" data-history="${escapeHtml(record.id)}">History</button></div></td></tr>`;
        }).join('');
        document.querySelector('#studentRows').innerHTML = rowsOrEmpty(html, 6, 'No student applications match this search.');
    };

    const renderBeneficiaries = () => {
        const query = document.querySelector('#beneficiarySearch').value.trim().toLowerCase();
        const status = document.querySelector('#beneficiaryStatus').value;
        const filtered = state.beneficiaries.filter((record) => {
            const data = appData(record);
            return (!status || record.status === status)
                && `${record.full_name} ${record.reference} ${record.program} ${data['Requested assistance'] || ''}`.toLowerCase().includes(query);
        });
        const html = filtered.map((record) => {
            const qualification = qualificationFor(record);
            const data = appData(record);
            const reason = qualification.rule
                ? `${qualification.missing.length ? `Missing ${qualification.missing.length} document(s)` : 'Documents verified'} · ${qualification.attended ? 'activity attended' : `Awaiting ${qualification.rule.required_activity}`}`
                : 'No qualification rule assigned';
            return `<tr><td><strong>${escapeHtml(record.full_name)}</strong><small>${escapeHtml(record.reference)} · ${escapeHtml(data['Contact number'] || '')}</small></td><td>${escapeHtml(record.program || '—')}<small>${escapeHtml(data['Requested assistance'] || '')}</small></td><td><span class="qual-pill ${qualification.eligible ? 'qual-ready' : 'qual-waiting'}">${qualification.eligible ? 'Eligible' : 'Needs review'}</span><small>${escapeHtml(reason)}</small></td><td>${record.release_date ? `${formatDate(record.release_date)}<small>${record.release_amount ?? ''}</small>` : '—'}</td><td>${statusPill(record.status)}</td><td><div class="row-actions"><button class="mini-button" data-review="${escapeHtml(record.id)}">Review</button><button class="mini-button" data-history="${escapeHtml(record.id)}">History</button></div></td></tr>`;
        }).join('');
        document.querySelector('#beneficiaryRows').innerHTML = rowsOrEmpty(html, 6, 'No beneficiary applications match this search.');
    };

    const renderLivelihoods = () => {
        const query = document.querySelector('#livelihoodSearch').value.trim().toLowerCase();
        const filtered = state.livelihoods.filter((record) => `${record.full_name} ${record.reference} ${record.project_name} ${record.program}`.toLowerCase().includes(query));
        const html = filtered.map((record) => {
            const data = appData(record);
            const attended = state.attendance.filter((entry) => appData(entry).participantReference === record.reference).length;
            return `<tr><td><strong>${escapeHtml(record.full_name)}</strong><small>${escapeHtml(record.reference)} · ${escapeHtml(data['Contact number'] || '')}</small></td><td>${escapeHtml(record.project_name || '—')}<small>${escapeHtml(data['Business type'] || '')}</small></td><td>${escapeHtml(record.program || '—')}</td><td>${attended} attendance record(s)</td><td>${record.release_date ? `${formatDate(record.release_date)}<small>${record.release_amount ?? ''}</small>` : '—'}</td><td>${statusPill(record.status)}</td><td><div class="row-actions"><button class="mini-button" data-review="${escapeHtml(record.id)}">Review</button><button class="mini-button" data-history="${escapeHtml(record.id)}">History</button></div></td></tr>`;
        }).join('');
        document.querySelector('#livelihoodRows').innerHTML = rowsOrEmpty(html, 7, 'No livelihood participants match this search.');
    };

    const renderAttendance = () => {
        const query = document.querySelector('#attendanceSearch').value.trim().toLowerCase();
        const filtered = state.attendance.filter((record) => `${record.full_name} ${record.program} ${appData(record).activity} ${record.reference}`.toLowerCase().includes(query));
        const html = filtered.map((record) => {
            const data = appData(record);
            return `<tr><td><strong>${escapeHtml(data.participantName || record.full_name)}</strong><small>${escapeHtml(data.participantType || '')}</small></td><td>${escapeHtml(data.activity || record.program || '—')}<small>${escapeHtml(data.program || '')}</small></td><td>${formatDate(data.date)}</td><td>${statusPill(record.status)}</td><td><div class="row-actions"><span class="reference-text">${escapeHtml(record.reference)}</span><button class="mini-button" data-history="attendance-${record.id}">History</button></div></td></tr>`;
        }).join('');
        document.querySelector('#attendanceRows').innerHTML = rowsOrEmpty(html, 5, 'No attendance records match this search.');
    };

    const renderTrainings = () => {
        const html = state.trainings.map((record) => {
            const data = appData(record);
            const count = state.attendance.filter((entry) => appData(entry).trainingReference === record.reference).length;
            return `<tr><td><strong>${escapeHtml(data.title || record.full_name)}</strong><small>${escapeHtml(record.reference)}</small></td><td>${escapeHtml(record.program || '—')}</td><td>${formatDate(data.date)}<small>${escapeHtml(data.time || '')}</small></td><td>${escapeHtml(data.location || '—')}</td><td>${count} / ${escapeHtml(data.capacity || '—')}</td><td><select class="table-select" data-record-status="training-${record.id}"><option ${record.status === 'Scheduled' ? 'selected' : ''}>Scheduled</option><option ${record.status === 'Completed' ? 'selected' : ''}>Completed</option><option ${record.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option></select></td></tr>`;
        }).join('');
        document.querySelector('#trainingRows').innerHTML = rowsOrEmpty(html, 6, 'No training schedules yet.');
    };

    const populatePrograms = () => {
        ['studentProgram', 'beneficiaryProgram'].forEach((id) => {
            const select = document.querySelector(`#${id}`);
            const current = select.value;
            select.innerHTML = '<option value="">Select program</option>' + state.rules.map((rule) => `<option value="${escapeHtml(rule.program)}">${escapeHtml(rule.program)}</option>`).join('');
            if (state.rules.some((rule) => rule.program === current)) select.value = current;
        });
        const suggestions = [...new Set(state.rules.map((rule) => rule.required_activity).filter(Boolean))];
        document.querySelector('#activitySuggestions').innerHTML = suggestions.map((activity) => `<option value="${escapeHtml(activity)}"></option>`).join('');
    };

    const populateParticipants = () => {
        const select = document.querySelector('#attendanceParticipant');
        const current = select.value;
        const people = [
            ...state.students.map((record) => ({ reference: record.reference, name: record.full_name, group: 'Student' })),
            ...state.beneficiaries.map((record) => ({ reference: record.reference, name: record.full_name, group: 'Beneficiary' })),
            ...state.livelihoods.map((record) => ({ reference: record.reference, name: record.full_name, group: 'Livelihood' })),
        ];
        select.innerHTML = '<option value="">Select participant</option>' + people.map((person) => `<option value="${escapeHtml(person.reference)}">${escapeHtml(person.name)} · ${person.group} · ${escapeHtml(person.reference)}</option>`).join('');
        if (people.some((person) => person.reference === current)) select.value = current;
        const training = document.querySelector('#attendanceTraining');
        const selectedTraining = training.value;
        training.innerHTML = '<option value="">Not linked to a training schedule</option>' + state.trainings.filter((record) => record.status === 'Scheduled').map((record) => `<option value="${escapeHtml(record.reference)}">${escapeHtml(appData(record).title || record.full_name)} · ${formatDate(appData(record).date)}</option>`).join('');
        if (state.trainings.some((record) => record.reference === selectedTraining)) training.value = selectedTraining;
    };

    const renderRules = () => {
        const html = state.rules.map((rule) => `<article class="rule-card" data-rule="${escapeHtml(rule.program)}"><h3>${escapeHtml(rule.program)}</h3><label>Required documents <textarea data-rule-documents>${escapeHtml((rule.required_documents || []).join('\n'))}</textarea></label><label>Required program / activity <input data-rule-activity value="${escapeHtml(rule.required_activity || '')}" maxlength="150"></label><div class="rule-actions"><span class="inline-message" data-rule-message></span><button class="button button-primary" data-save-rule type="button">Save rule</button></div></article>`).join('');
        document.querySelector('#ruleList').innerHTML = rowsOrEmpty(html, 1, 'No qualification programs are configured yet.');
    };

    const loadReport = async () => {
        const query = new URLSearchParams();
        if (document.querySelector('#reportFrom').value) query.set('from', document.querySelector('#reportFrom').value);
        if (document.querySelector('#reportTo').value) query.set('to', document.querySelector('#reportTo').value);
        try {
            const report = await api(`reports/summary${query.size ? `?${query}` : ''}`);
            const totals = report.totals || {};
            const cards = [
                ['Student assistance', report.applications?.student?.total || 0, 'Educational applications'],
                ['Beneficiary applications', report.applications?.beneficiary?.total || 0, 'Registered applications'],
                ['Livelihood participants', report.applications?.livelihood?.total || 0, 'Registered participants'],
                ['Pending review', totals.pending || 0, 'Across both sections'],
                ['Approved', totals.approved || 0, 'Awaiting or recorded release'],
                ['Assistance released', totals.released || 0, `Recorded amount PHP ${Number(totals.releasedAmount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`],
                ['Attendance records', totals.attendance || 0, `${totals.present || 0} present · ${totals.absent || 0} absent`],
                ['Training schedules', totals.trainings || 0, 'Training and program activities'],
                ['Pending over 7 days', totals.pendingOverSevenDays || 0, 'Follow-up required'],
            ];
            document.querySelector('#reportCards').innerHTML = cards.map(([label, value, note]) => `<div class="report-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div>`).join('');
            const breakdown = Object.entries(report.applications || {}).map(([type, counts]) => `<tr><td>${type === 'student' ? 'Student assistance' : type === 'beneficiary' ? 'Beneficiary assistance' : 'Livelihood'}</td><td>${counts.total}</td><td>${counts.pending}</td><td>${counts.approved}</td><td>${counts.released}</td><td>${counts.rejected}</td></tr>`).join('');
            document.querySelector('#reportBreakdown').innerHTML = rowsOrEmpty(breakdown, 6, 'No report data for this period.');
            const released = document.querySelector('[data-metric="released"]');
            if (released) released.textContent = totals.released || 0;
        } catch (error) {
            showToast(error.message, true);
        }
    };

    const navigate = (page) => {
        if (!viewTitles[page]) return;
        document.querySelectorAll('[data-view]').forEach((view) => { view.hidden = view.dataset.view !== page; });
        document.querySelectorAll('.nav-link').forEach((link) => link.classList.toggle('is-active', link.dataset.page === page));
        document.querySelector('#pageTitle').textContent = viewTitles[page];
        document.querySelector('#sidebar').classList.remove('is-open');
        if (page === 'reports') loadReport();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const openReview = (recordId) => {
        const [type, rawId] = recordId.split('-');
        const list = type === 'student' ? state.students : type === 'beneficiary' ? state.beneficiaries : state.livelihoods;
        const record = list.find((item) => item.id === recordId);
        if (!record) return;
        const data = appData(record);
        state.review = { type, record };
        document.querySelector('#reviewTitle').textContent = record.full_name;
        document.querySelector('#reviewReference').textContent = `${record.reference} · ${type === 'beneficiary' ? record.program : record.project_name}`;
        const fields = type === 'student'
            ? [['School name', data['School name']], ['Grade / year level', data['Grade / year level']], ['Contact number', data['Contact number']], ['Address', data['Complete address']], ['Requested assistance', data['Requested assistance']]]
            : type === 'beneficiary'
            ? [['Contact number', data['Contact number']], ['Address', data['Complete address']], ['Requested assistance', data['Requested assistance']]]
            : [['Contact number', data['Contact number']], ['Business type', data['Business type']], ['Location', data['Business location']], ['Requested support', data['Support requested']]];
        document.querySelector('#reviewDetails').innerHTML = fields.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || '—')}</strong></div>`).join('');
        const verification = document.querySelector('#verificationFields');
        if (['student', 'beneficiary'].includes(type)) {
            const result = qualificationFor(record);
            const requirements = result.rule?.required_documents || [];
            verification.innerHTML = `<h3>Assistance requirements</h3>${requirements.map((item) => `<label><input type="checkbox" value="${escapeHtml(item)}" ${((data.verifiedRequirements || []).includes(item)) ? 'checked' : ''}>${escapeHtml(item)}</label>`).join('') || '<p class="inline-message">No required documents are configured.</p>'}<p class="inline-message">${result.rule?.required_activity ? `Assigned activity: ${escapeHtml(result.rule.required_activity)} · ${result.attended ? 'Attendance recorded' : 'Attendance not recorded'}` : ''}</p>`;
        } else {
            verification.innerHTML = '<p class="inline-message">Complete livelihood details were checked at registration.</p>';
        }
        document.querySelector('#reviewNote').value = data['Review note'] || '';
        document.querySelector('#releaseAmount').value = data['Release amount'] ?? '';
        document.querySelector('#releaseDate').value = data['Release date'] || '';
        document.querySelector('#reviewStatus').value = record.status;
        document.querySelector('#reviewMessage').textContent = '';
        document.querySelector('#reviewDialog').showModal();
        void rawId;
    };

    const openHistory = async (recordId) => {
        const title = document.querySelector('#historyTitle');
        const list = document.querySelector('#historyList');
        title.textContent = recordId;
        list.innerHTML = '<li>Loading history…</li>';
        document.querySelector('#historyDialog').showModal();
        try {
            const result = await api(`records/${recordId}/history`);
            title.textContent = result.full_name || result.reference;
            list.innerHTML = (result.history || []).map((entry) => `<li>${escapeHtml(entry.action)}${entry.to ? ` · ${escapeHtml(entry.from || '—')} → ${escapeHtml(entry.to)}` : ''}<small>${escapeHtml(entry.user)} · ${formatDateTime(entry.at)}</small></li>`).join('') || '<li>No history is recorded yet.</li>';
        } catch (error) {
            list.innerHTML = `<li>${escapeHtml(error.message)}</li>`;
        }
    };

    const bindApplicationForm = (formId, type) => {
        const form = document.querySelector(`#${formId}`);
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            setFormMessage(form, '');
            try {
                await submitJson(type, formData(form));
                form.reset();
                populatePrograms();
                setFormMessage(form, 'Saved to the program database.');
                showToast(type === 'beneficiary' ? 'Beneficiary application saved.' : 'Livelihood participant saved.');
                await loadWorkspace();
            } catch (error) {
                setFormMessage(form, error.message, true);
            }
        });
    };

    const bindRecordForm = (formId, type) => {
        const form = document.querySelector(`#${formId}`);
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            setFormMessage(form, '');
            const data = formData(form);
            if (type === 'attendance' && !data.trainingReference) delete data.trainingReference;
            try {
                await submitJson(type, data);
                form.reset();
                if (type === 'training') document.querySelector('#trainingForm [name="program"]').value = 'Livelihood program';
                if (type === 'training') document.querySelector('#trainingForm [name="location"]').value = 'Barangay Hall';
                if (type === 'training') document.querySelector('#trainingForm [name="capacity"]').value = '30';
                setFormMessage(form, 'Saved to the program database.');
                showToast(type === 'attendance' ? 'Attendance recorded.' : 'Training schedule saved.');
                await loadWorkspace();
            } catch (error) {
                setFormMessage(form, error.message, true);
            }
        });
    };

    const bindAuth = () => {
        document.querySelector('#loginForm').addEventListener('submit', async (event) => {
            event.preventDefault();
            const form = formData(event.currentTarget);
            try {
                await api('auth/login', { method: 'POST', body: JSON.stringify(form) });
                await refreshCsrfToken();
                showApp(await api('auth/session'));
            } catch (error) {
                document.querySelector('#authMessage').textContent = error.message;
            }
        });
        document.querySelector('#setupForm').addEventListener('submit', async (event) => {
            event.preventDefault();
            const form = formData(event.currentTarget);
            try {
                await api('auth/register', { method: 'POST', body: JSON.stringify(form) });
                await refreshCsrfToken();
                showApp(await api('auth/session'));
                showToast('Administrator account created.');
            } catch (error) {
                document.querySelector('#authMessage').textContent = error.message;
            }
        });
        document.querySelector('#logoutButton').addEventListener('click', async () => {
            try {
                await api('auth/logout', { method: 'POST' });
                window.location.reload();
            } catch (error) {
                showToast(error.message, true);
            }
        });
    };

    const bindWorkspace = () => {
        bindApplicationForm('studentForm', 'student');
        bindApplicationForm('beneficiaryForm', 'beneficiary');
        bindApplicationForm('livelihoodForm', 'livelihood');
        bindRecordForm('attendanceForm', 'attendance');
        bindRecordForm('trainingForm', 'training');
        document.querySelectorAll('.nav-link').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.page)));
        document.querySelectorAll('[data-page]:not(.nav-link)').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.page)));
        document.querySelectorAll('[data-scroll]').forEach((button) => button.addEventListener('click', () => document.querySelector(`#${button.dataset.scroll}`).scrollIntoView({ behavior: 'smooth', block: 'center' })));
        document.querySelector('#menuButton').addEventListener('click', () => document.querySelector('#sidebar').classList.toggle('is-open'));
        document.querySelector('#studentSearch').addEventListener('input', renderStudents);
        document.querySelector('#studentStatus').addEventListener('change', renderStudents);
        document.querySelector('#beneficiarySearch').addEventListener('input', renderBeneficiaries);
        document.querySelector('#beneficiaryStatus').addEventListener('change', renderBeneficiaries);
        document.querySelector('#livelihoodSearch').addEventListener('input', renderLivelihoods);
        document.querySelector('#attendanceSearch').addEventListener('input', renderAttendance);
        document.querySelector('#refreshReport').addEventListener('click', loadReport);
        document.querySelector('#printReport').addEventListener('click', () => window.print());
        document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
        document.querySelector('#reviewForm').addEventListener('submit', async (event) => {
            event.preventDefault();
            const { type, record } = state.review || {};
            if (!record) return;
            const data = { 'Review note': document.querySelector('#reviewNote').value.trim() || null };
                if (['student', 'beneficiary'].includes(type)) data.verifiedRequirements = [...document.querySelectorAll('#verificationFields input[type="checkbox"]:checked')].map((input) => input.value);
            const releaseAmount = document.querySelector('#releaseAmount').value;
            const releaseDate = document.querySelector('#releaseDate').value;
            if (releaseAmount !== '') data['Release amount'] = Number(releaseAmount);
            if (releaseDate) data['Release date'] = releaseDate;
            try {
                await api(`records/${record.id}`, { method: 'PATCH', body: JSON.stringify({ status: document.querySelector('#reviewStatus').value, data }) });
                document.querySelector('#reviewDialog').close();
                showToast('Application review saved.');
                await loadWorkspace();
            } catch (error) {
                document.querySelector('#reviewMessage').textContent = error.message;
            }
        });
        document.querySelector('#ruleList').addEventListener('click', async (event) => {
            const button = event.target.closest('[data-save-rule]');
            if (!button) return;
            const card = button.closest('[data-rule]');
            const documents = card.querySelector('[data-rule-documents]').value.split('\n').map((item) => item.trim()).filter(Boolean);
            const activity = card.querySelector('[data-rule-activity]').value.trim();
            try {
                await api(`qualification-rules/${encodeURIComponent(card.dataset.rule)}`, { method: 'PUT', body: JSON.stringify({ required_documents: documents, required_activity: activity || null }) });
                card.querySelector('[data-rule-message]').textContent = 'Saved';
                showToast('Qualification rule saved.');
                await loadWorkspace();
            } catch (error) {
                card.querySelector('[data-rule-message]').textContent = error.message;
            }
        });
        document.body.addEventListener('click', (event) => {
            const review = event.target.closest('[data-review]');
            if (review) openReview(review.dataset.review);
            const history = event.target.closest('[data-history]');
            if (history) openHistory(history.dataset.history);
        });
        document.body.addEventListener('change', async (event) => {
            const select = event.target.closest('[data-record-status]');
            if (!select) return;
            try {
                await api(`records/${select.dataset.recordStatus}`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) });
                showToast('Program record updated.');
                await loadWorkspace();
            } catch (error) {
                showToast(error.message, true);
                await loadWorkspace();
            }
        });
    };

    const boot = async () => {
        bindAuth();
        bindWorkspace();
        try {
            await refreshCsrfToken();
            const session = await api('auth/session');
            if (session.authenticated) {
                showApp(session);
                return;
            }
            const setup = await api('auth/setup');
            showAuth(setup.canRegister);
        } catch (error) {
            showAuth(false);
            document.querySelector('#authMessage').textContent = `Unable to connect to the system database: ${error.message}`;
        }
    };

    document.addEventListener('DOMContentLoaded', boot);
})();
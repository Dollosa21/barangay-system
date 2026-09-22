(() => {
    const read = (key) => {
        try {
            const value = JSON.parse(localStorage.getItem(key) || '[]');
            return Array.isArray(value) ? value : [];
        } catch (error) {
            return [];
        }
    };
    const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&#38;', '<': '&#60;', '>': '&#62;', "'": '&#039;', '"': '&#34;' }[character]));
    const fullName = (record) => [record['First name'], record['Middle name'], record['Last name']].filter(Boolean).join(' ') || record['Applicant / owner name'] || record.beneficiaryName || record.participantName || 'Unnamed applicant';
    const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not recorded';
    const formatDateTime = (value) => value ? new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded';
    const updateDashboardGreeting = () => {
        const greeting = document.querySelector('#dashboardGreeting');
        if (!greeting) return;
        const hour = new Date().getHours();
        const period = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
        greeting.textContent = `Good ${period}, Administrator`;
    };
    const statusClass = (status) => ({ Approved: 'status-approved', Released: 'status-released', Pending: 'status-pending', Rejected: 'status-rejected', Attended: 'status-approved', Absent: 'status-rejected' }[status] || 'status-pending');
    const inReportRange = (value) => {
        const from = document.querySelector('#reportFrom')?.value;
        const to = document.querySelector('#reportTo')?.value;
        if (!value) return !from && !to;
        const date = String(value).slice(0, 10);
        return (!from || date >= from) && (!to || date <= to);
    };
    const appendHistory = (record, action, status) => {
        record.history = Array.isArray(record.history) ? record.history : [];
        record.history.push({ action, status, at: new Date().toISOString() });
    };
    const actionButtons = (type, reference, archived) => `<div class="record-actions"><button class="btn btn-sm btn-outline-primary record-action" data-record-action="edit" data-record-type="${type}" data-reference="${escapeHtml(reference)}" type="button" title="Edit record"><i class="fas fa-pen"></i></button>${type !== 'attendance' ? `<button class="btn btn-sm btn-outline-info record-action" data-record-action="history" data-record-type="${type}" data-reference="${escapeHtml(reference)}" type="button" title="View history"><i class="fas fa-clock-rotate-left"></i></button>` : ''}<button class="btn btn-sm btn-outline-secondary record-action" data-record-action="${archived ? 'restore' : 'archive'}" data-record-type="${type}" data-reference="${escapeHtml(reference)}" type="button" title="${archived ? 'Restore record' : 'Archive record'}"><i class="fas fa-${archived ? 'rotate-left' : 'box-archive'}"></i></button><button class="btn btn-sm btn-outline-danger record-action" data-record-action="delete" data-record-type="${type}" data-reference="${escapeHtml(reference)}" type="button" title="Delete record"><i class="fas fa-trash"></i></button></div>`;
    const programRules = {
        'Food assistance': { activity: 'Community assembly', requirements: ['Valid barangay ID', 'Proof of residency'] },
        'Medical assistance': { activity: 'Health assessment', requirements: ['Valid barangay ID', 'Medical certificate'] },
        'Educational assistance': { activity: 'Orientation', requirements: ['Valid barangay ID', 'School enrollment document'] },
        'Senior citizen support': { activity: 'Community assembly', requirements: ['Valid barangay ID', 'Senior citizen ID'] },
        'Emergency relief': { activity: 'Emergency validation', requirements: ['Valid barangay ID'] }
    };
    const ruleFor = (program) => programRules[program] || { activity: 'Community assembly', requirements: ['Valid barangay ID'] };
    const getQualification = (beneficiary, attendance) => {
        const rule = ruleFor(beneficiary['Assistance program']);
        const attended = attendance.some((item) => (item.beneficiaryReference === beneficiary.reference || item.beneficiary === beneficiary.reference || item.beneficiaryName === fullName(beneficiary)) && item.activity === rule.activity && item.status === 'Attended');
        const submitted = beneficiary.requirements || [];
        const missing = rule.requirements.filter((item) => !submitted.includes(item));
        return { required: rule.activity, missing, eligible: attended && missing.length === 0 };
    };
    const addControl = (id, placeholder, anchor, type = 'search') => {
        if (document.querySelector(`#${id}`) || !anchor) return document.querySelector(`#${id}`);
        const input = document.createElement('input');
        input.id = id;
        input.className = 'form-control mb-3';
        input.type = type;
        input.placeholder = placeholder;
        input.setAttribute('aria-label', placeholder);
        anchor.insertAdjacentElement('afterend', input);
        return input;
    };
    const setupRecordControls = () => {
        const assistance = document.querySelector('#assistance');
        const livelihood = document.querySelector('#livelihood');
        const attendance = document.querySelector('#attendanceRows')?.closest('.content-panel');
        addControl('livelihoodSearch', 'Search participant, project, or reference', livelihood?.querySelector('.panel-heading'));
        addControl('attendanceSearch', 'Search attendance records', attendance?.querySelector('.panel-heading'));
        [['#beneficiaryRows', 'Actions'], ['#livelihoodRows', 'Actions'], ['#attendanceRows', 'Actions'], ['#trainingRows', 'Actions']].forEach(([bodySelector, label]) => {
            const row = document.querySelector(bodySelector)?.closest('table')?.querySelector('thead tr');
            if (row && !row.querySelector('.actions-heading')) {
                const heading = document.createElement('th');
                heading.className = 'actions-heading';
                heading.textContent = label;
                row.appendChild(heading);
            }
        });
        if (!document.querySelector('#showArchived') && assistance) {
            const label = document.createElement('label');
            label.className = 'form-check mb-3';
            label.innerHTML = '<input class="form-check-input" id="showArchived" type="checkbox"><span class="form-check-label">Show archived records</span>';
            assistance.querySelector('.record-filters')?.appendChild(label);
        }
        const reportPanel = document.querySelector('#reports');
        if (reportPanel && !document.querySelector('#reportFrom')) {
            const tools = document.createElement('div');
            tools.className = 'report-tools d-flex gap-2 mb-3';
            tools.innerHTML = '<input class="form-control form-control-sm" id="reportFrom" type="date" aria-label="Report start date"><input class="form-control form-control-sm" id="reportTo" type="date" aria-label="Report end date"><button class="btn btn-light btn-sm" id="exportReport" type="button"><i class="fas fa-download me-1"></i>Export CSV</button>';
            reportPanel.querySelector('.panel-heading')?.insertAdjacentElement('afterend', tools);
        }
    };
    const personReference = (name) => {
        const search = String(name || '').trim().toLowerCase();
        return read('barangayBeneficiaries').find((item) => fullName(item).toLowerCase() === search)?.reference || read('barangayLivelihoods').find((item) => String(item['Applicant / owner name']).toLowerCase() === search)?.reference || '';
    };
    const renderDashboard = () => {
        const beneficiaries = read('barangayBeneficiaries');
        const livelihoods = read('barangayLivelihoods');
        const attendance = read('barangayAttendance');
        const trainings = read('barangayTrainings');
        const reportBeneficiaries = beneficiaries.filter((item) => inReportRange(item.submittedAt));
        const reportLivelihoods = livelihoods.filter((item) => inReportRange(item.submittedAt));
        const reportAttendance = attendance.filter((item) => inReportRange(item.date));
        const stats = { beneficiaries: beneficiaries.length, pending: reportBeneficiaries.filter((item) => item.status === 'Pending').length, approved: reportBeneficiaries.filter((item) => ['Approved', 'Released'].includes(item.status)).length, participants: reportLivelihoods.length, eligible: reportBeneficiaries.filter((item) => getQualification(item, attendance).eligible).length };
        document.querySelectorAll('[data-stat]').forEach((element) => { element.textContent = stats[element.dataset.stat] ?? 0; });
        const applicationRows = document.querySelector('#dashboardApplications');
        if (applicationRows) applicationRows.innerHTML = beneficiaries.slice(-5).reverse().map((item) => `<tr><td><strong>${escapeHtml(fullName(item))}</strong><small>${escapeHtml(item.reference)}</small></td><td>${escapeHtml(item['Assistance program'])}</td><td><span class="status ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td><td>${formatDate(item.releaseDate)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty-state">No beneficiary applications yet. Start by registering a beneficiary.</td></tr>';
        const activityRows = document.querySelector('#dashboardActivities');
        if (activityRows) activityRows.innerHTML = trainings.slice(-4).reverse().map((item) => `<li><span class="activity-icon"><i class="fas fa-calendar-check"></i></span><span><strong>${escapeHtml(item.title)}</strong><small>${formatDate(item.date)} &middot; ${escapeHtml(item.location || 'Barangay Hall')}</small></span></li>`).join('') || '<li class="empty-state">No training schedules recorded yet.</li>';
    };
    const renderRecords = () => {
        const beneficiaries = read('barangayBeneficiaries');
        const livelihoods = read('barangayLivelihoods');
        const attendance = read('barangayAttendance');
        const trainings = read('barangayTrainings');
        const reportBeneficiaries = beneficiaries.filter((item) => inReportRange(item.submittedAt));
        const reportAttendance = attendance.filter((item) => inReportRange(item.date));
        const query = String(document.querySelector('#assistanceSearch')?.value || '').trim().toLowerCase();
        const livelihoodQuery = String(document.querySelector('#livelihoodSearch')?.value || '').trim().toLowerCase();
        const attendanceQuery = String(document.querySelector('#attendanceSearch')?.value || '').trim().toLowerCase();
        const statusFilter = document.querySelector('#assistanceStatusFilter')?.value || '';
        const showArchived = document.querySelector('#showArchived')?.checked;
        const visible = beneficiaries.filter((item) => `${fullName(item)} ${item.reference} ${item['Assistance program']}`.toLowerCase().includes(query) && (!statusFilter || item.status === statusFilter) && (showArchived || !item.archivedAt));
        const beneficiaryRows = document.querySelector('#beneficiaryRows');
        if (beneficiaryRows) beneficiaryRows.innerHTML = visible.map((item) => {
            const qualification = getQualification(item, attendance);
            const reason = qualification.eligible ? 'Requirements and activity complete' : `Missing: ${qualification.missing.join(', ') || qualification.required}`;
            return `<tr><td><strong>${escapeHtml(fullName(item))}</strong><small>${escapeHtml(item.reference)}</small></td><td>${escapeHtml(item['Assistance program'])}<small>Required: ${escapeHtml(item.assignedActivity || qualification.required)}</small></td><td><span class="status ${statusClass(item.status)}">${escapeHtml(item.status)}</span>${item.releaseDate ? `<small>Released ${formatDate(item.releaseDate)}</small>` : ''}</td><td><span class="qualification ${qualification.eligible ? 'is-eligible' : ''}">${qualification.eligible ? 'Eligible' : 'Needs action'}</span><small>${escapeHtml(reason)}</small></td><td><small>Registered ${formatDateTime(item.submittedAt)}</small><select class="form-select form-select-sm record-status mt-1" data-reference="${escapeHtml(item.reference)}"><option ${item.status === 'Pending' ? 'selected' : ''}>Pending</option><option ${item.status === 'Approved' ? 'selected' : ''} ${!qualification.eligible && item.status !== 'Approved' ? 'disabled' : ''}>Approved</option><option ${item.status === 'Released' ? 'selected' : ''}>Released</option><option ${item.status === 'Rejected' ? 'selected' : ''}>Rejected</option></select><input class="form-control form-control-sm mt-1 record-release" data-reference="${escapeHtml(item.reference)}" type="date" value="${item.releaseDate || ''}" aria-label="Release date">${actionButtons('beneficiary', item.reference, item.archivedAt)}</td></tr>`;
        }).join('') || '<tr><td colspan="5" class="empty-state">No applications found.</td></tr>';
        const livelihoodRows = document.querySelector('#livelihoodRows');
        if (livelihoodRows) livelihoodRows.innerHTML = livelihoods.filter((item) => !item.archivedAt && `${item['Applicant / owner name']} ${item['Business / project name']} ${item.reference}`.toLowerCase().includes(livelihoodQuery)).map((item) => { const participantAttendance = attendance.filter((record) => record.participantReference === item.reference || record.participantName?.toLowerCase() === item['Applicant / owner name']?.toLowerCase()); const attended = participantAttendance.filter((record) => record.status === 'Attended').length; const history = participantAttendance.slice(-3).map((record) => `${record.activity} (${formatDate(record.date)})`).join(', ') || 'No activities yet'; return `<tr><td><strong>${escapeHtml(item['Applicant / owner name'])}</strong><small>${escapeHtml(item.reference)}</small></td><td>${escapeHtml(item['Business / project name'])}<small>${attended} attended: ${escapeHtml(history)}</small></td><td>${escapeHtml(item['Support requested'])}</td><td><span class="status ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td><td><small>${formatDateTime(item.submittedAt)}</small></td><td>${actionButtons('livelihood', item.reference, item.archivedAt)}</td></tr>`; }).join('') || '<tr><td colspan="6" class="empty-state">No livelihood participants found.</td></tr>';
        const attendanceRows = document.querySelector('#attendanceRows');
        if (attendanceRows) attendanceRows.innerHTML = attendance.filter((item) => (document.querySelector('#showArchived')?.checked || !item.archivedAt) && `${item.beneficiaryName || item.participantName} ${item.activity} ${item.date}`.toLowerCase().includes(attendanceQuery)).map((item) => `<tr><td>${escapeHtml(item.beneficiaryName || item.participantName)}</td><td>${escapeHtml(item.activity)}<small>${escapeHtml(item.participantType || 'Beneficiary')}</small></td><td>${formatDate(item.date)}</td><td><span class="status ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td><td>${actionButtons('attendance', item.id, item.archivedAt)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">No attendance records yet.</td></tr>';
        const trainingRows = document.querySelector('#trainingRows');
        if (trainingRows) trainingRows.innerHTML = trainings.filter((item) => document.querySelector('#showArchived')?.checked || !item.archivedAt).map((item) => `<tr><td><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.program || 'Livelihood program')}</small></td><td>${formatDate(item.date)}</td><td>${escapeHtml(item.location || 'Barangay Hall')}</td><td>${escapeHtml(item.facilitator || 'Barangay staff')}</td><td>${actionButtons('training', item.id, item.archivedAt)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">No training records yet.</td></tr>';
        document.querySelectorAll('[data-stat="attendance"]').forEach((element) => { element.textContent = reportAttendance.filter((item) => item.status === 'Attended').length; });
        document.querySelectorAll('[data-stat="released"]').forEach((element) => { element.textContent = reportBeneficiaries.filter((item) => item.status === 'Released').length; });
    };
    const bindForms = () => {
        document.querySelectorAll('[data-record-form]').forEach((form) => form.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!form.checkValidity()) { form.classList.add('was-validated'); form.reportValidity(); return; }
            const key = form.dataset.recordForm;
            const data = Object.fromEntries(new FormData(form).entries());
            if (key === 'barangayAttendance') {
                const reference = personReference(data.participantName);
                data.participantReference = reference;
                data.beneficiaryReference = read('barangayBeneficiaries').some((item) => item.reference === reference) ? reference : '';
                data.participantType = data.participantType || (data.beneficiaryReference ? 'Beneficiary' : 'Livelihood participant');
            }
            const records = read(key);
            const createdAt = new Date().toISOString();
            records.push({ ...data, id: `${key}-${Date.now()}`, createdAt, history: [{ action: 'Created', status: data.status || 'Scheduled', at: createdAt }] });
            write(key, records); form.reset(); form.classList.remove('was-validated');
            const notice = form.querySelector('.form-success');
            if (notice) { notice.textContent = 'Record saved successfully.'; notice.classList.remove('d-none'); }
            renderDashboard(); renderRecords();
        }));
        document.addEventListener('change', (event) => {
            if (!event.target.matches('.record-status, .record-release')) return;
            const records = read('barangayBeneficiaries');
            const record = records.find((item) => item.reference === event.target.dataset.reference);
            if (!record) return;
            if (event.target.matches('.record-status')) {
                const qualification = getQualification(record, read('barangayAttendance'));
                const nextStatus = event.target.value === 'Approved' && !qualification.eligible ? 'Pending' : event.target.value;
                if (record.status !== nextStatus) appendHistory(record, `Status changed to ${nextStatus}`, nextStatus);
                record.status = nextStatus;
            } else {
                record.releaseDate = event.target.value;
                if (event.target.value && record.status === 'Approved') { record.status = 'Released'; appendHistory(record, 'Assistance released', 'Released'); }
                if (!event.target.value && record.status === 'Released') { record.status = 'Approved'; appendHistory(record, 'Release date removed', 'Approved'); }
            }
            write('barangayBeneficiaries', records); renderDashboard(); renderRecords();
        });
        document.addEventListener('click', (event) => {
            const action = event.target.closest('.record-action')?.dataset;
            if (!action) return;
            const key = action.recordType === 'beneficiary' ? 'barangayBeneficiaries' : action.recordType === 'livelihood' ? 'barangayLivelihoods' : action.recordType === 'training' ? 'barangayTrainings' : 'barangayAttendance';
            const records = read(key);
            const record = records.find((item) => item.reference === action.reference || item.id === action.reference);
            if (!record) return;
            if (action.recordAction === 'history') {
                const history = (record.history || []).map((item) => `${new Date(item.at).toLocaleString('en-PH')} - ${item.action}`).join('\n');
                window.alert(history || 'No history recorded for this record.');
                return;
            }
            if (action.recordAction === 'delete') {
                if (!window.confirm('Delete this record permanently?')) return;
                write(key, records.filter((item) => item !== record));
            } else if (action.recordAction === 'archive') {
                record.archivedAt = new Date().toISOString();
                if (record.history) appendHistory(record, 'Archived', record.status);
                write(key, records);
            } else if (action.recordAction === 'restore') {
                delete record.archivedAt;
                if (record.history) appendHistory(record, 'Restored', record.status);
                write(key, records);
            } else if (action.recordAction === 'edit') {
                const label = action.recordType === 'beneficiary' ? 'application purpose' : action.recordType === 'livelihood' ? 'project description' : action.recordType === 'training' ? 'training title' : 'activity';
                const field = action.recordType === 'beneficiary' ? 'applicationPurpose' : action.recordType === 'livelihood' ? 'Project description' : action.recordType === 'training' ? 'title' : 'activity';
                const updated = window.prompt(`Update ${label}:`, record[field] || '');
                if (updated === null || !updated.trim()) return;
                record[field] = updated.trim();
                if (record.history) appendHistory(record, `Updated ${label}`, record.status);
                write(key, records);
            }
            renderDashboard();
            renderRecords();
        });
    };
    const exportReport = () => {
        const rows = [['Type', 'Reference', 'Name', 'Status', 'Registered / Date']];
        read('barangayBeneficiaries').filter((item) => inReportRange(item.submittedAt)).forEach((item) => rows.push(['Beneficiary', item.reference, fullName(item), item.status, item.submittedAt]));
        read('barangayLivelihoods').filter((item) => inReportRange(item.submittedAt)).forEach((item) => rows.push(['Livelihood', item.reference, item['Applicant / owner name'], item.status, item.submittedAt]));
        const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        link.download = `barangay-report-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };
    document.addEventListener('DOMContentLoaded', () => { updateDashboardGreeting(); window.setInterval(updateDashboardGreeting, 60000); setupRecordControls(); bindForms(); document.querySelectorAll('#assistanceSearch, #assistanceStatusFilter, #showArchived, #livelihoodSearch, #attendanceSearch, #reportFrom, #reportTo').forEach((control) => control.addEventListener('input', () => { renderDashboard(); renderRecords(); })); document.querySelector('#exportReport')?.addEventListener('click', exportReport); renderDashboard(); renderRecords(); });
})();

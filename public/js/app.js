(() => {
    const recordsByKey = { barangayBeneficiaries: [], barangayLivelihoods: [], barangayAttendance: [], barangayTrainings: [] };
    const read = (key) => {
        return recordsByKey[key] || [];
    };
    const write = () => {};
    const loadRecords = async () => {
        const recordSets = await Promise.all(['student', 'beneficiary', 'livelihood', 'attendance', 'training'].map(async (type) => {
            const firstPage = await window.barangayApiRequest(`records?type=${type}&per_page=100&page=1`);
            const records = [...(firstPage.data || [])];
            for (let page = 2; page <= (firstPage.meta?.last_page || 1); page += 1) {
                const nextPage = await window.barangayApiRequest(`records?type=${type}&per_page=100&page=${page}`);
                records.push(...(nextPage.data || []));
            }
            return records;
        }));
        const records = recordSets.flat();
        Object.values(recordsByKey).forEach((items) => items.splice(0, items.length));
        records.forEach((item) => {
            const mapped = { ...item.data, id: item.id, type: item.type, reference: item.reference, status: item.status, releaseDate: item.release_date || item.data['Release date'] || '', releaseAmount: item.release_amount ?? item.data['Release amount'] ?? '', submittedAt: item.submitted_at, full_name: item.full_name };
            const key = { student: 'barangayBeneficiaries', beneficiary: 'barangayBeneficiaries', livelihood: 'barangayLivelihoods', attendance: 'barangayAttendance', training: 'barangayTrainings' }[item.type];
            recordsByKey[key]?.push(mapped);
        });
    };
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
    const actionButtons = (type, reference) => `<button class="btn btn-sm btn-outline-secondary record-action" type="button" data-record-action="history" data-record-type="${escapeHtml(type)}" data-reference="${escapeHtml(reference)}">View history</button>`;
    let programRules = {
        'Food assistance': { activity: 'Community assembly', requirements: ['Valid barangay ID', 'Proof of residency'] },
        'Medical assistance': { activity: 'Health assessment', requirements: ['Valid barangay ID', 'Medical certificate'] },
        'Educational assistance': { activity: 'Orientation', requirements: ['Valid barangay ID', 'School enrollment document'] },
        'Senior citizen support': { activity: 'Community assembly', requirements: ['Valid barangay ID', 'Senior citizen ID'] },
        'Emergency relief': { activity: 'Emergency validation', requirements: ['Valid barangay ID'] }
    };
    const loadQualificationRules = async () => {
        const result = await window.barangayApiRequest('qualification-rules');
        (result.data || []).forEach((rule) => {
            programRules[rule.program] = { activity: rule.required_activity || '', requirements: rule.required_documents || [] };
        });
    };
    const ruleFor = (program) => programRules[program] || { activity: 'Community assembly', requirements: ['Valid barangay ID'] };
    const getQualification = (beneficiary, attendance) => {
        const rule = ruleFor(beneficiary['Assistance program']);
        const attended = !rule.activity || attendance.some((item) => (item.beneficiaryReference === beneficiary.reference || item.beneficiary === beneficiary.reference || item.beneficiaryName === fullName(beneficiary)) && item.activity === rule.activity && item.status === 'Attended');
        const submitted = beneficiary.verifiedRequirements || [];
        const missing = rule.requirements.filter((item) => !submitted.includes(item));
        return { required: rule.activity || 'No activity required', requirements: rule.requirements, missing, activityAttended: attended, eligible: attended && missing.length === 0 };
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
    const renderApplicantOverview = () => {
        const body = document.querySelector('#overallApplicantRows');
        if (!body) return;
        const query = String(document.querySelector('#overallApplicantSearch')?.value || '').trim().toLowerCase();
        const typeFilter = document.querySelector('#overallApplicantType')?.value || '';
        const qualificationFilter = document.querySelector('#overallQualificationFilter')?.value || '';
        const attendance = read('barangayAttendance');
        const applicants = [
            ...read('barangayBeneficiaries').map((record) => ({ record, type: record.type || (record.reference?.startsWith('EDU-') ? 'student' : 'beneficiary') })),
            ...read('barangayLivelihoods').map((record) => ({ record, type: 'livelihood' })),
        ];
        const rows = applicants.map(({ record, type }) => {
            const name = type === 'livelihood' ? record['Applicant / owner name'] || record.full_name : fullName(record);
            const program = type === 'livelihood' ? record['Business / project name'] : record['Assistance program'];
            let state;
            let progress;
            let decision;
            if (type === 'livelihood') {
                const requiredFields = ['Applicant / owner name', 'Contact number', 'Business type', 'Business / project name', 'Business location', 'Estimated capital', 'Expected workers', 'Support requested', 'Project description'];
                const missing = requiredFields.filter((key) => !String(record[key] ?? '').trim());
                const complete = missing.length === 0;
                state = record.status === 'Rejected' ? 'action' : ['Approved', 'Released'].includes(record.status) ? 'qualified' : complete ? 'review' : 'action';
                progress = complete ? 'Application details complete' : `Missing details: ${missing.join(', ')}`;
                decision = state === 'qualified' ? `${record.status} - qualified` : state === 'action' ? record.status === 'Rejected' ? 'Not qualified - rejected' : 'Needs action - incomplete' : 'Ready for admin eligibility review';
            } else {
                const result = getQualification(record, attendance);
                state = record.status === 'Rejected' ? 'action' : ['Approved', 'Released'].includes(record.status) || result.eligible ? 'qualified' : 'action';
                progress = `${(result.requirements.length - result.missing.length)}/${result.requirements.length} documents verified; ${result.activityAttended ? 'activity attended' : `awaiting ${result.required}`}`;
                decision = ['Approved', 'Released'].includes(record.status) ? `${record.status} - qualified` : result.eligible ? 'Qualified - ready for approval' : record.status === 'Rejected' ? 'Not qualified - rejected' : 'Needs action - incomplete requirements';
            }
            return { record, type, name, program: program || 'Not specified', state, progress, decision };
        }).filter((item) => (!typeFilter || item.type === typeFilter)
            && (!query || `${item.name} ${item.record.reference} ${item.program}`.toLowerCase().includes(query))
            && (!qualificationFilter || item.state === qualificationFilter));
        body.replaceChildren();
        if (!rows.length) {
            const row = body.insertRow(); const cell = row.insertCell(); cell.colSpan = 6; cell.className = 'empty-state'; cell.textContent = 'No applicants match these filters.'; return;
        }
        const stateRank = { action: 0, qualified: 1, review: 2 };
        rows.sort((a, b) => stateRank[a.state] - stateRank[b.state]);
        rows.forEach((item) => {
            const row = body.insertRow();
            const nameCell = row.insertCell(); const name = document.createElement('strong'); name.textContent = item.name || 'Unnamed applicant'; nameCell.appendChild(name); const reference = document.createElement('small'); reference.textContent = item.record.reference; nameCell.appendChild(reference);
            row.insertCell().textContent = ({ student: 'Educational assistance', beneficiary: 'Beneficiary', livelihood: 'Livelihood' })[item.type];
            row.insertCell().textContent = item.program;
            row.insertCell().textContent = item.progress;
            const decisionCell = row.insertCell(); const badge = document.createElement('span'); badge.className = `qualification ${item.state === 'qualified' ? 'is-eligible' : ''}`; badge.textContent = item.decision; decisionCell.appendChild(badge);
            const actionCell = row.insertCell(); const link = document.createElement('a'); link.className = 'btn btn-sm btn-outline-primary'; link.href = item.type === 'livelihood' ? '#livelihood' : '#assistance'; link.textContent = item.record.status === 'Released' ? 'View release' : item.record.status === 'Approved' ? 'Record release' : item.type === 'livelihood' ? 'Review livelihood' : 'Review application'; link.addEventListener('click', () => { const filter = document.querySelector(item.type === 'livelihood' ? '#livelihoodSearch' : '#assistanceSearch'); if (filter) { filter.value = item.name || ''; filter.dispatchEvent(new Event('input', { bubbles: true })); } document.querySelector(item.type === 'livelihood' ? '#livelihood' : '#assistance')?.scrollIntoView({ behavior: 'smooth' }); }); actionCell.appendChild(link);
        });
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
        const canReview = window.barangayUserRole === 'administrator';
        const canApprove = window.barangayUserRole === 'administrator';
        if (beneficiaryRows) beneficiaryRows.innerHTML = visible.map((item) => {
            const qualification = getQualification(item, attendance);
            const reason = qualification.eligible ? 'Documents verified and required activity attended' : [qualification.missing.length ? `Documents: ${qualification.missing.join(', ')}` : '', !qualification.activityAttended ? `Activity attendance: ${qualification.required}` : ''].filter(Boolean).join(' | ');
            const verified = item.verifiedRequirements || [];
            const checks = qualification.requirements.map((requirement) => `<label class="form-check small"><input class="form-check-input requirement-verified" type="checkbox" data-reference="${escapeHtml(item.reference)}" value="${escapeHtml(requirement)}" ${verified.includes(requirement) ? 'checked' : ''} ${canReview ? '' : 'disabled'}><span class="form-check-label">Verify ${escapeHtml(requirement)}</span></label>`).join('');
            const pendingDays = item.status === 'Pending' && item.submittedAt ? Math.max(0, Math.floor((Date.now() - new Date(item.submittedAt).getTime()) / 86400000)) : null;
            return `<tr><td><strong>${escapeHtml(fullName(item))}</strong><small>${escapeHtml(item.reference)}</small></td><td>${escapeHtml(item['Assistance program'])}<small>Required: ${escapeHtml(item.assignedActivity || qualification.required)}</small></td><td><span class="status ${statusClass(item.status)}">${escapeHtml(item.status)}</span>${item.releaseDate ? `<small>Released ${formatDate(item.releaseDate)}</small>` : ''}${pendingDays !== null ? `<small class="${pendingDays >= 7 ? 'text-danger fw-semibold' : ''}">${pendingDays} days pending</small>` : ''}</td><td><span class="qualification ${qualification.eligible ? 'is-eligible' : ''}">${qualification.eligible ? 'Ready for approval' : item.status === 'Rejected' ? 'Not qualified' : 'Needs action'}</span><small class="review-reason">${escapeHtml(reason)}</small><div class="mt-2"><small>Confirm each submitted document</small>${checks}</div></td><td><small>Registered ${formatDateTime(item.submittedAt)}</small><select class="form-select form-select-sm record-status mt-1" data-reference="${escapeHtml(item.reference)}" ${canApprove ? '' : 'disabled'}><option ${item.status === 'Pending' ? 'selected' : ''}>Pending</option><option value="Approved" ${item.status === 'Approved' ? 'selected' : ''} ${!qualification.eligible && item.status !== 'Approved' ? 'disabled' : ''}>Approve when ready</option><option value="Released" ${item.status === 'Released' ? 'selected' : ''} disabled>Released</option><option ${item.status === 'Rejected' ? 'selected' : ''}>Rejected</option></select><input class="form-control form-control-sm mt-1 review-note" data-reference="${escapeHtml(item.reference)}" maxlength="1000" placeholder="Review note (required to reject)" value="${escapeHtml(item['Review note'] || '')}" aria-label="Review note for ${escapeHtml(fullName(item))}" ${canReview ? '' : 'disabled'}><label class="form-text mt-1">After approval, enter the release details below.</label><input class="form-control form-control-sm mt-1 record-release-amount" data-reference="${escapeHtml(item.reference)}" type="number" min="0" step="0.01" value="${item.releaseAmount ?? ''}" placeholder="Release amount (0 for in-kind)" aria-label="Release amount" ${canApprove && ['Approved', 'Released'].includes(item.status) ? '' : 'disabled'}><input class="form-control form-control-sm mt-1 record-release" data-reference="${escapeHtml(item.reference)}" type="date" value="${item.releaseDate || ''}" aria-label="Release date" ${canApprove && ['Approved', 'Released'].includes(item.status) ? '' : 'disabled'}>${actionButtons(item.type || 'beneficiary', item.reference, item.archivedAt)}</td></tr>`;
        }).join('') || '<tr><td colspan="5" class="empty-state">No applications found.</td></tr>';
        const livelihoodRows = document.querySelector('#livelihoodRows');
        if (livelihoodRows) livelihoodRows.innerHTML = livelihoods.filter((item) => !item.archivedAt && `${item['Applicant / owner name']} ${item['Business / project name']} ${item.reference}`.toLowerCase().includes(livelihoodQuery)).map((item) => {
            const participantAttendance = attendance.filter((record) => record.participantReference === item.reference || record.participantName?.toLowerCase() === item['Applicant / owner name']?.toLowerCase());
            const attended = participantAttendance.filter((record) => record.status === 'Attended').length;
            const history = participantAttendance.slice(-3).map((record) => `${record.activity} (${formatDate(record.date)})`).join(', ') || 'No activities yet';
            const approved = ['Approved', 'Released'].includes(item.status);
            return `<tr><td><strong>${escapeHtml(item['Applicant / owner name'])}</strong><small>${escapeHtml(item.reference)}</small></td><td>${escapeHtml(item['Business / project name'])}<small>${attended} attended: ${escapeHtml(history)}</small></td><td>${escapeHtml(item['Support requested'])}</td><td><span class="status ${statusClass(item.status)}">${escapeHtml(item.status)}</span><select class="form-select form-select-sm record-status mt-1" data-reference="${escapeHtml(item.reference)}" ${canApprove ? '' : 'disabled'}><option ${item.status === 'Pending' ? 'selected' : ''}>Pending</option><option value="Approved" ${item.status === 'Approved' ? 'selected' : ''}>Approved / qualified</option><option value="Rejected" ${item.status === 'Rejected' ? 'selected' : ''}>Not qualified</option><option value="Released" ${item.status === 'Released' ? 'selected' : ''} disabled>Released</option></select><input class="form-control form-control-sm mt-1 review-note" data-reference="${escapeHtml(item.reference)}" maxlength="1000" placeholder="Review note" value="${escapeHtml(item['Review note'] || '')}" ${canReview ? '' : 'disabled'}><label class="form-text mt-1">For in-kind support, enter 0. Add the date last to confirm release.</label><input class="form-control form-control-sm mt-1 record-release-amount" data-reference="${escapeHtml(item.reference)}" type="number" min="0" step="0.01" value="${item.releaseAmount ?? ''}" placeholder="Release amount (0 for in-kind)" aria-label="Livelihood release amount" ${canApprove && approved ? '' : 'disabled'}><input class="form-control form-control-sm mt-1 record-release" data-reference="${escapeHtml(item.reference)}" type="date" value="${item.releaseDate || ''}" aria-label="Livelihood release date" ${canApprove && approved ? '' : 'disabled'}></td><td><small>${formatDateTime(item.submittedAt)}</small>${actionButtons('livelihood', item.reference, item.archivedAt)}</td></tr>`;
        }).join('') || '<tr><td colspan="5" class="empty-state">No livelihood participants found.</td></tr>';
        const attendanceRows = document.querySelector('#attendanceRows');
        if (attendanceRows) attendanceRows.innerHTML = attendance.filter((item) => (document.querySelector('#showArchived')?.checked || !item.archivedAt) && `${item.beneficiaryName || item.participantName} ${item.activity} ${item.date}`.toLowerCase().includes(attendanceQuery)).map((item) => `<tr><td>${escapeHtml(item.beneficiaryName || item.participantName)}</td><td>${escapeHtml(item.activity)}<small>${escapeHtml(item.participantType || 'Beneficiary')}</small></td><td>${formatDate(item.date)}</td><td><span class="status ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td><td>${actionButtons('attendance', item.reference, item.archivedAt)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">No attendance records yet.</td></tr>';
        const trainingRows = document.querySelector('#trainingRows');
        if (trainingRows) trainingRows.innerHTML = trainings.filter((item) => document.querySelector('#showArchived')?.checked || !item.archivedAt).map((item) => `<tr><td><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.program || 'Livelihood program')}</small></td><td>${formatDate(item.date)}</td><td>${escapeHtml(item.location || 'Barangay Hall')}</td><td>${escapeHtml(item.facilitator || 'Barangay staff')}</td><td>${actionButtons('training', item.reference, item.archivedAt)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">No training records yet.</td></tr>';
        document.querySelectorAll('[data-stat="attendance"]').forEach((element) => { element.textContent = reportAttendance.filter((item) => item.status === 'Attended').length; });
        document.querySelectorAll('[data-stat="released"]').forEach((element) => { element.textContent = reportBeneficiaries.filter((item) => item.status === 'Released').length; });
        renderApplicantOverview();
    };
    const bindForms = () => {
        document.querySelectorAll('[data-record-form]').forEach((form) => form.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!form.checkValidity()) { form.classList.add('was-validated'); form.reportValidity(); return; }
            const key = form.dataset.recordForm;
            const type = key === 'barangayTrainings' ? 'training' : 'attendance';
            const data = Object.fromEntries(new FormData(form).entries());
            window.barangayApiRequest('records', { method: 'POST', body: JSON.stringify({ type, data }) }).then(async () => {
                const notice = form.querySelector('.form-success');
                if (notice) { notice.textContent = 'Record saved successfully.'; notice.classList.remove('d-none'); }
                form.reset(); await loadRecords(); renderDashboard(); renderRecords();
            }).catch((error) => { const notice = form.querySelector('.form-success'); if (notice) { notice.textContent = error.message; notice.classList.remove('d-none'); notice.classList.add('alert-danger'); } });
        }));
        document.addEventListener('change', async (event) => {
            if (!event.target.matches('.record-status, .record-release, .record-release-amount, .requirement-verified, .review-note')) return;
            const record = [...read('barangayBeneficiaries'), ...read('barangayLivelihoods')].find((item) => item.reference === event.target.dataset.reference);
            if (!record) return;
            let refreshRecords = false;
            if (event.target.matches('.record-status')) {
                const nextStatus = event.target.value;
                if (nextStatus === 'Rejected' && !String(record['Review note'] || '').trim()) {
                    window.alert('Add a review note before rejecting this application.');
                    event.target.value = record.status;
                    event.target.closest('tr')?.querySelector('.review-note')?.focus();
                    return;
                }
                try {
                    await window.barangayApiRequest(`records/${record.id}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) });
                    record.status = nextStatus;
                    refreshRecords = true;
                } catch (error) { window.alert(error.message); }
            } else if (event.target.matches('.record-release')) {
                record.releaseDate = event.target.value;
                if (event.target.value && record.status === 'Approved') { record.status = 'Released'; appendHistory(record, 'Assistance released', 'Released'); }
                if (!event.target.value && record.status === 'Released') { record.status = 'Approved'; appendHistory(record, 'Release date removed', 'Approved'); }
                try { await window.barangayApiRequest(`records/${record.id}`, { method: 'PATCH', body: JSON.stringify({ status: record.status, data: { 'Release date': record.releaseDate || null, 'Release amount': record.releaseAmount === '' ? null : record.releaseAmount } }) }); }
                catch (error) { window.alert(error.message); }
                refreshRecords = true;
            } else if (event.target.matches('.record-release-amount')) {
                record.releaseAmount = event.target.value;
                try { await window.barangayApiRequest(`records/${record.id}`, { method: 'PATCH', body: JSON.stringify({ data: { 'Release amount': record.releaseAmount } }) }); }
                catch (error) { window.alert(error.message); }
            } else if (event.target.matches('.requirement-verified')) {
                const row = event.target.closest('tr');
                record.verifiedRequirements = [...(row?.querySelectorAll('.requirement-verified:checked') || [])].map((input) => input.value);
                try {
                    await window.barangayApiRequest(`records/${record.id}`, { method: 'PATCH', body: JSON.stringify({ data: { verifiedRequirements: record.verifiedRequirements } }) });
                    const qualification = getQualification(record, read('barangayAttendance'));
                    const badge = row.querySelector('.qualification');
                    badge.textContent = qualification.eligible ? 'Ready for approval' : record.status === 'Rejected' ? 'Not qualified' : 'Needs action';
                    badge.classList.toggle('is-eligible', qualification.eligible);
                    row.querySelector('.review-reason').textContent = qualification.eligible ? 'Documents verified and required activity attended' : [qualification.missing.length ? `Documents: ${qualification.missing.join(', ')}` : '', !qualification.activityAttended ? `Activity attendance: ${qualification.required}` : ''].filter(Boolean).join(' | ');
                    const approveOption = row.querySelector('.record-status option[value="Approved"]');
                    if (approveOption) approveOption.disabled = !qualification.eligible && record.status !== 'Approved';
                    renderApplicantOverview();
                } catch (error) { event.target.checked = !event.target.checked; window.alert(error.message); }
            } else {
                record['Review note'] = event.target.value.trim();
                try { await window.barangayApiRequest(`records/${record.id}`, { method: 'PATCH', body: JSON.stringify({ data: { 'Review note': record['Review note'] } }) }); }
                catch (error) { window.alert(error.message); }
            }
            if (refreshRecords) { await loadRecords(); renderDashboard(); renderRecords(); }
        });
        document.addEventListener('click', async (event) => {
            const action = event.target.closest('.record-action')?.dataset;
            if (!action) return;
            const key = ['student', 'beneficiary'].includes(action.recordType) ? 'barangayBeneficiaries' : action.recordType === 'livelihood' ? 'barangayLivelihoods' : action.recordType === 'training' ? 'barangayTrainings' : 'barangayAttendance';
            const records = read(key);
            const record = records.find((item) => item.reference === action.reference || item.id === action.reference);
            if (!record) return;
            if (action.recordAction === 'history') {
                const button = event.target.closest('.record-action');
                button.disabled = true;
                try {
                    const response = await window.barangayApiRequest(`records/${encodeURIComponent(record.id)}/history`);
                    const history = (response.history || []).map((item) => {
                        const at = item.at ? new Date(item.at).toLocaleString('en-PH') : 'Time unavailable';
                        const transition = item.from && item.to && item.from !== item.to ? ` (${item.from} to ${item.to})` : item.to && !item.from ? ` (${item.to})` : '';
                        return `${at} - ${item.action}${transition} by ${item.user || 'Administrator'}`;
                    }).join('\n');
                    window.alert(`${response.full_name}\nReference: ${response.reference}\n\n${history || 'No history recorded.'}`);
                } catch (error) {
                    window.alert(error.message);
                } finally {
                    button.disabled = false;
                }
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
    let databaseReport = null;
    const loadDatabaseReport = async () => {
        const message = document.querySelector('#databaseReportStatus');
        if (!message) return;
        const params = new URLSearchParams();
        const from = document.querySelector('#databaseReportFrom')?.value;
        const to = document.querySelector('#databaseReportTo')?.value;
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        message.textContent = 'Loading database report...';
        try {
            databaseReport = await window.barangayApiRequest(`reports/summary?${params.toString()}`);
            Object.entries(databaseReport.totals || {}).forEach(([key, value]) => {
                document.querySelectorAll(`[data-report-total="${key}"]`).forEach((element) => { element.textContent = value; });
            });
            const followup = document.querySelector('#databaseReportFollowup');
            const overdueCount = databaseReport.totals?.pendingOverSevenDays || 0;
            if (followup) {
                followup.classList.toggle('d-none', overdueCount === 0);
                followup.replaceChildren(document.createTextNode(`${overdueCount} application${overdueCount === 1 ? '' : 's'} ha${overdueCount === 1 ? 's' : 've'} been pending for more than 7 days. `));
                if (overdueCount) {
                    const link = document.createElement('a');
                    link.href = 'tables.html#assistance';
                    link.textContent = 'Review the pending queue';
                    followup.appendChild(link);
                }
            }
            const metricValues = [databaseReport.applications?.student?.total, databaseReport.applications?.beneficiary?.total, databaseReport.applications?.livelihood?.total, databaseReport.totals?.trainings];
            document.querySelectorAll('.metric-card strong').forEach((element, index) => { element.textContent = metricValues[index] ?? 0; });
            const labels = { student: 'Educational assistance', beneficiary: 'Beneficiary assistance', livelihood: 'Livelihood' };
            const breakdown = document.querySelector('#databaseReportBreakdown');
            if (breakdown) breakdown.innerHTML = Object.entries(databaseReport.applications || {}).map(([type, counts]) => `<tr><td>${labels[type] || escapeHtml(type)}</td><td>${counts.total}</td><td>${counts.pending}</td><td>${counts.approved}</td><td>${counts.released}</td><td>${counts.rejected}</td></tr>`).join('') || '<tr><td colspan="6" class="empty-state">No applications match this date range.</td></tr>';
            const range = from || to ? ` for ${from || 'any date'} to ${to || 'today'}` : '';
            message.textContent = `Report updated from the database${range}. Last refreshed ${formatDateTime(databaseReport.generated_at)}.`;
        } catch (error) {
            message.textContent = `Could not load the database report: ${error.message}`;
        }
    };
    const exportDatabaseReport = () => {
        if (!databaseReport) return;
        const rows = [['Program', 'Applications', 'Pending', 'Approved', 'Released', 'Rejected']];
        const labels = { student: 'Educational assistance', beneficiary: 'Beneficiary assistance', livelihood: 'Livelihood' };
        Object.entries(databaseReport.applications || {}).forEach(([type, counts]) => rows.push([labels[type] || type, counts.total, counts.pending, counts.approved, counts.released, counts.rejected]));
        rows.push([], ['Summary', 'Count'], ...Object.entries(databaseReport.totals || {}));
        const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        link.download = `barangay-basic-report-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };
    let historyReportRows = [];
    let historyReportPage = 1;
    let historyReportLastPage = 1;
    const loadHistoryReport = async (page = 1) => {
        const rowsElement = document.querySelector('#historyReportRows');
        const message = document.querySelector('#historyReportMessage');
        if (!rowsElement) return;
        const params = new URLSearchParams({ page, per_page: 100 });
        const filters = { q: '#historyReportSearch', type: '#historyReportType', from: '#historyReportFrom', to: '#historyReportTo' };
        Object.entries(filters).forEach(([key, selector]) => {
            const value = document.querySelector(selector)?.value?.trim();
            if (value) params.set(key, value);
        });
        rowsElement.innerHTML = '<tr><td colspan="6" class="empty-state">Loading history...</td></tr>';
        try {
            const result = await window.barangayApiRequest(`reports/history?${params.toString()}`);
            historyReportRows = result.data || [];
            historyReportPage = result.meta?.current_page || 1;
            historyReportLastPage = result.meta?.last_page || 1;
            rowsElement.innerHTML = historyReportRows.map((item) => {
                const transition = item.from && item.to && item.from !== item.to ? `${item.from} → ${item.to}` : item.to || '';
                const action = transition ? `${item.action} (${transition})` : item.action;
                return `<tr><td>${formatDateTime(item.at)}</td><td>${escapeHtml(item.type || 'Record')}</td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.reference)}</td><td>${escapeHtml(action)}</td><td>${escapeHtml(item.user)}</td></tr>`;
            }).join('') || '<tr><td colspan="6" class="empty-state">No history actions match these filters.</td></tr>';
            if (message) message.textContent = `${result.meta?.total || 0} recorded actions · Page ${historyReportPage} of ${historyReportLastPage}.`;
            document.querySelector('#historyReportPrevious').disabled = historyReportPage <= 1;
            document.querySelector('#historyReportNext').disabled = historyReportPage >= historyReportLastPage;
        } catch (error) {
            historyReportRows = [];
            rowsElement.innerHTML = `<tr><td colspan="6" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
            if (message) message.textContent = 'Could not load history report.';
        }
    };
    const exportHistoryReport = async () => {
        const button = document.querySelector('#exportHistoryReport');
        const params = new URLSearchParams({ per_page: 100 });
        const filters = { q: '#historyReportSearch', type: '#historyReportType', from: '#historyReportFrom', to: '#historyReportTo' };
        Object.entries(filters).forEach(([key, selector]) => {
            const value = document.querySelector(selector)?.value?.trim();
            if (value) params.set(key, value);
        });
        if (button) button.disabled = true;
        let rows = [];
        try {
            let page = 1;
            let lastPage = 1;
            do {
                params.set('page', page);
                const result = await window.barangayApiRequest(`reports/history?${params.toString()}`);
                rows = rows.concat(result.data || []);
                lastPage = result.meta?.last_page || 1;
                page += 1;
            } while (page <= lastPage);
        } catch (error) {
            window.alert(error.message);
            if (button) button.disabled = false;
            return;
        }
        const csvRows = [['Date and time', 'Section', 'Name', 'Reference', 'Action', 'Previous status', 'New status', 'Administrator']];
        rows.forEach((item) => csvRows.push([item.at, item.type, item.name, item.reference, item.action, item.from, item.to, item.user]));
        const csv = csvRows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        link.download = `barangay-history-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        if (button) button.disabled = false;
    };
    let recordSearchSequence = 0;
    const searchRecords = async (control) => {
        const sequence = ++recordSearchSequence;
        const targets = control.id === 'assistanceSearch' ? [['student', 'barangayBeneficiaries'], ['beneficiary', 'barangayBeneficiaries']] : control.id === 'livelihoodSearch' ? [['livelihood', 'barangayLivelihoods']] : [['attendance', 'barangayAttendance']];
        for (const [type, key] of targets) {
            const result = await window.barangayFetchAllRecords(type, { q: control.value.trim() });
            if (sequence !== recordSearchSequence) return;
            const rows = (result.data || []).map((item) => ({ ...item.data, id: item.id, type: item.type, reference: item.reference, status: item.status, submittedAt: item.submitted_at, full_name: item.full_name }));
            if (type === 'student' && targets.length > 1) recordsByKey[key].splice(0, recordsByKey[key].length, ...rows);
            else if (type === 'beneficiary' && targets.length > 1) recordsByKey[key].push(...rows);
            else recordsByKey[key].splice(0, recordsByKey[key].length, ...rows);
        }
        renderDashboard(); renderRecords();
    };
    document.addEventListener('DOMContentLoaded', async () => {
        updateDashboardGreeting(); window.setInterval(updateDashboardGreeting, 60000); setupRecordControls(); bindForms();
        let searchTimer;
        document.querySelectorAll('#assistanceSearch, #assistanceStatusFilter, #showArchived, #livelihoodSearch, #attendanceSearch, #reportFrom, #reportTo, #overallApplicantSearch, #overallApplicantType, #overallQualificationFilter').forEach((control) => {
            const update = () => {
            if (['assistanceSearch', 'livelihoodSearch', 'attendanceSearch'].includes(control.id)) {
                window.clearTimeout(searchTimer);
                searchTimer = window.setTimeout(() => searchRecords(control).catch((error) => window.alert(error.message)), 250);
            } else { renderDashboard(); renderRecords(); }
            };
            control.addEventListener('input', update);
            control.addEventListener('change', update);
        });
        document.querySelector('#exportReport')?.addEventListener('click', exportReport);
        let historySearchTimer;
        document.querySelector('#historyReportSearch')?.addEventListener('input', () => {
            window.clearTimeout(historySearchTimer);
            historySearchTimer = window.setTimeout(() => loadHistoryReport(1), 300);
        });
        ['#historyReportType', '#historyReportFrom', '#historyReportTo', '#searchHistoryReport'].forEach((selector) => {
            document.querySelector(selector)?.addEventListener('change', () => loadHistoryReport(1));
            document.querySelector(selector)?.addEventListener('click', () => loadHistoryReport(1));
        });
        document.querySelector('#historyReportPrevious')?.addEventListener('click', () => loadHistoryReport(historyReportPage - 1));
        document.querySelector('#historyReportNext')?.addEventListener('click', () => loadHistoryReport(historyReportPage + 1));
        document.querySelector('#exportHistoryReport')?.addEventListener('click', exportHistoryReport);
        document.querySelector('#printDatabaseReport')?.addEventListener('click', () => window.print());
        document.querySelector('#exportDatabaseReport')?.addEventListener('click', exportDatabaseReport);
        document.addEventListener('barangay:role-loaded', renderRecords);
        document.querySelector('#refreshDatabaseReport')?.addEventListener('click', loadDatabaseReport);
        ['#databaseReportFrom', '#databaseReportTo'].forEach((selector) => document.querySelector(selector)?.addEventListener('change', loadDatabaseReport));
        try { await loadQualificationRules(); } catch (error) {}
        try { await loadRecords(); } catch (error) { document.querySelectorAll('.empty-state').forEach((item) => { item.textContent = error.message; }); }
        renderDashboard(); renderRecords();
        loadHistoryReport();
        loadDatabaseReport();
        if (document.querySelector('#databaseReportStatus')) window.setInterval(loadDatabaseReport, 60000);
    });
})();

(() => {
    ['barangayBeneficiaries', 'barangayLivelihoods', 'barangayAttendance', 'barangayTrainings'].forEach((key) => localStorage.removeItem(key));
    const normalizeEmail = (value) => (value || '').trim().toLowerCase();
    const apiRequest = async (path, options = {}) => {
        const headers = { Accept: 'application/json', ...(options.headers || {}) };
        if (options.method && options.method !== 'GET') {
            const tokenResponse = await fetch('auth/token', { credentials: 'same-origin' });
            const token = await tokenResponse.json();
            headers['X-CSRF-TOKEN'] = token.token;
            headers['Content-Type'] = 'application/json';
        }
        const response = await fetch(path, { credentials: 'same-origin', ...options, headers });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || 'The request could not be completed.');
        return body;
    };
    window.barangayApiRequest = apiRequest;
    const fetchAllRecords = async (type, values = {}) => {
        const params = new URLSearchParams({ ...values, type, per_page: 100, page: 1 });
        const result = await apiRequest(`records?${params.toString()}`);
        const records = [...(result.data || [])];
        for (let page = 2; page <= (result.meta?.last_page || 1); page += 1) {
            params.set('page', page);
            const nextPage = await apiRequest(`records?${params.toString()}`);
            records.push(...(nextPage.data || []));
        }
        return { ...result, data: records };
    };
    window.barangayFetchAllRecords = fetchAllRecords;

    const signOut = () => {
        apiRequest('auth/logout', { method: 'POST', body: '{}' }).finally(() => { window.location.href = 'login.html'; });
    };

    const settingsKey = 'barangayAdminSettings';
    const defaultSettings = { avatar: '' };

    const showAlert = (element, message, type = 'danger') => {
        if (!element) return;
        element.textContent = message;
        element.className = `alert alert-${type} mt-3 mb-0`;
        element.classList.remove('d-none');
    };

    const readSettings = () => {
        try {
            const saved = JSON.parse(localStorage.getItem(settingsKey) || '{}');
            const settings = { avatar: typeof saved.avatar === 'string' ? saved.avatar : defaultSettings.avatar };
            localStorage.setItem(settingsKey, JSON.stringify(settings));
            return settings;
        } catch (error) {
            return { ...defaultSettings };
        }
    };

    const updateVisibleAdminName = (name) => {
        document.querySelectorAll('.dropdown-item-text').forEach((element) => { element.textContent = name; });
        document.querySelectorAll('.sb-sidenav-footer').forEach((element) => {
            const label = element.querySelector('.small');
            if (label) element.replaceChildren(label.cloneNode(true), document.createTextNode(name));
        });
    };

    const updateVisibleAdminAvatar = (avatar) => {
        document.querySelectorAll('[data-admin-avatar]').forEach((element) => {
            element.innerHTML = avatar ? `<img src="${avatar}" alt="Administrator profile">` : '<i class="fas fa-user"></i>';
            element.classList.toggle('has-image', Boolean(avatar));
        });
    };

    const installSystemSidebar = (adminName = 'Barangay Administrator') => {
        const host = document.querySelector('#layoutSidenav_nav');
        if (!host) return;
        const anchor = (selector, id) => {
            const target = document.querySelector(selector);
            if (target) target.id = id;
        };
        const anchorFromElement = (target, id) => { if (target) target.id = id; };
        const insertAnchorBefore = (target, id) => {
            if (!target || document.getElementById(id)) return;
            const marker = document.createElement('span');
            marker.id = id;
            marker.className = 'sidebar-anchor-target';
            target.insertAdjacentElement('beforebegin', marker);
        };
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        if (currentPage === 'index.html') anchor('.program-workspace-grid', 'activePrograms');
        if (currentPage === 'tables.html') {
            anchor('#applicant-flow h2', 'beneficiary-directory');
            anchor('#assistance .record-filters', 'qualification-verification');
            insertAnchorBefore(document.querySelector('#assistanceStatusFilter'), 'pending-assistance');
            anchor('#assistance table thead th:nth-child(5)', 'approval-workflow');
            anchor('#assistance table thead th:nth-child(3)', 'release-recording');
            const reportHeadings = document.querySelectorAll('#reports .panel-heading h2');
            if (reportHeadings[1]) reportHeadings[1].id = 'assistance-history';
            insertAnchorBefore(document.querySelector('#historyReportMessage'), 'history-report');
            anchor('#livelihood h2', 'participation-history');
            const trainingPanel = document.querySelector('form[data-record-form="barangayTrainings"]')?.closest('.content-panel');
            anchorFromElement(trainingPanel?.querySelector('h2'), 'training-schedule');
            const attendancePanel = document.querySelector('#attendanceRows')?.closest('.content-panel');
            anchorFromElement(attendancePanel?.querySelector('h2'), 'attendance-logs');
            if (window.location.hash === '#pending-assistance') {
                const statusFilter = document.querySelector('#assistanceStatusFilter');
                if (statusFilter) { statusFilter.value = 'Pending'; statusFilter.dispatchEvent(new Event('change', { bubbles: true })); }
            }
        }
        const setTablesInterface = () => {
            if (currentPage !== 'tables.html') return;
            const container = document.querySelector('#layoutSidenav_content main .container-fluid');
            if (!container) return;
            const hash = window.location.hash.slice(1) || 'assistance';
            const sectionMap = {
                'applicant-flow': '#applicant-flow',
                'beneficiary-directory': '#applicant-flow',
                'assistance': '#assistance',
                'qualification-verification': '#assistance',
                'pending-assistance': '#assistance',
                'approval-workflow': '#assistance',
                'release-recording': '#assistance',
                'assistance-history': '#reports',
                'history-report': '#reports',
                'livelihood': '#livelihood',
                'training-schedule': '#livelihood',
                'attendance-recording': '#livelihood',
                'attendance-logs': '#livelihood',
                'participation-history': '#livelihood',
                'reports': '#reports'
            };
            const selected = sectionMap[hash];
            const sections = [...container.querySelectorAll(':scope > section.record-section')];
            sections.forEach((section) => { section.hidden = Boolean(selected) && `#${section.id}` !== selected; });
            const heading = container.querySelector(':scope > .page-heading');
            const tabs = container.querySelector(':scope > .record-tabs');
            if (heading) heading.hidden = Boolean(selected);
            if (tabs) tabs.hidden = Boolean(selected);

            const applicantFlow = document.querySelector('#applicant-flow');
            if (applicantFlow) {
                const title = applicantFlow.querySelector('.panel-heading h2');
                const intro = applicantFlow.querySelector('.panel-heading p.text-muted');
                const filterRow = applicantFlow.querySelector('.row.g-2.my-3');
                const table = applicantFlow.querySelector('.table-responsive');
                const workflow = applicantFlow.querySelector('.workflow-steps');
                const registrationLinks = applicantFlow.querySelector('.d-flex.flex-wrap.gap-2.mb-3');
                const guidance = table?.nextElementSibling;
                const searchColumn = filterRow?.querySelector('#overallApplicantSearch')?.closest('[class*="col-"]');
                if (title) title.textContent = hash === 'beneficiary-directory' ? 'Beneficiary directory' : 'Applicant qualification and eligibility overview';
                if (intro) intro.textContent = hash === 'beneficiary-directory' ? 'Registered beneficiary profiles and their current application status.' : 'One list for students, other beneficiaries, and livelihood applicants.';
                if (filterRow) filterRow.querySelectorAll(':scope > [class*="col-"]').forEach((column) => { column.hidden = false; });
                if (searchColumn) { searchColumn.classList.remove('col-12'); searchColumn.classList.add('col-md-4'); }
                [workflow, registrationLinks, guidance].forEach((element) => { if (element) element.hidden = hash === 'beneficiary-directory'; });
                if (hash === 'beneficiary-directory') {
                    if (searchColumn) { searchColumn.hidden = false; searchColumn.classList.remove('col-md-4'); searchColumn.classList.add('col-12'); }
                    filterRow?.querySelectorAll(':scope > [class*="col-"]').forEach((column) => { if (column !== searchColumn) column.hidden = true; });
                }
                const typeFilter = document.querySelector('#overallApplicantType');
                if (typeFilter && typeFilter.value !== (hash === 'beneficiary-directory' ? 'beneficiary' : '')) {
                    typeFilter.value = hash === 'beneficiary-directory' ? 'beneficiary' : '';
                    typeFilter.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (table) table.hidden = false;
            }

            const livelihood = document.querySelector('#livelihood');
            if (livelihood && selected === '#livelihood') {
                const rows = livelihood.querySelectorAll(':scope > .row');
                const participantColumn = rows[0]?.children[0];
                const trainingColumn = rows[0]?.children[1];
                const attendanceLogColumn = rows[1]?.children[0];
                const attendanceFormColumn = rows[1]?.children[1];
                const columns = [participantColumn, trainingColumn, attendanceLogColumn, attendanceFormColumn];
                columns.forEach((element, index) => {
                    if (!element) return;
                    element.hidden = false;
                    element.classList.remove('col-12');
                    element.classList.add(index % 2 === 0 ? 'col-xl-7' : 'col-xl-5');
                });
                if (hash === 'training-schedule') {
                    if (participantColumn) participantColumn.hidden = true;
                    if (attendanceLogColumn) attendanceLogColumn.hidden = true;
                    if (attendanceFormColumn) attendanceFormColumn.hidden = true;
                    if (trainingColumn) trainingColumn.classList.replace('col-xl-5', 'col-12');
                } else if (hash === 'participation-history' || hash === 'livelihood') {
                    if (trainingColumn) trainingColumn.hidden = true;
                    if (attendanceLogColumn) attendanceLogColumn.hidden = true;
                    if (attendanceFormColumn) attendanceFormColumn.hidden = true;
                    if (participantColumn) participantColumn.classList.replace('col-xl-7', 'col-12');
                } else if (hash === 'attendance-recording') {
                    if (participantColumn) participantColumn.hidden = true;
                    if (trainingColumn) trainingColumn.hidden = true;
                    if (attendanceLogColumn) attendanceLogColumn.hidden = true;
                    if (attendanceFormColumn) attendanceFormColumn.classList.replace('col-xl-5', 'col-12');
                } else if (hash === 'attendance-logs') {
                    if (participantColumn) participantColumn.hidden = true;
                    if (trainingColumn) trainingColumn.hidden = true;
                    if (attendanceFormColumn) attendanceFormColumn.hidden = true;
                    if (attendanceLogColumn) attendanceLogColumn.classList.replace('col-xl-7', 'col-12');
                }
            }
            if (hash === 'history-report' || hash === 'assistance-history') {
                const reports = document.querySelector('#reports');
                const summaryHeading = reports?.querySelector('.panel-heading');
                const summaryGrid = reports?.querySelector('.report-grid');
                const divider = summaryGrid?.nextElementSibling;
                [summaryHeading, summaryGrid, divider].forEach((element) => { if (element) element.hidden = true; });
            } else {
                const reports = document.querySelector('#reports');
                if (reports) reports.querySelectorAll(':scope > [hidden]').forEach((element) => { element.hidden = false; });
            }
        };
        const setDashboardInterface = () => {
            if (currentPage !== 'index.html') return;
            const container = document.querySelector('#layoutSidenav_content main .container-fluid');
            if (!container) return;
            const hash = window.location.hash;
            const view = hash === '#activePrograms' ? container.querySelector('.program-workspace-grid')
                : hash === '#dashboardReports' ? document.querySelector('#dashboardReports') : null;
            [...container.children].forEach((element) => { element.hidden = Boolean(view) && element !== view; });
        };
        setTablesInterface();
        setDashboardInterface();
        const groups = [
            { title: 'Beneficiary management', icon: 'fa-hand-holding-heart', links: [
                ['Beneficiary management', 'other-beneficiary-interface.html', 'fa-users'],
            ] },
            { title: 'Educational assistance', icon: 'fa-graduation-cap', links: [
                ['Educational assistance', 'student-beneficiary-interface.html', 'fa-user-graduate'],
            ] },
            { title: 'Livelihood', icon: 'fa-briefcase', links: [
                ['Livelihood', 'livelihood-interface.html', 'fa-store'],
            ] },
            { title: 'Reports', icon: 'fa-chart-column', links: [
                ['Reports', 'tables.html#reports', 'fa-chart-pie'],
            ] },
        ];
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        const makeLink = ([label, href, icon]) => {
            const link = document.createElement('a');
            link.className = 'nav-link';
            link.href = href;
            link.dataset.sidebarTarget = href;
            link.addEventListener('click', (event) => {
                const target = new URL(link.href, window.location.href);
                if (target.pathname.split('/').pop() !== currentPage || !target.hash || !['tables.html', 'index.html'].includes(currentPage)) return;
                event.preventDefault();
                if (window.location.hash !== target.hash) window.history.pushState(null, '', target.hash);
                setTablesInterface();
                setDashboardInterface();
                updateActive();
                window.scrollTo(0, 0);
            });
            const iconWrap = document.createElement('span');
            iconWrap.className = 'sb-nav-link-icon';
            const glyph = document.createElement('i');
            glyph.className = `fas ${icon}`;
            iconWrap.appendChild(glyph);
            const text = document.createElement('span');
            text.className = 'sidebar-link-text';
            text.textContent = label;
            link.append(iconWrap, text);
            return link;
        };
        const nav = document.createElement('nav');
        nav.className = 'sb-sidenav accordion sb-sidenav-dark';
        nav.id = 'sidenavAccordion';
        const menu = document.createElement('div');
        menu.className = 'sb-sidenav-menu';
        const list = document.createElement('div');
        list.className = 'nav system-sidebar';
        groups.forEach((group) => {
            if (group.links.length === 1) {
                list.appendChild(makeLink(group.links[0]));
                return;
            }
            const section = document.createElement('section');
            section.className = 'system-sidebar-group';
            const heading = document.createElement('div');
            heading.className = 'sb-sidenav-menu-heading system-sidebar-heading';
            const glyph = document.createElement('i');
            glyph.className = `fas ${group.icon}`;
            const label = document.createElement('span');
            label.textContent = group.title;
            heading.append(glyph, label);
            section.appendChild(heading);
            group.links.forEach((item) => section.appendChild(makeLink(item)));
            list.appendChild(section);
        });
        menu.appendChild(list);
        const footer = document.createElement('div');
        footer.className = 'sb-sidenav-footer';
        const small = document.createElement('div');
        small.className = 'small';
        small.textContent = 'Logged in as:';
        footer.append(small, document.createTextNode(adminName));
        nav.append(menu, footer);
        host.replaceChildren(nav);

        const updateActive = () => {
            setTablesInterface();
            setDashboardInterface();
            const hash = window.location.hash;
            const links = [...host.querySelectorAll('[data-sidebar-target]')];
            let exact = links.find((link) => {
                const target = new URL(link.href, window.location.href);
                return target.pathname.split('/').pop() === currentPath && target.hash === hash && hash;
            });
            if (!exact && !hash) exact = links.find((link) => new URL(link.href, window.location.href).pathname.split('/').pop() === currentPath);
            links.forEach((link) => link.classList.toggle('active', link === exact));
        };
        updateActive();
        window.addEventListener('hashchange', updateActive);
    };

    const addNotifications = () => {
        const nav = document.querySelector('.sb-topnav .navbar-nav.ms-auto');
        if (!nav || nav.querySelector('[data-notifications]')) return;
        const item = document.createElement('li');
        item.className = 'nav-item notification-menu';
        item.dataset.notifications = 'true';
        item.innerHTML = '<button class="nav-link notification-toggle" type="button" aria-label="Notifications" aria-expanded="false"><i class="fas fa-bell"></i><span class="notification-badge d-none">0</span></button><section class="notification-panel" aria-label="Notifications"><header><strong>Notifications</strong><button class="btn btn-sm btn-link" type="button" data-mark-read>Mark all read</button></header><div class="notification-list"><p class="notification-empty">Loading notifications...</p></div></section>';
        nav.insertBefore(item, nav.firstElementChild);
        const toggle = item.querySelector('.notification-toggle');
        const panel = item.querySelector('.notification-panel');
        const list = item.querySelector('.notification-list');
        const badge = item.querySelector('.notification-badge');
        const render = async () => {
            try {
                const result = await apiRequest('notifications');
                badge.textContent = result.unread_count > 99 ? '99+' : String(result.unread_count || 0);
                badge.classList.toggle('d-none', !result.unread_count);
                list.replaceChildren();
                if (!result.notifications?.length) {
                    const empty = document.createElement('p'); empty.className = 'notification-empty'; empty.textContent = 'No recent activity.'; list.appendChild(empty); return;
                }
                result.notifications.forEach((notification) => {
                    const link = document.createElement('a');
                    link.className = `notification-item${notification.unread ? ' is-unread' : ''}`;
                    link.href = ['student', 'beneficiary', 'livelihood'].includes(notification.type) ? 'tables.html#assistance' : 'tables.html#livelihood';
                    const title = document.createElement('strong'); title.textContent = notification.title;
                    const name = document.createElement('span'); name.textContent = notification.name;
                    const detail = document.createElement('small'); detail.textContent = `${notification.detail} | ${notification.at ? new Date(notification.at).toLocaleString() : ''}`;
                    link.append(title, name, detail);
                    link.addEventListener('click', () => panel.classList.remove('is-open'));
                    list.appendChild(link);
                });
            } catch (error) {
                list.replaceChildren(); const failed = document.createElement('p'); failed.className = 'notification-empty'; failed.textContent = 'Notifications could not be loaded.'; list.appendChild(failed);
            }
        };
        toggle.addEventListener('click', async () => {
            const open = panel.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', String(open));
            if (open) {
                try { await apiRequest('notifications/read', { method: 'POST', body: '{}' }); } catch (error) {}
                await render();
            }
        });
        item.querySelector('[data-mark-read]').addEventListener('click', async () => {
            try { await apiRequest('notifications/read', { method: 'POST', body: '{}' }); await render(); } catch (error) {}
        });
        document.addEventListener('click', (event) => {
            if (!item.contains(event.target)) { panel.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); }
        });
        render();
        window.setInterval(render, 30000);
    };

    const bindSettings = () => {
        const nameInput = document.querySelector('#adminName');
        const emailInput = document.querySelector('#adminEmail');
        const avatarInput = document.querySelector('#adminAvatar');
        const removeAvatarButton = document.querySelector('#removeAdminAvatar');
        const saveButton = [...document.querySelectorAll('button')].find((button) => button.textContent.includes('Save profile'));
        if (!nameInput || !emailInput || !saveButton) return;

        const settings = readSettings();
        updateVisibleAdminAvatar(settings.avatar);

        avatarInput?.addEventListener('change', () => {
            const file = avatarInput.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.addEventListener('load', () => updateVisibleAdminAvatar(reader.result));
            reader.readAsDataURL(file);
        });
        removeAvatarButton?.addEventListener('click', () => {
            updateVisibleAdminAvatar('');
            if (avatarInput) avatarInput.value = '';
        });

        saveButton.addEventListener('click', async () => {
            nameInput.value = nameInput.value.trim();
            emailInput.value = emailInput.value.trim().toLowerCase();
            if (!nameInput.value || !emailInput.checkValidity()) {
                nameInput.classList.toggle('is-invalid', !nameInput.value);
                emailInput.classList.toggle('is-invalid', !emailInput.checkValidity());
                return;
            }

            const updatedSettings = { name: nameInput.value, email: emailInput.value, avatar: document.querySelector('[data-admin-avatar]')?.querySelector('img')?.src || '' };
            try {
                await apiRequest('auth/profile', { method: 'PATCH', body: JSON.stringify({ name: updatedSettings.name, email: updatedSettings.email }) });
            } catch (error) {
                window.alert(error.message);
                return;
            }
            localStorage.setItem(settingsKey, JSON.stringify(updatedSettings));

            updateVisibleAdminName(updatedSettings.name);
            updateVisibleAdminAvatar(updatedSettings.avatar);
            nameInput.classList.remove('is-invalid');
            emailInput.classList.remove('is-invalid');
            let notice = document.querySelector('#settingsSaved');
            if (!notice) {
                notice = document.createElement('div');
                notice.id = 'settingsSaved';
                notice.className = 'alert alert-success mt-3 mb-0';
                notice.setAttribute('role', 'status');
                saveButton.insertAdjacentElement('afterend', notice);
            }
            notice.textContent = 'Settings saved successfully.';
            notice.classList.remove('d-none');
        });

        const passwordForm = document.querySelector('#passwordChangeForm');
        passwordForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const currentPassword = document.querySelector('#currentPassword');
            const newPassword = document.querySelector('#newPassword');
            const confirmPassword = document.querySelector('#confirmPassword');
            if (!passwordForm.checkValidity() || newPassword.value.length < 12 || newPassword.value !== confirmPassword.value) {
                passwordForm.classList.add('was-validated');
                const notice = document.querySelector('#passwordMessage');
                if (notice) { notice.textContent = newPassword.value !== confirmPassword.value ? 'New passwords do not match.' : 'Use a password with at least 12 characters.'; notice.className = 'alert alert-danger mt-3 mb-0'; }
                return;
            }
            const notice = document.querySelector('#passwordMessage');
            try {
                await apiRequest('auth/password', { method: 'POST', body: JSON.stringify({ current_password: currentPassword.value, password: newPassword.value, password_confirmation: confirmPassword.value }) });
                passwordForm.reset();
                passwordForm.classList.remove('was-validated');
                if (notice) { notice.textContent = 'Password updated successfully.'; notice.className = 'alert alert-success mt-3 mb-0'; }
            } catch (error) {
                if (notice) { notice.textContent = error.message; notice.className = 'alert alert-danger mt-3 mb-0'; }
            }
        });
    };

    const bindQualificationRuleSettings = async () => {
        const container = document.querySelector('#qualificationRulesList');
        const message = document.querySelector('#qualificationRulesMessage');
        if (!container) return;
        try {
            const result = await apiRequest('qualification-rules');
            container.replaceChildren();
            (result.data || []).forEach((rule) => {
                const form = document.createElement('form');
                form.className = 'qualification-rule-item';
                const heading = document.createElement('h3');
                heading.className = 'h5';
                heading.textContent = rule.program;
                const documentsLabel = document.createElement('label');
                documentsLabel.className = 'form-label';
                documentsLabel.textContent = 'Required documents (one per line)';
                const documents = document.createElement('textarea');
                documents.className = 'form-control';
                documents.rows = 3;
                documents.required = true;
                documents.value = (rule.required_documents || []).join('\n');
                documentsLabel.appendChild(documents);
                const activityLabel = document.createElement('label');
                activityLabel.className = 'form-label mt-3';
                activityLabel.textContent = 'Required activity (leave blank if none)';
                const activity = document.createElement('input');
                activity.className = 'form-control';
                activity.type = 'text';
                activity.maxLength = 150;
                activity.value = rule.required_activity || '';
                activityLabel.appendChild(activity);
                const save = document.createElement('button');
                save.className = 'btn btn-outline-primary btn-sm mt-3';
                save.type = 'submit';
                save.textContent = 'Save rule';
                form.append(heading, documentsLabel, activityLabel, save);
                form.addEventListener('submit', async (event) => {
                    event.preventDefault();
                    const requiredDocuments = documents.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
                    if (!requiredDocuments.length) {
                        showAlert(message, 'Add at least one required document.', 'danger');
                        return;
                    }
                    save.disabled = true;
                    try {
                        await apiRequest(`qualification-rules/${encodeURIComponent(rule.program)}`, { method: 'PUT', body: JSON.stringify({ required_documents: requiredDocuments, required_activity: activity.value.trim() || null }) });
                        showAlert(message, `${rule.program} criteria saved. Applicant checks and future approvals will use this rule.`, 'success');
                    } catch (error) {
                        showAlert(message, error.message, 'danger');
                    } finally {
                        save.disabled = false;
                    }
                });
                container.appendChild(form);
            });
            if (!result.data?.length) showAlert(message, 'No qualification rules are configured.', 'warning');
        } catch (error) {
            showAlert(message, error.message, 'danger');
        }
    };

    window.barangayAuth = { signOut };

    document.addEventListener('DOMContentLoaded', () => {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        document.querySelectorAll('.program-interface-shell').forEach((workspace) => {
            workspace.querySelectorAll('.program-summary-item strong').forEach((count) => { count.textContent = '0'; });
            workspace.querySelectorAll('.program-list-table tbody').forEach((body) => {
                const columns = body.closest('table')?.querySelectorAll('thead th').length || 1;
                body.innerHTML = `<tr><td colspan="${columns}" class="empty-state">Loading records...</td></tr>`;
            });
            workspace.querySelectorAll('.event-list').forEach((list) => {
                list.innerHTML = '<li class="empty-state">No scheduled activities yet.</li>';
            });
        });
        document.querySelectorAll('.program-interface-shell form').forEach((form) => form.addEventListener('submit', (event) => {
            event.preventDefault();
            if (form.dataset.requireRegisteredParticipant === 'true' && (!form.dataset.participantReference || form.dataset.selectedParticipantName !== form.querySelector('input[id$="Name"]')?.value.trim())) {
                let selectionNotice = form.querySelector('.form-success');
                if (!selectionNotice) { selectionNotice = document.createElement('div'); selectionNotice.className = 'form-success alert mt-3 mb-0'; form.appendChild(selectionNotice); }
                selectionNotice.textContent = 'Search for and select a registered name before marking attendance.';
                selectionNotice.className = 'form-success alert alert-warning mt-3 mb-0';
                return;
            }
            const fields = [...form.querySelectorAll('input, select, textarea')];
            const values = Object.fromEntries(fields.map((field) => [field.id, field.value]));
            const prefix = fields[0]?.id.match(/^(student|beneficiary|livelihood)/)?.[1] || '';
            const isEvent = Boolean(form.querySelector('[id$="EventName"]'));
            const data = isEvent ? {
                title: values[`${prefix}EventName`], program: values[`${prefix}EventType`],
                date: values[`${prefix}Schedule`], location: values[`${prefix}Venue`], audience: prefix,
            } : {
                participantName: values[`${prefix}Name`], activity: values[`${prefix}Event`],
                date: values[`${prefix}Date`], status: values[`${prefix}Status`],
                notes: values[`${prefix}Notes`], participantType: prefix === 'student' ? 'Student' : prefix === 'beneficiary' ? 'Beneficiary' : 'Livelihood participant',
            };
            const type = isEvent ? 'training' : 'attendance';
            let notice = form.querySelector('.form-success');
            if (!notice) {
                notice = document.createElement('div');
                notice.className = 'form-success alert mt-3 mb-0';
                notice.setAttribute('role', 'status');
                form.appendChild(notice);
            }
            apiRequest('records', { method: 'POST', body: JSON.stringify({ type, data }) }).then(async (savedRecord) => {
                if (type === 'attendance') {
                    const displayStatus = savedRecord.status === 'Attended' ? 'Present' : savedRecord.status;
                    notice.textContent = `Attendance marked ${displayStatus} for ${data.participantName}.`;
                    const statusDisplay = form.querySelector('[data-attendance-status]');
                    if (statusDisplay) {
                        statusDisplay.textContent = `Current attendance: ${displayStatus}`;
                        statusDisplay.className = `small mt-2 fw-semibold ${displayStatus === 'Absent' ? 'text-danger' : 'text-success'}`;
                    }
                    document.dispatchEvent(new CustomEvent('barangay:attendance-updated', { detail: savedRecord }));
                } else notice.textContent = 'Record saved successfully.';
                notice.className = 'form-success alert alert-success mt-3 mb-0';
                if (type !== 'attendance') form.reset();
            }).catch((error) => {
                notice.textContent = error.message;
                notice.className = 'form-success alert alert-danger mt-3 mb-0';
            });
        }));

        const workspaceType = currentPage.includes('student-beneficiary') ? 'student' : currentPage.includes('other-beneficiary') ? 'beneficiary' : currentPage.includes('livelihood-interface') ? 'livelihood' : null;
        if (workspaceType) {
            const table = document.querySelector('.program-list-table table');
            const body = table?.querySelector('tbody');
            const header = document.querySelector('.program-table-header');
            const search = document.querySelector('#workspaceSearch');
            if (table && body && header && search) {
                let records = [];
                let attendanceRecords = [];
                const render = () => {
                    const term = search.value.trim().toLowerCase();
                    const filtered = records.filter((record) => `${record.full_name} ${record.reference} ${record.program || ''}`.toLowerCase().includes(term));
                    const matchingReferences = new Set(filtered.map((record) => record.reference));
                    const attended = attendanceRecords.filter((item) => item.status === 'Attended'
                        && matchingReferences.has(item.data.participantReference)
                        && (workspaceType !== 'student' || String(item.data.activity || '').toLowerCase().includes('orientation'))).length;
                    const approved = records.filter((record) => record.status === 'Approved').length;
                    const released = records.filter((record) => record.status === 'Released').length;
                    const summary = workspaceType === 'livelihood'
                        ? [records.length, Number(workspace.dataset.trainingCount || 0), attended, approved]
                        : [records.length, records.filter((record) => record.status === 'Pending').length, attended, workspaceType === 'beneficiary' ? released : approved];
                    workspace.querySelectorAll('.program-summary-item strong').forEach((count, index) => { count.textContent = String(summary[index] ?? 0); });
                    body.replaceChildren();
                    if (!filtered.length) {
                        const row = body.insertRow();
                        const cell = row.insertCell(); cell.colSpan = 5; cell.className = 'empty-state';
                        cell.textContent = term ? 'No matching records.' : 'No applications yet.';
                        return;
                    }
                    filtered.forEach((record) => {
                        const row = body.insertRow();
                        const nameCell = row.insertCell();
                        const personName = document.createElement('strong'); personName.textContent = record.full_name; nameCell.appendChild(personName);
                        const reference = document.createElement('small'); reference.textContent = record.reference; nameCell.appendChild(reference);
                        [record.data['School name'] || record.data['Business / project name'] || record.program || '-', record.data.activity || record.program || '-', attendanceRecords.find((item) => item.data.participantReference === record.reference)?.status || 'Not recorded'].forEach((value) => { row.insertCell().textContent = value; });
                        const statusCell = row.insertCell();
                        const status = document.createElement('select');
                        status.className = 'form-select form-select-sm';
                        status.disabled = !['administrator', 'approver'].includes(window.barangayUserRole);
                        ['Pending', 'Approved', 'Rejected'].forEach((value) => { const option = new Option(value, value, false, record.status === value); status.add(option); });
                        status.setAttribute('aria-label', `Status for ${record.full_name}`);
                        status.addEventListener('change', async () => {
                            status.disabled = true;
                            try { await apiRequest(`records/${record.id}`, { method: 'PATCH', body: JSON.stringify({ status: status.value }) }); record.status = status.value; }
                            catch (error) { window.alert(error.message); status.value = record.status; }
                            finally { status.disabled = false; }
                        });
                        statusCell.appendChild(status);
                    });
                };
                document.addEventListener('barangay:role-loaded', render);
                let searchTimer;
                let searchSequence = 0;
                const searchRecords = () => {
                    const sequence = ++searchSequence;
                    return fetchAllRecords(workspaceType, { q: search.value.trim() }).then((result) => {
                    if (sequence !== searchSequence) return;
                    records = result.data || [];
                    render();
                    }).catch((error) => { if (sequence !== searchSequence) return; body.replaceChildren(); const row = body.insertRow(); const cell = row.insertCell(); cell.colSpan = 5; cell.className = 'empty-state'; cell.textContent = error.message; });
                };
                search.addEventListener('input', () => { window.clearTimeout(searchTimer); searchTimer = window.setTimeout(searchRecords, 250); });
                searchRecords();
                fetchAllRecords('attendance').then((result) => { attendanceRecords = result.data || []; render(); }).catch(() => {});
                document.addEventListener('barangay:attendance-updated', async () => {
                    try {
                        const result = await fetchAllRecords('attendance');
                        attendanceRecords = result.data || [];
                        render();
                    } catch (error) { console.error('Could not refresh attendance records.', error); }
                });
                const attendanceForm = [...workspace.querySelectorAll('form')].find((form) => form.querySelector('input[id$="Name"]') && !form.querySelector('input[id$="EventName"]'));
                const attendanceName = attendanceForm?.querySelector('input[id$="Name"]');
                if (attendanceName) {
                    attendanceForm.dataset.requireRegisteredParticipant = 'true';
                    attendanceName.type = 'search';
                    attendanceName.placeholder = 'Search name, then select a result';
                    attendanceName.setAttribute('autocomplete', 'off');
                    const searchHost = attendanceName.parentElement;
                    searchHost.classList.add('position-relative');
                    const resultsMenu = document.createElement('div');
                    resultsMenu.className = 'list-group position-absolute w-100 shadow d-none';
                    resultsMenu.style.zIndex = '1050';
                    resultsMenu.setAttribute('role', 'listbox');
                    resultsMenu.setAttribute('aria-label', 'Registered participants');
                    attendanceName.insertAdjacentElement('afterend', resultsMenu);
                    const statusInput = attendanceForm.querySelector('select[id$="Status"]');
                    const dateInput = attendanceForm.querySelector('input[type="date"]');
                    const oldSubmit = attendanceForm.querySelector('button[type="submit"]');
                    if (dateInput && !dateInput.value) {
                        const localToday = new Date();
                        localToday.setMinutes(localToday.getMinutes() - localToday.getTimezoneOffset());
                        dateInput.value = localToday.toISOString().slice(0, 10);
                    }
                    let attendanceStatusDisplay = null;
                    if (statusInput && dateInput && oldSubmit) {
                        attendanceStatusDisplay = document.createElement('div');
                        attendanceStatusDisplay.className = 'small mt-2 text-muted';
                        attendanceStatusDisplay.setAttribute('aria-live', 'polite');
                        attendanceStatusDisplay.dataset.attendanceStatus = 'true';
                        statusInput.closest('.col-md-4')?.insertAdjacentElement('afterend', attendanceStatusDisplay);
                        const actions = document.createElement('div');
                        actions.className = 'd-flex flex-wrap justify-content-end gap-2';
                        [['Present', 'btn-success'], ['Absent', 'btn-outline-danger']].forEach(([status, style]) => {
                            const button = document.createElement('button');
                            button.type = 'button';
                            button.className = `btn ${style}`;
                            button.textContent = `Mark ${status}`;
                            button.addEventListener('click', () => {
                                if (!attendanceForm.dataset.participantReference || attendanceForm.dataset.selectedParticipantName !== attendanceName.value.trim()) { attendanceName.focus(); attendanceStatusDisplay.textContent = 'Select a registered participant from the search results first.'; attendanceStatusDisplay.className = 'small mt-2 text-warning'; return; }
                                if (!dateInput.value) { const localToday = new Date(); localToday.setMinutes(localToday.getMinutes() - localToday.getTimezoneOffset()); dateInput.value = localToday.toISOString().slice(0, 10); }
                                statusInput.value = status;
                                attendanceForm.requestSubmit();
                            });
                            actions.appendChild(button);
                        });
                        oldSubmit.parentElement.insertBefore(actions, oldSubmit);
                        oldSubmit.classList.add('d-none');
                        statusInput.closest('.col-md-4')?.classList.add('d-none');
                    }
                    let participantSearchTimer;
                    let participantSearchSequence = 0;
                    const checkParticipantAttendance = async (participant) => {
                        attendanceStatusDisplay.textContent = 'Checking attendance status…';
                        attendanceStatusDisplay.className = 'small mt-2 text-muted';
                        try {
                            const result = await fetchAllRecords('attendance', { q: participant.full_name });
                            const date = dateInput.value;
                            let activity = attendanceForm.querySelector('select[id$="Event"]')?.value || '';
                            if (workspaceType === 'student' && activity.toLowerCase().includes('orientation')) activity = 'Orientation';
                            if (activity.toLowerCase() === 'senior citizen briefing') activity = 'Community assembly';
                            const current = (result.data || []).find((item) => item.data.participantReference === participant.reference && (!date || item.data.date === date) && (!activity || item.data.activity === activity));
                            if (!current) {
                                attendanceStatusDisplay.textContent = 'No attendance recorded for this activity and date yet.';
                                attendanceStatusDisplay.className = 'small mt-2 text-muted';
                                return;
                            }
                            const label = current.status === 'Attended' ? 'Present' : current.status;
                            statusInput.value = label;
                            attendanceStatusDisplay.textContent = `Current attendance: ${label}`;
                            attendanceStatusDisplay.className = `small mt-2 fw-semibold ${label === 'Absent' ? 'text-danger' : 'text-success'}`;
                        } catch (error) {
                            attendanceStatusDisplay.textContent = error.message;
                            attendanceStatusDisplay.className = 'small mt-2 text-danger';
                        }
                    };
                    attendanceName.addEventListener('input', () => {
                        attendanceForm.dataset.participantReference = '';
                        attendanceForm.dataset.selectedParticipantName = '';
                        attendanceStatusDisplay.textContent = '';
                        const term = attendanceName.value.trim();
                        window.clearTimeout(participantSearchTimer);
                        resultsMenu.replaceChildren();
                        if (term.length < 2) { resultsMenu.classList.add('d-none'); return; }
                        participantSearchTimer = window.setTimeout(async () => {
                            const sequence = ++participantSearchSequence;
                            try {
                                const result = await fetchAllRecords(workspaceType, { q: term });
                                if (sequence !== participantSearchSequence) return;
                                const matches = (result.data || []).slice(0, 8);
                                resultsMenu.replaceChildren();
                                matches.forEach((participant) => {
                                    const option = document.createElement('button');
                                    option.type = 'button';
                                    option.className = 'list-group-item list-group-item-action';
                                    option.setAttribute('role', 'option');
                                    option.textContent = `${participant.full_name} · ${participant.reference}`;
                                    option.addEventListener('click', () => {
                                        attendanceName.value = participant.full_name;
                                        attendanceForm.dataset.participantReference = participant.reference;
                                        attendanceForm.dataset.selectedParticipantName = participant.full_name;
                                        resultsMenu.classList.add('d-none');
                                        checkParticipantAttendance(participant);
                                    });
                                    resultsMenu.appendChild(option);
                                });
                                if (!matches.length) {
                                    const empty = document.createElement('div');
                                    empty.className = 'list-group-item text-muted';
                                    empty.textContent = 'No registered participants found.';
                                    resultsMenu.appendChild(empty);
                                }
                                resultsMenu.classList.remove('d-none');
                            } catch (error) {
                                resultsMenu.replaceChildren();
                                const message = document.createElement('div');
                                message.className = 'list-group-item text-danger';
                                message.textContent = error.message;
                                resultsMenu.appendChild(message);
                                resultsMenu.classList.remove('d-none');
                            }
                        }, 200);
                    });
                    dateInput.addEventListener('change', () => {
                        const reference = attendanceForm.dataset.participantReference;
                        if (reference) checkParticipantAttendance({ reference, full_name: attendanceName.value.trim() });
                    });
                    attendanceForm.querySelector('select[id$="Event"]')?.addEventListener('change', () => {
                        const reference = attendanceForm.dataset.participantReference;
                        if (reference) checkParticipantAttendance({ reference, full_name: attendanceName.value.trim() });
                    });
                }
                const eventList = workspace.querySelector('.event-list');
                if (eventList) {
                    apiRequest(`records?type=training&audience=${workspaceType}&per_page=100`).then((result) => {
                        eventList.replaceChildren();
                        const scheduledActivities = result.data || [];
                        workspace.dataset.trainingCount = String(result.meta?.total ?? scheduledActivities.length);
                        scheduledActivities.forEach((record) => {
                            const item = document.createElement('li');
                            const title = document.createElement('strong'); title.textContent = record.data.title || 'Program activity'; item.appendChild(title);
                            const schedule = document.createElement('small'); schedule.textContent = `${record.data.date || 'Date not set'} · ${record.data.location || 'Venue not set'}`; item.appendChild(schedule);
                            const kind = document.createElement('span'); kind.className = 'event-pill'; kind.textContent = record.data.program || 'Activity'; item.appendChild(kind);
                            eventList.appendChild(item);
                        });
                        if (!eventList.children.length) { const empty = document.createElement('li'); empty.className = 'empty-state'; empty.textContent = 'No scheduled activities yet.'; eventList.appendChild(empty); }
                        render();
                    }).catch(() => {});
                }
            }
        }

        const loginForm = document.querySelector('#loginForm');
        const signupForm = document.querySelector('#signupForm');
        const publicPages = ['login.html', 'register.html', 'password.html', 'privacy-policy.html', 'terms-and-conditions.html'];
        const isProtectedPage = !publicPages.includes(currentPage);
        const isLoginPage = Boolean(loginForm);

        if (isLoginPage) {
            apiRequest('auth/setup').then((setup) => {
                if (!setup.canRegister) document.querySelector('a[href="register.html"]')?.closest('.small')?.remove();
            }).catch(() => {});
        }

        if (isLoginPage) {
            const emailInput = document.querySelector('#inputEmail');
            const passwordInput = document.querySelector('#inputPassword');
            const rememberInput = document.querySelector('#inputRememberPassword');
            const loginMessage = document.querySelector('#loginMessage');
            const submitButton = loginForm.querySelector('button[type="submit"]');

            loginForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                loginMessage.classList.add('d-none');
                emailInput.classList.remove('is-invalid');
                passwordInput.classList.remove('is-invalid');

                submitButton.disabled = true;
                try {
                    await apiRequest('auth/login', { method: 'POST', body: JSON.stringify({ email: normalizeEmail(emailInput.value), password: passwordInput.value, remember: rememberInput.checked }) });
                    window.location.href = 'index.html';
                } catch (error) {
                    showAlert(loginMessage, error.message, 'danger');
                    emailInput.classList.add('is-invalid');
                    passwordInput.classList.add('is-invalid');
                    passwordInput.focus();
                    submitButton.disabled = false;
                }
            });
        }

        if (signupForm) {
            const signupMessage = document.querySelector('#signupMessage');
            const firstNameInput = document.querySelector('#inputFirstName');
            const lastNameInput = document.querySelector('#inputLastName');
            const emailInput = document.querySelector('#inputEmail');
            const passwordInput = document.querySelector('#inputPassword');
            const confirmPasswordInput = document.querySelector('#inputPasswordConfirm');

            apiRequest('auth/setup').then((setup) => {
                if (!setup.canRegister) {
                    showAlert(signupMessage, 'Initial setup is complete. Ask the system administrator to create an account.', 'warning');
                    signupForm.querySelector('button[type="submit"]').disabled = true;
                }
            }).catch(() => {});

            signupForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const firstName = (firstNameInput.value || '').trim();
                const lastName = (lastNameInput.value || '').trim();
                const email = normalizeEmail(emailInput.value);
                const password = passwordInput.value;
                const confirmPassword = confirmPasswordInput.value;

                signupMessage?.classList.add('d-none');
                [firstNameInput, lastNameInput, emailInput, passwordInput, confirmPasswordInput].forEach((field) => field.classList.remove('is-invalid'));

                if (!firstName || !lastName || !email || !password || !confirmPassword) {
                    showAlert(signupMessage, 'Please complete all the required fields.', 'danger');
                    [firstNameInput, lastNameInput, emailInput, passwordInput, confirmPasswordInput].forEach((field) => {
                        if (!field.value.trim()) field.classList.add('is-invalid');
                    });
                    return;
                }

                if (password.length < 12) {
                    showAlert(signupMessage, 'Use a password with at least 12 characters.', 'warning');
                    passwordInput.classList.add('is-invalid');
                    return;
                }

                if (password !== confirmPassword) {
                    showAlert(signupMessage, 'Passwords do not match.', 'warning');
                    passwordInput.classList.add('is-invalid');
                    confirmPasswordInput.classList.add('is-invalid');
                    return;
                }

                try {
                    await apiRequest('auth/register', { method: 'POST', body: JSON.stringify({ name: `${firstName} ${lastName}`.trim(), email, password, password_confirmation: confirmPassword }) });
                    showAlert(signupMessage, 'Administrator account created. Opening the workspace...', 'success');
                    window.location.href = 'index.html';
                } catch (error) {
                    showAlert(signupMessage, error.message, 'danger');
                }
            });
        } else if (isProtectedPage) {
            apiRequest('auth/session').then((session) => {
                if (!session.authenticated || !session.active) window.location.replace('login.html');
                else {
                    window.barangayUserRole = session.role;
                    document.dispatchEvent(new CustomEvent('barangay:role-loaded'));
                    if (session.name) updateVisibleAdminName(session.name);
                    if (session.role === 'administrator') bindQualificationRuleSettings();
                    const nameInput = document.querySelector('#adminName');
                    const emailInput = document.querySelector('#adminEmail');
                    const roleInput = document.querySelector('#adminRole');
                    if (nameInput && session.name) nameInput.value = session.name;
                    if (emailInput && session.email) emailInput.value = session.email;
                    if (roleInput && session.role) roleInput.value = session.role.replace(/\b\w/g, (letter) => letter.toUpperCase());
                    if (session.role === 'administrator') addNotifications();
                }
            }).catch(() => { window.location.replace('login.html'); });
        }

        bindSettings();

        document.querySelectorAll('[data-registration]').forEach((registrationForm) => {
            registrationForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                if (!registrationForm.checkValidity()) {
                    registrationForm.classList.add('was-validated');
                    registrationForm.reportValidity();
                    return;
                }

                const type = registrationForm.dataset.registration;
                const successMessage = document.querySelector(`#${type}Success`);
                const formData = new FormData(registrationForm);
                const data = Object.fromEntries(formData.entries());
                if (registrationForm.querySelector('[name="requirements"]')) data.requirements = formData.getAll('requirements');
                const recordType = type === 'beneficiary' && registrationForm.dataset.referencePrefix === 'EDU' ? 'student' : type;
                try {
                    const record = await apiRequest('records', { method: 'POST', body: JSON.stringify({ type: recordType, data }) });
                    successMessage.className = 'alert alert-success';
                    successMessage.textContent = `Application saved. Reference number: ${record.reference}.`;
                    successMessage.classList.remove('d-none');
                    registrationForm.reset();
                    registrationForm.classList.remove('was-validated');
                } catch (error) {
                    successMessage.className = 'alert alert-danger';
                    successMessage.textContent = error.message;
                    successMessage.classList.remove('d-none');
                }
                successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        });

        document.querySelectorAll('[data-auth-logout]').forEach((logoutLink) => {
            logoutLink.addEventListener('click', (event) => {
                event.preventDefault();
                signOut();
            });
        });
    });
})();

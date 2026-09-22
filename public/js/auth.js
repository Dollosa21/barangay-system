(() => {
    const demoAdmin = {
        email: 'admin@barangay.gov.ph',
        password: 'Admin@123',
        name: 'Barangay Administrator'
    };
    const sessionKey = 'barangayAdminSession';

    const getSession = () => {
        const savedSession = sessionStorage.getItem(sessionKey) || localStorage.getItem(sessionKey);
        if (!savedSession) {
            return null;
        }

        try {
            return JSON.parse(savedSession);
        } catch (error) {
            sessionStorage.removeItem(sessionKey);
            localStorage.removeItem(sessionKey);
            return null;
        }
    };

    const setSession = (remember) => {
        const settings = readSettings();
        const session = JSON.stringify({
            email: settings.email,
            name: settings.name,
            signedInAt: new Date().toISOString()
        });
        const storage = remember ? localStorage : sessionStorage;
        storage.setItem(sessionKey, session);
        (remember ? sessionStorage : localStorage).removeItem(sessionKey);
    };

    const signOut = () => {
        sessionStorage.removeItem(sessionKey);
        localStorage.removeItem(sessionKey);
        window.location.href = 'login.html';
    };

    const settingsKey = 'barangayAdminSettings';
    const defaultSettings = {
        name: 'Barangay Administrator',
        email: 'admin@barangay.gov.ph',
        avatar: '',
        applicationUpdates: true,
        compactTables: false,
        emailReminders: true
    };
    const registrationRules = {
        'Food assistance': 'Community assembly',
        'Medical assistance': 'Health assessment',
        'Educational assistance': 'Orientation',
        'Senior citizen support': 'Community assembly',
        'Emergency relief': 'Emergency validation'
    };

    const readSettings = () => {
        try {
            return { ...defaultSettings, ...JSON.parse(localStorage.getItem(settingsKey) || '{}') };
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

    const applyWorkspacePreferences = (settings) => {
        document.body.classList.toggle('compact-tables', Boolean(settings.compactTables));
    };

    const bindSettings = () => {
        const nameInput = document.querySelector('#adminName');
        const emailInput = document.querySelector('#adminEmail');
        const avatarInput = document.querySelector('#adminAvatar');
        const avatarPreview = document.querySelector('[data-admin-avatar]');
        const removeAvatarButton = document.querySelector('#removeAdminAvatar');
        const saveButton = [...document.querySelectorAll('button')].find((button) => button.textContent.includes('Save profile'));
        if (!nameInput || !emailInput || !saveButton) return;

        const settings = readSettings();
        applyWorkspacePreferences(settings);
        nameInput.value = settings.name;
        emailInput.value = settings.email;
        updateVisibleAdminName(settings.name);
        updateVisibleAdminAvatar(settings.avatar);
        ['applicationUpdates', 'compactTables', 'emailReminders'].forEach((id) => {
            const input = document.querySelector(`#${id}`);
            if (input) input.checked = Boolean(settings[id]);
        });

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

        saveButton.addEventListener('click', () => {
            nameInput.value = nameInput.value.trim();
            emailInput.value = emailInput.value.trim().toLowerCase();
            if (!nameInput.value || !emailInput.checkValidity()) {
                nameInput.classList.toggle('is-invalid', !nameInput.value);
                emailInput.classList.toggle('is-invalid', !emailInput.checkValidity());
                return;
            }

            const updatedSettings = {
                name: nameInput.value,
                email: emailInput.value,
                avatar: document.querySelector('[data-admin-avatar]')?.querySelector('img')?.src || '',
                applicationUpdates: document.querySelector('#applicationUpdates')?.checked ?? true,
                compactTables: document.querySelector('#compactTables')?.checked ?? false,
                emailReminders: document.querySelector('#emailReminders')?.checked ?? true
            };
            localStorage.setItem(settingsKey, JSON.stringify(updatedSettings));

            const savedSession = getSession();
            if (savedSession) {
                const storage = localStorage.getItem(sessionKey) ? localStorage : sessionStorage;
                storage.setItem(sessionKey, JSON.stringify({ ...savedSession, name: updatedSettings.name, email: updatedSettings.email }));
            }
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
        passwordForm?.addEventListener('submit', (event) => {
            event.preventDefault();
            const currentPassword = document.querySelector('#currentPassword');
            const newPassword = document.querySelector('#newPassword');
            const confirmPassword = document.querySelector('#confirmPassword');
            const storedPassword = localStorage.getItem('barangayAdminPassword') || demoAdmin.password;
            if (currentPassword.value !== storedPassword || !passwordForm.checkValidity() || newPassword.value !== confirmPassword.value) {
                passwordForm.classList.add('was-validated');
                const notice = document.querySelector('#passwordMessage');
                if (notice) { notice.textContent = newPassword.value !== confirmPassword.value ? 'New passwords do not match.' : 'Check your current password and password requirements.'; notice.className = 'alert alert-danger mt-3 mb-0'; }
                return;
            }
            localStorage.setItem('barangayAdminPassword', newPassword.value);
            passwordForm.reset();
            passwordForm.classList.remove('was-validated');
            const notice = document.querySelector('#passwordMessage');
            if (notice) { notice.textContent = 'Password updated successfully.'; notice.className = 'alert alert-success mt-3 mb-0'; }
        });
    };

    window.barangayAuth = { getSession, signOut };

    document.addEventListener('DOMContentLoaded', () => {
        const loginForm = document.querySelector('#loginForm');
        const isLoginPage = Boolean(loginForm);

        if (isLoginPage) {
            if (getSession()) {
                window.location.replace('index.html');
                return;
            }

            const emailInput = document.querySelector('#inputEmail');
            const passwordInput = document.querySelector('#inputPassword');
            const rememberInput = document.querySelector('#inputRememberPassword');
            const loginMessage = document.querySelector('#loginMessage');
            const submitButton = loginForm.querySelector('button[type="submit"]');

            loginForm.addEventListener('submit', (event) => {
                event.preventDefault();
                loginMessage.classList.add('d-none');
                emailInput.classList.remove('is-invalid');
                passwordInput.classList.remove('is-invalid');

                const email = emailInput.value.trim().toLowerCase();
                const password = passwordInput.value;
                const settings = readSettings();
                const validLogin = email === settings.email && password === (localStorage.getItem('barangayAdminPassword') || demoAdmin.password);

                if (!validLogin) {
                    loginMessage.textContent = 'The email or password is incorrect.';
                    loginMessage.classList.remove('d-none');
                    emailInput.classList.toggle('is-invalid', email !== settings.email);
                    passwordInput.classList.add('is-invalid');
                    passwordInput.focus();
                    return;
                }

                submitButton.disabled = true;
                submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Signing in...';
                setSession(rememberInput.checked);
                window.location.href = 'index.html';
            });
        } else if (!getSession()) {
            window.location.replace('login.html');
            return;
        }

        applyWorkspacePreferences(readSettings());
        bindSettings();

        document.querySelectorAll('[data-registration]').forEach((registrationForm) => {
            registrationForm.addEventListener('submit', (event) => {
                event.preventDefault();
                if (!registrationForm.checkValidity()) {
                    registrationForm.classList.add('was-validated');
                    registrationForm.reportValidity();
                    return;
                }

                const type = registrationForm.dataset.registration;
                const formData = new FormData(registrationForm);
                const entries = Object.fromEntries(formData.entries());
                if (registrationForm.dataset.registration === 'beneficiary') {
                    entries.requirements = formData.getAll('requirements');
                }
                const storageKey = type === 'beneficiary' ? 'barangayBeneficiaries' : 'barangayLivelihoods';
                let records = [];
                try {
                    const savedRecords = JSON.parse(localStorage.getItem(storageKey) || '[]');
                    records = Array.isArray(savedRecords) ? savedRecords : [];
                } catch (error) {
                    records = [];
                }
                const duplicate = type === 'beneficiary'
                    ? records.find((record) => record['First name']?.trim().toLowerCase() === entries['First name']?.trim().toLowerCase() && record['Last name']?.trim().toLowerCase() === entries['Last name']?.trim().toLowerCase() && record['Birth date'] === entries['Birth date'])
                    : records.find((record) => record['Applicant / owner name']?.trim().toLowerCase() === entries['Applicant / owner name']?.trim().toLowerCase() && record['Business / project name']?.trim().toLowerCase() === entries['Business / project name']?.trim().toLowerCase());
                if (duplicate) {
                    const successMessage = document.querySelector(`#${type}Success`);
                    successMessage.textContent = `A matching ${type} record already exists (${duplicate.reference}). Search the records center instead of creating a duplicate.`;
                    successMessage.className = 'alert alert-warning';
                    successMessage.classList.remove('d-none');
                    successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return;
                }
                const reference = `${type === 'beneficiary' ? 'BEN' : 'LIV'}-${Date.now().toString().slice(-6)}`;
                const submittedAt = new Date();
                const assignedActivity = type === 'beneficiary' ? (registrationRules[entries['Assistance program']] || 'Community assembly') : '';
                records.push({ reference, status: 'Pending', submittedAt: submittedAt.toISOString(), assignedActivity, history: [{ action: 'Registered', status: 'Pending', at: submittedAt.toISOString() }], ...entries });
                localStorage.setItem(storageKey, JSON.stringify(records));

                const successMessage = document.querySelector(`#${type}Success`);
                const registeredTime = submittedAt.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
                successMessage.className = 'alert alert-success';
                successMessage.textContent = `Registration saved successfully on ${registeredTime}. Reference number: ${reference}.`;
                successMessage.classList.remove('d-none');
                registrationForm.reset();
                registrationForm.classList.remove('was-validated');
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

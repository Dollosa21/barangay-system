(() => {
    const message = (element, text, type = 'info') => {
        element.textContent = text;
        element.className = `alert alert-${type}`;
    };

    document.addEventListener('DOMContentLoaded', async () => {
        const adminMessage = document.querySelector('#adminToolsMessage');
        try {
            const sessionResponse = await fetch('auth/session', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
            const session = await sessionResponse.json();
            if (!session.authenticated || !session.active || session.role !== 'administrator') throw new Error('Administrator access is required.');
            document.querySelector('#adminToolsContent').classList.remove('d-none');
            adminMessage.remove();
        } catch (error) {
            message(adminMessage, error.message, 'danger');
            return;
        }

        document.querySelector('#downloadBackup').addEventListener('click', async () => {
            const button = document.querySelector('#downloadBackup');
            button.disabled = true;
            try {
                const response = await fetch('admin/backup', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
                if (!response.ok) throw new Error('Could not create backup.');
                const blob = await response.blob();
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `barangay-backup-${new Date().toISOString().slice(0, 10)}.json`;
                link.click();
                URL.revokeObjectURL(link.href);
                message(document.querySelector('#backupMessage'), 'Encrypted backup downloaded. Store it and APP_KEY securely.', 'success');
            } catch (error) {
                message(document.querySelector('#backupMessage'), error.message, 'danger');
            } finally {
                button.disabled = false;
            }
        });

        document.querySelector('#restoreForm').addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!window.confirm('Restore this backup? Matching records will be updated and unmatched records added. No current records will be deleted.')) return;
            const file = document.querySelector('#backupFile').files[0];
            if (!file) return;
            const button = document.querySelector('#restoreBackup');
            button.disabled = true;
            try {
                const tokenResponse = await fetch('auth/token', { credentials: 'same-origin' });
                const token = await tokenResponse.json();
                const formData = new FormData();
                formData.append('backup', file);
                const response = await fetch('admin/restore', { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json', 'X-CSRF-TOKEN': token.token }, body: formData });
                const result = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(result.message || 'Could not restore the backup.');
                message(document.querySelector('#backupMessage'), `${result.message} Restored: ${result.restored.applications} applications, ${result.restored.program_records} activities, ${result.restored.qualification_rules} qualification rules, ${result.restored.program_budgets} budget allocations, ${result.restored.audit_logs} audit entries.`, 'success');
            } catch (error) {
                message(document.querySelector('#backupMessage'), error.message, 'danger');
            } finally {
                button.disabled = false;
            }
        });
    });
})();

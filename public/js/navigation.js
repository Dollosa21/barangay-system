document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-previous-page]').forEach((link) => {
        const fallback = link.getAttribute('href') || 'login.html';
        const referrer = document.referrer;
        let hasSameOriginPreviousPage = false;

        try {
            hasSameOriginPreviousPage = Boolean(referrer) && new URL(referrer).origin === window.location.origin;
        } catch (error) {
            hasSameOriginPreviousPage = false;
        }

        link.addEventListener('click', (event) => {
            event.preventDefault();
            if (hasSameOriginPreviousPage && window.history.length > 1) window.history.back();
            else window.location.assign(fallback);
        });
    });
});

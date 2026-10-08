## Barangay Paglaum Programs

Web-based beneficiary assistance and livelihood program management for Barangay Paglaum, Municipality of Binalbagan, Negros Occidental.
## Barangay Paglaum Programs

Web-based beneficiary assistance and livelihood program management for Barangay Paglaum, Municipality of Binalbagan, Negros Occidental.

### Workflows

- Beneficiary registration and assistance applications
- Program requirements, activity assignment, qualification checks, approvals, releases and history
- Livelihood participant registration and project tracking
- Training schedules and participant attendance history
- Search, status monitoring and basic reports

### XAMPP setup

Requirements: PHP 8.2+, Composer, MySQL/MariaDB, and Apache with `mod_rewrite` enabled.

1. Start Apache and MySQL in XAMPP.
2. Create a MySQL database named `barangay_system`. Configure `.env` with its host, username and password; set `APP_URL` to the public path, for example `http://localhost/barangay-system/public`.
3. Run `composer install`, then `php artisan key:generate`.
4. Back up the configured database first if any old data must be retained. The initial cleanup migration intentionally removes legacy MIS tables outside this program system.
5. Run `php artisan migrate --force`.
6. Open `http://localhost/barangay-system/public/index.php` and create the first administrator in the one-time setup screen.

No Node/Vite build is required. First-party browser assets are served from `public/`.

### Data model

Program data uses `beneficiary_applications`, `livelihood_applications`, `program_records`, `program_qualification_rules`, and `audit_logs`. Laravel authentication, session, cache and queue tables remain as platform infrastructure. Student assistance, program budgets, notifications, backup endpoints, and legacy barangay modules are not part of this system.

### Tests

Run `php artisan test` to verify the schema, administrator setup, qualification-gated approval, releases, livelihood registration, training, attendance, search and reports.
- **[Redberry](https://redberry.international/laravel-development)**
- **[Active Logic](https://activelogic.com)**

## Contributing

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).

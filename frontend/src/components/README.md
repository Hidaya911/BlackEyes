# Component organization

- `home/`: landing page navigation, hero, services, about section, and footer.
- `auth/`: login, signup, forgot-password, and reset-password screens.
- `admin/`: admin workspace, product/staff/settings management, and vendor ledger.
- `customer/`: customer workspace, catalog, checkout, orders, and profile.
- `staff/`: staff workspace, profile avatar, and personal settings.
- `press/`: order review and walk-in order entry shared by admin and staff.
- `shared/`: general components such as the role-page scaffold.

`src/App.tsx` selects the page. API clients, styles, assets, and utilities remain
in their existing folders outside `components/`.

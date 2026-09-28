## (Group4)CAPSTONEEEE :<<<<

# Directory Structure

```text
7078-cj-todagoo/
├── README.md
├── PostGres.md
├── run-dev.ps1
├── setup-db.py
├── backend/
│   ├── create_feature.py
│   ├── Dockerfile
│   ├── manage.py
│   ├── Procfile
│   ├── requirements.txt
│   ├── seed.py
│   ├── .env.example
│   ├── api/
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── broadcast.py
│   │   ├── idempotency.py
│   │   ├── models.py
│   │   ├── pagination.py
│   │   ├── permissions.py
│   │   ├── tests.py
│   │   ├── urls.py
│   │   ├── validators.py
│   │   │
│   │   ├── features/
│   │   │   ├── admin/
│   │   │   │   ├── models.py
│   │   │   │   ├── serializers.py
│   │   │   │   ├── signals.py
│   │   │   │   ├── urls.py
│   │   │   │   └── views.py
│   │   │   │
│   │   │   ├── booking/
│   │   │   │   ├── models.py
│   │   │   │   ├── serializers.py
│   │   │   │   ├── signals.py
│   │   │   │   ├── urls.py
│   │   │   │   ├── utils.py
│   │   │   │   ├── views.py
│   │   │   │   └── helpers/
│   │   │   │       ├── booking_error.py
│   │   │   │       ├── nearest_driver.py
│   │   │   │       ├── nearest_toda.py
│   │   │   │       ├── nearest_toda_station.py
│   │   │   │       └── offer_driver.py
│   │   │   │
│   │   │   ├── chat/
│   │   │   │   ├── models.py
│   │   │   │   ├── serializers.py
│   │   │   │   ├── signals.py
│   │   │   │   ├── urls.py
│   │   │   │   └── views.py
│   │   │   │
│   │   │   ├── driver/
│   │   │   │   ├── models.py
│   │   │   │   ├── permissions.py
│   │   │   │   ├── serializers.py
│   │   │   │   ├── signals.py
│   │   │   │   ├── urls.py
│   │   │   │   ├── utils.py
│   │   │   │   └── views.py
│   │   │   │
│   │   │   ├── passenger/
│   │   │   │   ├── models.py
│   │   │   │   ├── permissions.py
│   │   │   │   ├── serializers.py
│   │   │   │   ├── signals.py
│   │   │   │   ├── urls.py
│   │   │   │   └── views.py
│   │   │   │
│   │   │   ├── reports/
│   │   │   │   ├── models.py
│   │   │   │   ├── serializers.py
│   │   │   │   ├── signals.py
│   │   │   │   ├── urls.py
│   │   │   │   └── views.py
│   │   │   │
│   │   │   ├── user/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── models.py
│   │   │   │   ├── serializers.py
│   │   │   │   ├── urls.py
│   │   │   │   ├── utils.py
│   │   │   │   └── views.py
│   │   │   │
│   │   │   └── utils/
│   │   │       ├── distance.py
│   │   │       ├── reconstruction.py
│   │   │       ├── roles.py
│   │   │       └── validation.py
│   │   │
│   │   ├── middleware/
│   │   │   ├── __init__.py
│   │   │   └── logger.py
│   │   │
│   │   ├── migrations/
│   │   │   ├── 0001_initial.py
│   │   │   ├── 0002_admin_delete_test.py
│   │   │   ├── 0003_driver_passenger.py
│   │   │   ├── 0004_registeredtoda.py
│   │   │   ├── 0005_alter_registeredtoda_registration_date.py
│   │   │   ├── 0006_toda.py
│   │   │   ├── 0007_registeredtoda_toda.py
│   │   │   ├── 0008_rename_toda_name_toda_name.py
│   │   │   ├── 0009_toda_color.py
│   │   │   ├── 0010_driver_status.py
│   │   │   ├── 0011_alter_driver_user_alter_passenger_user.py
│   │   │   ├── 0012_driver_contact_number_driver_toda_station_and_more.py
│   │   │   ├── 0013_alter_driver_contact_number_and_more.py
│   │   │   ├── 0014_booking_driverqueue_stop.py
│   │   │   ├── 0015_alter_booking_driver.py
│   │   │   ├── 0016_booking_end_address_booking_start_address.py
│   │   │   ├── 0017_stop_address.py
│   │   │   ├── 0018_toda_prefix.py
│   │   │   ├── 0019_driverqueue_created_at.py
│   │   │   ├── 0020_driver_rating_passenger_rating_rate.py
│   │   │   ├── 0021_rate_feedback.py
│   │   │   ├── 0022_rate_booking_rate_created_at_rate_rater_and_more.py
│   │   │   ├── 0023_rename_toda_station_driver_toda_boundary_and_more.py
│   │   │   ├── 0024_rename_toda_stations_driver_toda_station_and_more.py
│   │   │   ├── 0025_remove_driver_franchise_permit_number_and_more.py
│   │   │   ├── 0026_booking_routes.py
│   │   │   ├── 0027_alter_driver_toda_boundary_alter_driver_toda_station_and_more.py
│   │   │   ├── 0028_alter_incidentevidence_file.py
│   │   │   ├── 0029_remove_incidentreport_gps_lat_and_more.py
│   │   │   ├── 0030_booking_type.py
│   │   │   ├── 0031_message.py
│   │   │   ├── 0032_passenger_status_alter_driver_status.py
│   │   │   └── __init__.py
│   │   │
│   │   └── rate_limit/
│   │       └── TestThrottle.py
│   │
│   ├── backend/
│   │   ├── __init__.py
│   │   ├── asgi.py
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   │
│   ├── executables/
│   │   └── start_web.sh
│   │
│   └── websocket/
│       ├── __init__.py
│       ├── admin.py
│       ├── apps.py
│       ├── consumers.py
│       ├── middleware.py
│       ├── models.py
│       ├── routing.py
│       ├── features/
│       │   ├── booking.py
│       │   ├── driver.py
│       │   ├── passenger.py
│       │   └── reports.py
│       └── migrations/
│           └── __init__.py
│
├── frontend/
│   ├── README.md
│   ├── components.json
│   ├── Dockerfile
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vercel.json
│   ├── vite.config.js
│   ├── .env.example
│   └── src/
│       ├── App.css
│       ├── App.jsx
│       ├── index.css
│       ├── main.jsx
│       │
│       ├── api/
│       │   ├── incident_reports.js
│       │   ├── passenger.js
│       │   ├── registered_toda.js
│       │   ├── toda.js
│       │   ├── toda_station.js
│       │   └── todagoo_drivers.js
│       │
│       ├── app/
│       │   └── store.js
│       │
│       ├── components/
│       │   ├── CreateUpdateStation.jsx
│       │   ├── DeleteConfirmModal.jsx
│       │   ├── Footer.jsx
│       │   ├── Header.jsx
│       │   ├── MapComponent.jsx
│       │   ├── OverviewCard.jsx
│       │   ├── Pagination.jsx
│       │   ├── RegisteredTodaModal.jsx
│       │   ├── SearchFilter.jsx
│       │   ├── SearchInput.jsx
│       │   ├── SideBarComponent.jsx
│       │   ├── Table.jsx
│       │   ├── UploadExcel.jsx
│       │   ├── forgot_password/
│       │   │   ├── EmailStep.jsx
│       │   │   ├── ResetPasswordStep.jsx
│       │   │   └── VerifyCodeStep.jsx
│       │   ├── IncidentReport/
│       │   │   ├── IncidentReportCard.jsx
│       │   │   ├── IncidentReportMap.jsx
│       │   │   └── IncidentReportModal.jsx
│       │   ├── Toda/
│       │   │   ├── AddBoundaries.jsx
│       │   │   ├── AddBoundariesModal.jsx
│       │   │   ├── TodaCard.jsx
│       │   │   ├── TodaList.jsx
│       │   │   └── TodaPage.jsx
│       │   └── ui/
│       │       ├── button.tsx
│       │       ├── dialog.tsx
│       │       ├── input.tsx
│       │       ├── separator.tsx
│       │       ├── sheet.tsx
│       │       ├── sidebar.tsx
│       │       ├── skeleton.tsx
│       │       └── tooltip.tsx
│       │
│       ├── context/
│       │   ├── MDRRMOroutes.jsx
│       │   ├── PrivateRoutes.jsx
│       │   └── TODAroutes.jsx
│       │
│       ├── features/
│       │   └── auth/
│       │       └── authSlice.js
│       │
│       ├── hooks/
│       │   ├── use-mobile.ts
│       │   └── useWebsocket.js
│       │
│       ├── lib/
│       │   └── utils.ts
│       │
│       ├── listener/
│       │   └── reportListener.js
│       │
│       ├── pages/
│       │   ├── DashBoard.jsx
│       │   ├── ForgotPassword.jsx
│       │   ├── IncidentReports.jsx
│       │   ├── Login.jsx
│       │   ├── MdrrmoDashboard.jsx
│       │   ├── Passengers.jsx
│       │   ├── RegisteredToda.jsx
│       │   ├── TodaBoundaries.jsx
│       │   ├── TodaDashboard.jsx
│       │   ├── TodaGooDrivers.jsx
│       │   ├── TodaStation.jsx
│       │   └── Unauthorized.jsx
│       │
│       └── utils/
│           ├── auth.js
│           ├── cookies.js
│           ├── forgot_password.js
│           ├── requests.js
│           ├── validation.js
│           └── map_utils/
│               ├── fetch_routes.js
│               ├── map.js
│               └── mapEventListener.jsx
│
└── mobile/
    ├── README.md
    ├── app.json
    ├── babel.config.js
    ├── eslint.config.js
    ├── global.css
    ├── metro.config.js
    ├── nativewind-env.d.ts
    ├── package.json
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── .env.example
    │
    ├── api/
    │   ├── auth.js
    │   ├── book.js
    │   ├── chat.js
    │   ├── driver.js
    │   ├── passenger.js
    │   ├── rate.js
    │   ├── report.js
    │   └── toda.js
    │
    ├── app/
    │   ├── _layout.jsx
    │   ├── index.jsx
    │   ├── (global)/
    │   │   ├── _layout.jsx
    │   │   ├── login.jsx
    │   │   └── register/
    │   │       ├── driver.jsx
    │   │       └── passenger.jsx
    │   │
    │   └── (protected)/
    │       ├── _layout.jsx
    │       ├── driver/
    │       │   ├── _layout.jsx
    │       │   ├── complete.jsx
    │       │   ├── en_route.jsx
    │       │   └── home.jsx
    │       │
    │       └── passenger/
    │           ├── _layout.jsx
    │           ├── book.jsx
    │           ├── complete.jsx
    │           ├── en_route.jsx
    │           └── home.jsx
    │
    ├── components/
    │   ├── BottomDetails.jsx
    │   ├── ButtonComponent.jsx
    │   ├── DriverProfileForm.jsx
    │   ├── IncidentReportModal.jsx
    │   ├── NewBookingModal.jsx
    │   ├── PassengerProfileForm.jsx
    │   ├── PickTodaStation.jsx
    │   ├── RateUser.jsx
    │   ├── SetLocationMapModal.jsx
    │   ├── UserRegisterForm.jsx
    │   ├── chat/
    │   │   ├── ChatInput.jsx
    │   │   ├── ChatModal.jsx
    │   │   └── Messages.jsx
    │   ├── inputs/
    │   │   ├── FormTextField.jsx
    │   │   └── PickImageComponent.jsx
    │   ├── layouts/
    │   │   └── BottomNav.jsx
    │   └── map/
    │       ├── LeafletMapView.jsx
    │       ├── MapComponent.jsx
    │       ├── MapControls.jsx
    │       └── SearchInput.jsx
    │
    ├── contexts/
    │   ├── AuthContext.js
    │   ├── DriverContext.js
    │   └── PassengerContext.js
    │
    ├── hooks/
    │   └── useWebsocket.js
    │
    ├── listeners/
    │   ├── bookingListener.js
    │   ├── driverListener.js
    │   └── passengerListener.js
    │
    ├── types/
    │   └── index.ts
    │
    └── utils/
        ├── imagePicker.js
        ├── location.js
        ├── requests.js
        ├── validation.js
        └── mapUtils/
            ├── fetchOsrmRoutes.js
            ├── handleSearch.js
            ├── initLocation.js
            └── reverseGeolocation.js
```


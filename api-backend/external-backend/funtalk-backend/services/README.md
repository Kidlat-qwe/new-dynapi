# Backend services

## `s3Materials.js`

Uploads material files to Amazon S3 with role-specific prefixes under `materials/`:

- **superadmin:** `materials/superadmin_materials/`
- **admin:** `materials/admin-materials/`
- **teacher:** `materials/teacher_materials/`

Configure `AWS_S3_BUCKET` (e.g. `funtalk-storage`), `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`. If these are not set, the API falls back to local `uploads/materials/` paths.

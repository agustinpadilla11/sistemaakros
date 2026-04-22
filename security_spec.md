# Security Specification: Gym Manager

## 1. Data Invariants
- A `usuario` document must strictly match the authenticated user's UID.
- Users cannot assign themselves the "admin" role during registration.
- An `alumna` can only be linked to a `padre` if the `padre` authenticated user ID matches the linking request, and the DNI of the `alumna` matches the input.
- Parents can only read `alumnas`, `cuotas`, `ventas` and `otros_costos` records strictly related to the `alumna_id` that is mapped to their `usuario_id` via `padre_alumna`.
- Only `admin` can create, update, or delete `alumnas`, `cuotas`, `ventas`, `otros_costos`, `grupos`, `productos`.
- All writes related to these collections must respect schema rules (types, max sizes).

## 2. The "Dirty Dozen" Payloads
1. **Identity Spoofing**: Padre attempts to create a `usuario` profile for another UID.
2. **Privilege Escalation**: Padre attempts to set `rol: "admin"` when creating their `usuario`.
3. **Admin Lockout**: Padre attempts to update an admin's profile.
4. **Alumna Write Bypass**: Padre attempts to edit their daughter's `alumna` record.
5. **Cross-Tenant Link**: Padre A attempts to create a `padre_alumna` mapping for Padre B's UID.
6. **Self-Approval Link**: Padre creates a `padre_alumna` link for an `alumna`, assuming he knows the DNI. Wait, the rule says parents can create their own link. But they don't know the alumna doc ID necessarily, unless they query it. The client will query by DNI, get the alumna, and create the link. The rules should allow Padre to create `padre_alumna` if `usuario_id == request.auth.uid`.
7. **Read PII Alumnas**: Padre queries all `alumnas` without restricting to their linked ones.
8. **Delete Cuota**: Padre attempts to delete a pending cuota.
9. **Update Merchandising**: Padre attempts to change the price of a `producto`.
10. **Ghost Field Injection**: Admin attempts to write an `alumna` with an unapproved field `isPremium: true`.
11. **ID Poisoning**: A user sends an ID string of length 500.
12. **Timestamp Forgery**: A user sends a past timestamp for `creado_en`.

## 3. Test Runner
We will create `firestore.rules.test.ts`.

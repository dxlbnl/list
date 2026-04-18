# Authentication & Magic Sessions

The app uses a passwordless, "Magic Session" first approach.

## 1. Anonymous Magic Sessions
- New users are automatically assigned an anonymous `user` record in the database.
- A long-lived session cookie is set.
- All lists created are linked to this anonymous ID.

## 2. Recovery & Registration
- Users can "secure" their account by entering an email.
- A **Magic Link** is sent to the email.
- Clicking the link verifies ownership of that email.

## 3. Account Merging
- **Case A: New Email**: The current anonymous user record is updated with the email and marked as verified.
- **Case B: Existing Email**: 
  - If the user logs into an existing account while having a magic session with lists:
  - After email confirmation, all `lists` and `list_users` associated with the anonymous ID are transferred to the verified account ID.
  - The anonymous user record is then deleted.
- **Security**: Merging only occurs *after* the email token has been successfully validated.

## 4. Shared List Access
- Users can join shared lists via link/QR code.
- Joining a list simply adds the current user's ID (magic or verified) to the `list_users` table for that list.

// Account surfaces follow the site's English-language institutional register.
export const accountMessages: Record<string, string> = {
  invalid_email: 'Enter a valid email address.',
  invalid_profile:
    'Enter a display name of 1–100 characters and an affiliation of up to 200 characters.',
  reserved_name:
    'Choose a personal display name. Names used by TCN officers or system messages are reserved.',
  password_check_unavailable:
    'Password safety checking is temporarily unavailable. Please try again later.',
  invalid_password:
    'Use 15–64 characters. Spaces and Unicode are welcome; hidden and control characters are not.',
  weak_password: 'Choose a less common password or a longer phrase.',
  password_mismatch: 'The passwords do not match. Please enter them again.',
  password_unchanged: 'Choose a password different from your current password.',
  invalid_credentials: 'The current password is incorrect. Please try again.',
  invalid_code: 'That code is incorrect. Check the latest email and try again.',
  verification_required:
    'Email verification has expired or is incomplete. Request a new code to continue.',
  invalid_reset_link: 'This reset link has expired or has already been used. Request a new link.',
  email_taken: 'This verified email already has an account. Sign in or reset your password.',
  already_signed_in:
    'You are already signed in. Open your profile or log out to use another account.',
  email_unavailable: 'Email delivery is temporarily unavailable. Please try again later.',
  rate_limited: 'Too many requests. Wait before trying again.',
  session_ended: 'Your session has ended after repeated incorrect passwords. Sign in again.',
  unauthorized: 'Your session has ended. Sign in again before continuing.',
  invalid_csrf: 'Your security token has expired. Reload this page before trying again.',
  invalid_fields: 'Some fields could not be saved. Review the form and try again.',
  invalid_json: 'The request could not be read. Reload this page and try again.',
  network_error:
    'The connection failed. Your changes may not have reached the server. Please check before trying again.',
  request_failed: 'We could not complete the request. Please try again.',
};

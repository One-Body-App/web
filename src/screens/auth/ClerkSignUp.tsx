import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSignUp } from '@clerk/clerk-react';
import { Check } from 'lucide-react';
import {
  AccountTypePicker,
  AuthDivider,
  AuthError,
  AuthSuccess,
  BackButton,
  CodeInput,
  PasswordField,
  SocialButtons,
  SubmitButton,
  TextField,
  type AccountType,
} from '@/components/auth/AuthControls';
import { AFTER_AUTH_URL, SSO_CALLBACK_URL, clerkErrorMessage } from '@/auth/clerkErrors';
import { ApiError } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { TurnstileGate } from '@/components/TurnstileGate';
import { useTurnstileVerification } from '@/auth/useTurnstileVerification';

type Step = 'type' | 'details' | 'verify';

const normalizeUsername = (value: string) => value.toLowerCase().replace(/[^a-z0-9._-]/g, '');
const normalizeClerkUsername = (value: string) =>
  normalizeUsername(value).replace(/[^a-z0-9_-]+/g, '_');
const DEFAULT_PATCHABLE_MISSING_FIELDS = ['first_name', 'last_name', 'username', 'legal_accepted'];

const normalizeMissingField = (field: string) =>
  field
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const getMissingFields = (value: any) => {
  const fields =
    value?.missingFields ??
    value?.missing_fields ??
    value?.missingRequirements ??
    value?.missing_requirements;
  return Array.isArray(fields)
    ? fields.filter((field): field is string => typeof field === 'string')
    : [];
};

const getCreatedSessionId = (value: any) => {
  const sessionId = value?.createdSessionId;
  return typeof sessionId === 'string' && sessionId.trim() ? sessionId : undefined;
};

const missingFieldLabel = (field: string) => {
  const normalized = normalizeMissingField(field);
  if (normalized === 'first_name') return 'first name';
  if (normalized === 'last_name') return 'last name';
  if (normalized === 'legal_accepted') return 'terms acceptance';
  return normalized.replace(/_/g, ' ') || field;
};

const missingRequirementsMessage = (fields: string[]) => {
  if (fields.length === 0) return 'Additional profile information is required before continuing.';
  const fieldList = fields.map(missingFieldLabel).join(', ');
  return `Clerk needs ${fieldList} before continuing. Please go back and complete sign up again.`;
};

function suggestUsernames(base: string, name: string): string[] {
  const rand = () => Math.floor(Math.random() * 900 + 100);
  const fromName = normalizeUsername(name).slice(0, 14);
  const candidates = [
    `${base}${rand()}`,
    `${base}_${rand()}`,
    `${base}.${String(rand()).slice(0, 2)}`,
    fromName ? `${fromName}${String(rand()).slice(0, 2)}` : `${base}${rand()}`,
  ];
  return [...new Set(candidates)].filter((c) => c.length >= 3).slice(0, 4);
}

export function ClerkSignUp() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('type');
  const [accountType, setAccountType] = useState<AccountType | null>(null);

  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameOk, setUsernameOk] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const [organizationName, setOrganizationName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const turnstile = useTurnstileVerification(setError);

  const isOrg = accountType === 'organization';
  const trimmedFirstName = firstName.trim();
  const trimmedLastName = lastName.trim();
  const trimmedOrganizationName = organizationName.trim();
  const profileName = isOrg
    ? trimmedOrganizationName
    : [trimmedFirstName, trimmedLastName].filter(Boolean).join(' ');
  const confirmError =
    confirmPassword && confirmPassword !== password ? 'Passwords must match.' : '';

  function buildMissingRequirementsUpdate(missingFields: string[]) {
    const requestedFields = new Set(
      (missingFields.length ? missingFields : DEFAULT_PATCHABLE_MISSING_FIELDS).map(
        normalizeMissingField
      )
    );
    const update: {
      firstName?: string;
      lastName?: string;
      username?: string;
      legalAccepted?: boolean;
    } = {};

    if (requestedFields.has('first_name') && trimmedFirstName) {
      update.firstName = trimmedFirstName;
    }
    if (requestedFields.has('last_name') && trimmedLastName) {
      update.lastName = trimmedLastName;
    }
    const clerkUsername = username ? normalizeClerkUsername(username) : undefined;
    if (requestedFields.has('username') && clerkUsername) {
      update.username = clerkUsername;
    }
    if (requestedFields.has('legal_accepted')) {
      update.legalAccepted = true;
    }

    return update;
  }

  function unpatchedMissingFields(
    missingFields: string[],
    update: ReturnType<typeof buildMissingRequirementsUpdate>
  ) {
    return missingFields.filter((field) => {
      const normalized = normalizeMissingField(field);
      if (normalized === 'first_name') return !update.firstName;
      if (normalized === 'last_name') return !update.lastName;
      if (normalized === 'username') return !update.username;
      if (normalized === 'legal_accepted') return update.legalAccepted !== true;
      return true;
    });
  }

  async function activateCompletedSignup(resource: any) {
    const createdSessionId = getCreatedSessionId(resource) ?? getCreatedSessionId(signUp);
    if (!createdSessionId) {
      setError('Your email is verified. Please sign in to continue.');
      return;
    }
    if (!setActive) {
      setError('Authentication is still loading. Please try again.');
      return;
    }
    await setActive({ session: createdSessionId });
    navigate(AFTER_AUTH_URL, { replace: true });
  }

  async function completeOrPatchSignup(resource: any) {
    if (resource?.status === 'complete') {
      await activateCompletedSignup(resource);
      return;
    }

    if (resource?.status !== 'missing_requirements') {
      setError('That code did not work. Please try again.');
      return;
    }

    const missingFields = getMissingFields(resource);
    const update = buildMissingRequirementsUpdate(missingFields);
    const unpatchedFields = unpatchedMissingFields(missingFields, update);

    if (unpatchedFields.length > 0 || Object.keys(update).length === 0) {
      setError(
        missingRequirementsMessage(unpatchedFields.length > 0 ? unpatchedFields : missingFields)
      );
      return;
    }

    if (!signUp) {
      setError('Authentication is still loading. Please try again.');
      return;
    }
    const updated = await signUp.update(update);
    if (updated.status === 'complete') {
      await activateCompletedSignup(updated);
      return;
    }

    const remainingFields = getMissingFields(updated);
    setError(
      missingRequirementsMessage(remainingFields.length > 0 ? remainingFields : missingFields)
    );
  }

  async function checkUsername(raw: string) {
    const normalized = normalizeUsername(raw);
    setUsernameOk(false);
    setSuggestions([]);
    if (!normalized) return;
    if (normalized.length < 3) {
      setUsernameError('Usernames must be at least 3 characters.');
      return;
    }
    setCheckingUsername(true);
    setUsernameError('');
    try {
      await endpoints.checkUsername(normalized);
      setUsernameOk(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setUsernameError('This username is already in use. If it belongs to you, please sign in.');
        setSuggestions(suggestUsernames(normalized, profileName));
      }
      // Network/CORS errors: skip the pre-check; Clerk validates uniqueness on submit.
    } finally {
      setCheckingUsername(false);
    }
  }

  async function social(strategy: 'oauth_google' | 'oauth_apple') {
    if (!isLoaded) return;
    setError(null);
    try {
      await signUp.authenticateWithRedirect({
        strategy,
        redirectUrl: SSO_CALLBACK_URL,
        redirectUrlComplete: AFTER_AUTH_URL,
        unsafeMetadata: accountType ? { accountType } : undefined,
      });
    } catch (err) {
      setError(clerkErrorMessage(err));
    }
  }

  async function submitDetails(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || busy) return;
    if (username.length < 3) {
      setUsernameError('Usernames must be at least 3 characters.');
      return;
    }
    if (usernameError) return;
    if (confirmError) return;
    if (!trimmedFirstName || !trimmedLastName || (isOrg && !trimmedOrganizationName)) {
      setError('Please enter first name, last name, and any required organization name.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const turnstileOk = await turnstile.verify('auth-sign-up');
      if (!turnstileOk) return;

      await signUp.create({
        emailAddress: email.trim().toLowerCase(),
        password,
        username: normalizeClerkUsername(username),
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        legalAccepted: true,
        unsafeMetadata: accountType
          ? {
              accountType,
              name: profileName,
              ...(isOrg ? { organizationName: trimmedOrganizationName } : {}),
            }
          : undefined,
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setStep('verify');
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitVerify(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await signUp.attemptEmailAddressVerification({ code });
      await completeOrPatchSignup(res);
    } catch (err) {
      setError(clerkErrorMessage(err, 'That code did not work. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!isLoaded) return;
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    } catch (err) {
      setError(clerkErrorMessage(err));
    }
  }

  /* ----- Step 1: account type ----- */
  if (step === 'type') {
    return (
      <div className="auth-form">
        <p className="auth-step-note">First, tell us who’s joining the family.</p>
        <AccountTypePicker value={accountType} onChange={setAccountType} />
        <SubmitButton
          type="button"
          disabled={!accountType}
          onClick={() => accountType && setStep('details')}
        >
          Continue
        </SubmitButton>
      </div>
    );
  }

  /* ----- Step 3: verify email ----- */
  if (step === 'verify') {
    return (
      <form className="auth-form" onSubmit={submitVerify}>
        <BackButton onClick={() => { setStep('details'); setError(null); }} />
        <AuthSuccess>
          We sent a 6-digit code to <strong>{email}</strong>. Enter it to verify your account.
        </AuthSuccess>
        <AuthError message={error} />
        <CodeInput value={code} onChange={setCode} />
        <SubmitButton loading={busy} disabled={code.length < 6}>
          Verify &amp; continue
        </SubmitButton>
        <div className="auth-row">
          <button type="button" className="auth-link" onClick={resend}>
            Resend code
          </button>
        </div>
      </form>
    );
  }

  /* ----- Step 2: details ----- */
  const canSubmit =
    username.length >= 3 &&
    !usernameError &&
    Boolean(trimmedFirstName && trimmedLastName && profileName && email && password) &&
    !confirmError &&
    turnstile.passed;

  return (
    <div className="auth-form">
      <BackButton onClick={() => { setStep('type'); setError(null); }} label="Change account type" />
      <SocialButtons
        onGoogle={() => social('oauth_google')}
        onApple={() => social('oauth_apple')}
        disabled={busy}
        verb="Sign up"
      />
      <AuthDivider />
      <form className="auth-form" onSubmit={submitDetails}>
        <AuthError message={error} />

        <TextField
          label="Create a Username"
          autoComplete="username"
          placeholder="e.g. brother_john"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={username}
          error={usernameError}
          onChange={(e) => {
            setUsername(normalizeUsername(e.target.value));
            setUsernameError('');
            setUsernameOk(false);
            setSuggestions([]);
          }}
          onBlur={() => checkUsername(username)}
          rightSlot={
            checkingUsername ? (
              <span className="field__spinner" />
            ) : usernameOk ? (
              <span className="field__ok">
                <Check size={18} />
              </span>
            ) : null
          }
        />

        {suggestions.length > 0 ? (
          <div className="username-suggestions">
            <p className="username-suggestions__label">Suggested usernames:</p>
            <div className="username-suggestions__chips">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="suggestion-chip"
                  onClick={() => {
                    setUsername(s);
                    setSuggestions([]);
                    checkUsername(s);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {isOrg ? (
          <TextField
            label="Organization / Ministry Name"
            autoComplete="organization"
            placeholder="e.g. One Body Church"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            required
          />
        ) : null}
        <TextField
          label={isOrg ? 'Contact First Name' : 'First Name'}
          autoComplete="given-name"
          placeholder="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
        <TextField
          label={isOrg ? 'Contact Last Name' : 'Last Name'}
          autoComplete="family-name"
          placeholder="Last name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />
        <TextField
          label="Email Address"
          type="email"
          autoComplete="email"
          placeholder="email@example.com"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value.trim())}
          required
        />
        <PasswordField
          label="Create a Password"
          autoComplete="new-password"
          placeholder="Enter a secure password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <PasswordField
          label="Confirm Password"
          autoComplete="new-password"
          placeholder="Re-enter password for security"
          value={confirmPassword}
          error={confirmError}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        {turnstile.enabled ? (
          <div className="auth-turnstile">
            <TurnstileGate
              key={turnstile.resetKey}
              action="auth-sign-up"
              size="flexible"
              onVerify={turnstile.handleVerify}
              onExpire={turnstile.clear}
              onError={turnstile.clear}
            />
          </div>
        ) : null}
        <SubmitButton loading={busy} disabled={!canSubmit}>
          Create account
        </SubmitButton>
      </form>
    </div>
  );
}

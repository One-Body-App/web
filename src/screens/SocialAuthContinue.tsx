import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSignUp } from '@clerk/clerk-react';
import { AuthError, BackButton } from '@/components/auth/AuthControls';
import { Splash } from '@/components/Splash';
import { AFTER_AUTH_URL, clerkErrorMessage } from '@/auth/clerkErrors';
import {
  clearPendingSocialAuth,
  getPendingSocialAuth,
  promotePendingSocialAuth,
} from '@/auth/socialAuthSession';

type MissingRequirementsUpdate = {
  firstName?: string;
  lastName?: string;
  username?: string;
  legalAccepted?: boolean;
  unsafeMetadata?: Record<string, unknown>;
};

const PATCHABLE_FIELDS = ['first_name', 'last_name', 'username', 'legal_accepted'];

const normalizeMissingField = (field: string) =>
  field
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeUsername = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9_-]+/g, '_');

const getCreatedSessionId = (value: any) => {
  const sessionId = value?.createdSessionId;
  return typeof sessionId === 'string' && sessionId.trim() ? sessionId : undefined;
};

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

const randomHex = (byteCount: number) => {
  const bytes = new Uint8Array(byteCount);
  try {
    window.crypto.getRandomValues(bytes);
  } catch {
    for (let index = 0; index < byteCount; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const titleCaseFallback = (value: string) => {
  const cleaned = value.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned
    .split(/\s+/)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
};

const missingFieldLabel = (field: string) => {
  const normalized = normalizeMissingField(field);
  if (normalized === 'first_name') return 'first name';
  if (normalized === 'last_name') return 'last name';
  if (normalized === 'legal_accepted') return 'terms acceptance';
  return normalized.replace(/_/g, ' ') || field;
};

const missingRequirementsMessage = (fields: string[]) => {
  if (fields.some((field) => normalizeMissingField(field) === 'password')) {
    return 'Clerk is requiring a password for social signup. Update the Clerk OAuth signup requirements or use email signup.';
  }
  if (fields.length === 0) return 'Additional account information is required.';
  return `Clerk needs ${fields.map(missingFieldLabel).join(', ')} before continuing.`;
};

function buildUpdate(resource: any): MissingRequirementsUpdate {
  const missingFields = getMissingFields(resource);
  const requestedFields = new Set(
    (missingFields.length ? missingFields : PATCHABLE_FIELDS).map(normalizeMissingField),
  );
  const pending = getPendingSocialAuth();
  const emailLocalPart = String(resource?.emailAddress ?? '').split('@')[0]?.trim();
  const fallbackName = titleCaseFallback(emailLocalPart || 'One Body');
  const fallbackNameParts = fallbackName.split(/\s+/).filter(Boolean);
  const firstName = resource?.firstName || fallbackNameParts[0] || 'One';
  const lastName = resource?.lastName || fallbackNameParts[1] || 'Body';
  const usernameBase = resource?.username || emailLocalPart || `${firstName}${lastName}` || 'onebody';
  const update: MissingRequirementsUpdate = {
    unsafeMetadata: {
      ...(resource?.unsafeMetadata && typeof resource.unsafeMetadata === 'object'
        ? resource.unsafeMetadata
        : {}),
      authMethod: 'social',
      ...(pending?.accountType ? { accountType: pending.accountType } : {}),
    },
  };

  if (requestedFields.has('first_name')) update.firstName = firstName;
  if (requestedFields.has('last_name')) update.lastName = lastName;
  if (requestedFields.has('username')) {
    update.username = normalizeUsername(`${usernameBase}${randomHex(4)}`);
  }
  if (requestedFields.has('legal_accepted')) update.legalAccepted = true;

  return update;
}

function unpatchedFields(missingFields: string[], update: MissingRequirementsUpdate) {
  return missingFields.filter((field) => {
    const normalized = normalizeMissingField(field);
    if (normalized === 'first_name') return !update.firstName;
    if (normalized === 'last_name') return !update.lastName;
    if (normalized === 'username') return !update.username;
    if (normalized === 'legal_accepted') return update.legalAccepted !== true;
    return true;
  });
}

export function SocialAuthContinue() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const navigate = useNavigate();
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  async function completeSignup() {
    try {
      if (!signUp || !setActive) {
        throw new Error('Authentication is still loading. Please try again.');
      }

      const existingSessionId = getCreatedSessionId(signUp);
      if (existingSessionId) {
        await setActive({ session: existingSessionId });
        promotePendingSocialAuth(existingSessionId);
        navigate(AFTER_AUTH_URL, { replace: true });
        return;
      }

      if (signUp.status !== 'missing_requirements') {
        throw new Error('Additional account information is required before continuing.');
      }

      const missingFields = getMissingFields(signUp);
      const update = buildUpdate(signUp);
      const remainingUnpatched = unpatchedFields(missingFields, update);
      if (remainingUnpatched.length > 0) {
        throw new Error(missingRequirementsMessage(remainingUnpatched));
      }

      const updated = await signUp.update(update);
      const sessionId = getCreatedSessionId(updated) ?? getCreatedSessionId(signUp);
      if (!sessionId) {
        const remainingFields = getMissingFields(updated);
        throw new Error(
          missingRequirementsMessage(remainingFields.length > 0 ? remainingFields : missingFields),
        );
      }

      await setActive({ session: sessionId });
      promotePendingSocialAuth(sessionId);
      navigate(AFTER_AUTH_URL, { replace: true });
    } catch (err) {
      clearPendingSocialAuth();
      setError(clerkErrorMessage(err, 'Unable to finish social sign in. Please try again.'));
    }
  }

  if (isLoaded && !startedRef.current) {
    startedRef.current = true;
    void completeSignup();
  }

  if (!isLoaded || !error) {
    return <Splash label="Signing you in..." />;
  }

  return (
    <main className="auth-page auth-page--split">
      <section className="auth-card">
        <BackButton onClick={() => navigate('/sign-in', { replace: true })} label="Back to sign in" />
        <h1>Finish sign in</h1>
        <p>We could not finish your social sign in automatically.</p>
        <AuthError message={error} />
      </section>
    </main>
  );
}

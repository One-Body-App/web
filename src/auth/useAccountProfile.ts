import { ApiError } from '@/api/client';
import { useApiQuery } from '@/api/useApi';
import { endpoints, type MyProfile } from '@/api/endpoints';
import { useAuth } from './context';

interface AccountProfileState {
  profile: MyProfile | null;
  loading: boolean;
  error: ApiError | null;
  refetch: () => void;
}

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError('Unable to load your account.', 0, error);
}

export function useAccountProfile(): AccountProfileState {
  const { clerkEnabled, isLoaded, isSignedIn, user } = useAuth();
  const enabled = Boolean(isLoaded && isSignedIn && clerkEnabled && user);
  const query = useApiQuery<MyProfile>(
    async (signal) => {
      if (!user) throw new ApiError('Unable to load your account.', 0, null);
      await endpoints.syncClerkUser(
        {
          name: user.fullName,
          username: user.username,
          accountType: user.accountType,
        },
        signal,
      );
      return endpoints.getMyProfileMapped(signal);
    },
    {
      enabled,
      deps: [
        clerkEnabled,
        isLoaded,
        isSignedIn,
        user?.accountType,
        user?.email,
        user?.fullName,
        user?.id,
        user?.username,
      ],
    },
  );

  return {
    profile: enabled ? query.data ?? null : null,
    loading: enabled ? query.loading : false,
    error: enabled && query.error ? toApiError(query.error) : null,
    refetch: query.refetch,
  };
}

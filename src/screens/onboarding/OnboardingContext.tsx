import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ApiError } from '@/api/client';
import { endpoints, type InterestTag, type OrganizationType } from '@/api/endpoints';
import { geocodeAddress } from '@/api/connect';
import {
  buildOrganizationCategoryGroups,
  type OrganizationCategoryGroup,
  type OrganizationSubtypeOption,
} from '@/utils/organizationCategories';
import { useAccountProfileContext } from '@/auth/AccountProfileContext';
import type { OBUser } from '@/data/mock';

interface SuggestedUser {
  id: string;
  name: string;
  username: string;
  avatar: string;
}

interface OnboardingContextValue {
  isOrganization: boolean;

  loadingOptions: boolean;
  optionsError: string | null;
  loadOptions: () => Promise<void>;

  submitting: boolean;
  submitError: string | null;
  setSubmitError: (value: string | null) => void;

  // Individual
  years: string[];
  year: string;
  setYear: (value: string) => void;
  city: string;
  setCity: (value: string) => void;
  // Church (hidden steps — carried but unset unless those steps are re-enabled)
  churchTypeId: string;
  setChurchTypeId: (value: string) => void;
  attendance: string;
  setAttendance: (value: string) => void;

  // Organization
  organizationGroups: OrganizationCategoryGroup[];
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  selectedOrganizationType: string;
  setSelectedOrganizationType: (value: string) => void;
  selectedGroup?: OrganizationCategoryGroup;
  selectedSubtype?: OrganizationSubtypeOption;
  organizationName: string;
  setOrganizationName: (value: string) => void;
  contactName: string;
  setContactName: (value: string) => void;
  contactEmail: string;
  setContactEmail: (value: string) => void;
  contactPhone: string;
  setContactPhone: (value: string) => void;

  // Shared
  interests: InterestTag[];
  selectedInterests: string[];
  toggleInterest: (id: string) => void;
  suggestedUsers: SuggestedUser[];
  suggestionsReady: boolean;
  loadingSuggestions: boolean;
  loadingMoreSuggestions: boolean;
  hasMoreSuggestions: boolean;
  suggestionsError: string | null;
  loadSuggestedUsers: () => Promise<void>;
  loadMoreSuggestedUsers: () => Promise<void>;
  selectedFollows: string[];
  toggleFollow: (id: string) => void;

  submitOnboarding: () => Promise<boolean>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);
const SUGGESTIONS_PAGE_SIZE = 24;

function currentYearOptions(): string[] {
  const currentYear = new Date().getFullYear();
  const maxYear = currentYear - 7;
  const minYear = currentYear - 90;
  const years: string[] = [];
  for (let year = maxYear; year >= minYear; year -= 1) {
    years.push(String(year));
  }
  return years;
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message || fallback;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

function selectedValuesKey(values: string[]) {
  if (values.length === 0) return '';
  if (values.length === 1) return values[0];
  return values.slice().sort().join(',');
}

function mapSuggestedUser(item: OBUser): SuggestedUser {
  return {
    id: item.id,
    name: item.name,
    username: item.username,
    avatar: item.avatar,
  };
}

/**
 * Holds every onboarding answer across the per-URL steps (which would otherwise
 * lose local state on navigation) and owns the single end-of-flow submit. The
 * answer state + submit sequence are ported from the original inline
 * OnboardingGate; the only addition is geocoding the city to real coordinates.
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { profile, refetch } = useAccountProfileContext();
  const isOrganization = profile?.accountType === 'organization';
  const years = useMemo(currentYearOptions, []);

  const [year, setYear] = useState(years[11] ?? years[0] ?? '');
  const [city, setCity] = useState(profile?.profile?.location?.address ?? '');
  const [churchTypeId, setChurchTypeId] = useState(profile?.profile?.churchType ?? '');
  const [attendance, setAttendance] = useState(profile?.profile?.churchAttendance ?? '');
  const [organizationTypes, setOrganizationTypes] = useState<OrganizationType[]>([]);
  const [selectedCategory, setSelectedCategoryState] = useState('');
  const [selectedOrganizationType, setSelectedOrganizationType] = useState('');
  const [organizationName, setOrganizationName] = useState(profile?.name ?? '');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState(profile?.email ?? '');
  const [contactPhone, setContactPhone] = useState('');
  const [interests, setInterests] = useState<InterestTag[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [selectedFollows, setSelectedFollows] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingMoreSuggestions, setLoadingMoreSuggestions] = useState(false);
  const [hasMoreSuggestions, setHasMoreSuggestions] = useState(true);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const optionsKey = isOrganization ? 'organization' : 'individual';
  const loadedOptionsKeyRef = useRef('');
  const selectedInterestsKey = selectedValuesKey(selectedInterests);
  const loadedSuggestionsKeyRef = useRef('');
  const loadingSuggestionsRef = useRef(false);
  const suggestedUserIdsRef = useRef<Set<string>>(new Set());
  const suggestionsPageRef = useRef(1);
  const suggestionsRequestIdRef = useRef(0);

  const organizationGroups = useMemo(
    () => buildOrganizationCategoryGroups(organizationTypes),
    [organizationTypes],
  );
  const selectedGroup = organizationGroups.find((group) => group.value === selectedCategory);
  const selectedSubtype = selectedGroup?.subtypes.find(
    (item) => item.organizationTypeId === selectedOrganizationType,
  );

  const setSelectedCategory = useCallback(
    (value: string) => {
      setSelectedCategoryState(value);
      const group = organizationGroups.find((item) => item.value === value);
      setSelectedOrganizationType(group?.subtypes[0]?.organizationTypeId ?? '');
    },
    [organizationGroups],
  );

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    setOptionsError(null);
    try {
      const [nextInterests, nextOrganizationTypes] = await Promise.all([
        endpoints.getInterestTags(),
        isOrganization ? endpoints.getOrganizationTypes() : Promise.resolve([]),
      ]);
      setInterests(nextInterests);
      setOrganizationTypes(nextOrganizationTypes);
    } catch (err) {
      setOptionsError(apiErrorMessage(err, 'Unable to load onboarding options.'));
    } finally {
      setLoadingOptions(false);
    }
  }, [isOrganization]);

  const loadSuggestedUsers = useCallback(async () => {
    const requestKey = selectedValuesKey(selectedInterests);
    if (loadingSuggestionsRef.current || loadedSuggestionsKeyRef.current === requestKey) {
      return;
    }
    loadingSuggestionsRef.current = true;
    const requestId = suggestionsRequestIdRef.current + 1;
    suggestionsRequestIdRef.current = requestId;
    setLoadingSuggestions(true);
    setLoadingMoreSuggestions(false);
    setSuggestionsError(null);
    try {
      const nextSuggestedUsers = await endpoints.getSuggestedUsers(
        selectedInterests,
        1,
        SUGGESTIONS_PAGE_SIZE,
      );
      if (requestId !== suggestionsRequestIdRef.current) {
        return;
      }
      const mappedUsers = nextSuggestedUsers.map(mapSuggestedUser);
      suggestedUserIdsRef.current = new Set(mappedUsers.map((item) => item.id));
      suggestionsPageRef.current = 1;
      loadedSuggestionsKeyRef.current = requestKey;
      setSuggestedUsers(mappedUsers);
      setHasMoreSuggestions(nextSuggestedUsers.length === SUGGESTIONS_PAGE_SIZE);
    } catch (err) {
      if (requestId === suggestionsRequestIdRef.current) {
        setHasMoreSuggestions(false);
        setSuggestionsError(apiErrorMessage(err, 'Unable to load people suggestions.'));
      }
    } finally {
      if (requestId === suggestionsRequestIdRef.current) {
        loadingSuggestionsRef.current = false;
        setLoadingSuggestions(false);
      }
    }
  }, [selectedInterests]);

  const loadMoreSuggestedUsers = useCallback(async () => {
    const requestKey = selectedValuesKey(selectedInterests);
    if (
      loadingSuggestionsRef.current ||
      loadedSuggestionsKeyRef.current !== requestKey ||
      !hasMoreSuggestions
    ) {
      return;
    }

    loadingSuggestionsRef.current = true;
    const requestId = suggestionsRequestIdRef.current + 1;
    suggestionsRequestIdRef.current = requestId;
    const nextPage = suggestionsPageRef.current + 1;
    setLoadingMoreSuggestions(true);
    setSuggestionsError(null);
    try {
      const nextSuggestedUsers = await endpoints.getSuggestedUsers(
        selectedInterests,
        nextPage,
        SUGGESTIONS_PAGE_SIZE,
      );
      if (requestId !== suggestionsRequestIdRef.current) {
        return;
      }
      const mappedUsers = nextSuggestedUsers.map(mapSuggestedUser);
      setSuggestedUsers((previous) => {
        const merged = [...previous];
        const nextIds = new Set(suggestedUserIdsRef.current);

        mappedUsers.forEach((item) => {
          if (nextIds.has(item.id)) {
            return;
          }
          nextIds.add(item.id);
          merged.push(item);
        });

        suggestedUserIdsRef.current = nextIds;
        return merged;
      });
      suggestionsPageRef.current = nextPage;
      setHasMoreSuggestions(nextSuggestedUsers.length === SUGGESTIONS_PAGE_SIZE);
    } catch {
      // Keep the loaded grid visible; the next scroll near the end can retry this page.
    } finally {
      if (requestId === suggestionsRequestIdRef.current) {
        loadingSuggestionsRef.current = false;
        setLoadingMoreSuggestions(false);
      }
    }
  }, [hasMoreSuggestions, selectedInterests]);

  // Load options once per account-type (no useEffect per project rule).
  if (loadedOptionsKeyRef.current !== optionsKey) {
    loadedOptionsKeyRef.current = optionsKey;
    void loadOptions();
  }

  // Default the org category once the groups arrive.
  if (isOrganization && !selectedCategory && organizationGroups.length > 0) {
    const defaultGroup = organizationGroups[0];
    setSelectedCategoryState(defaultGroup.value);
    setSelectedOrganizationType(defaultGroup.subtypes[0]?.organizationTypeId ?? '');
  }

  const toggleInterest = useCallback((id: string) => {
    suggestionsRequestIdRef.current += 1;
    loadedSuggestionsKeyRef.current = '';
    loadingSuggestionsRef.current = false;
    suggestedUserIdsRef.current = new Set();
    suggestionsPageRef.current = 1;
    setLoadingSuggestions(false);
    setLoadingMoreSuggestions(false);
    setHasMoreSuggestions(true);
    setSuggestionsError(null);
    setSuggestedUsers([]);
    setSelectedInterests((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
    );
  }, []);

  const toggleFollow = useCallback((id: string) => {
    setSelectedFollows((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
    );
  }, []);

  const submitOnboarding = useCallback(async (): Promise<boolean> => {
    if (submitting) return false;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (selectedInterests.length > 0) {
        await endpoints.addInterests(selectedInterests);
      }
      if (selectedFollows.length > 0) {
        await endpoints.addFollowing(selectedFollows);
      }

      const body: Record<string, unknown> = {
        markProfileCompleted: true,
      };

      const normalizedCity = city.trim();
      if (normalizedCity) {
        const coordinates = await geocodeAddress(normalizedCity);
        body.location = {
          address: normalizedCity,
          longitude: coordinates?.[0] ?? 0,
          latitude: coordinates?.[1] ?? 0,
        };
      }

      if (isOrganization) {
        body.organizationCategory = selectedCategory;
        body.organizationSubType = selectedSubtype?.label;
        body.typeOfOrganization = selectedOrganizationType;
        body.companyName = organizationName.trim();
        body.contactName = contactName.trim();
        body.contactEmail = contactEmail.trim();
        if (contactPhone.trim()) {
          body.contactPhoneNumber = contactPhone.trim();
        }
      } else {
        body.dateOfBirth = year;
        // Hidden steps: only sent if those steps get re-enabled and populated.
        if (churchTypeId) body.churchType = churchTypeId;
        if (attendance) body.churchAttendance = attendance;
      }

      await endpoints.updateProfile(body);
      refetch();
      return true;
    } catch (err) {
      setSubmitError(apiErrorMessage(err, 'Unable to complete onboarding.'));
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [
    attendance,
    churchTypeId,
    city,
    contactEmail,
    contactName,
    contactPhone,
    isOrganization,
    organizationName,
    refetch,
    selectedCategory,
    selectedFollows,
    selectedInterests,
    selectedOrganizationType,
    selectedSubtype?.label,
    submitting,
    year,
  ]);

  const value: OnboardingContextValue = {
    isOrganization: Boolean(isOrganization),
    loadingOptions,
    optionsError,
    loadOptions,
    submitting,
    submitError,
    setSubmitError,
    years,
    year,
    setYear,
    city,
    setCity,
    churchTypeId,
    setChurchTypeId,
    attendance,
    setAttendance,
    organizationGroups,
    selectedCategory,
    setSelectedCategory,
    selectedOrganizationType,
    setSelectedOrganizationType,
    selectedGroup,
    selectedSubtype,
    organizationName,
    setOrganizationName,
    contactName,
    setContactName,
    contactEmail,
    setContactEmail,
    contactPhone,
    setContactPhone,
    interests,
    selectedInterests,
    toggleInterest,
    suggestedUsers,
    suggestionsReady: loadedSuggestionsKeyRef.current === selectedInterestsKey,
    loadingSuggestions,
    loadingMoreSuggestions,
    hasMoreSuggestions,
    suggestionsError,
    loadSuggestedUsers,
    loadMoreSuggestedUsers,
    selectedFollows,
    toggleFollow,
    submitOnboarding,
  };

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used within <OnboardingProvider>');
  }
  return ctx;
}

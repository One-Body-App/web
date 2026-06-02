import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Loader2 } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { TextField } from '@/components/auth/AuthControls';
import { ImageCropModal } from '@/components/ImageCropModal';
import { ScripturePickerDrawer } from '@/components/scripture/ScripturePickerDrawer';
import { buildScriptureKey, type ScriptureShare } from '@/api/scripture';
import { endpoints, type MyProfile, type InterestTag, type ChurchType } from '@/api/endpoints';
import { geocodeAddress } from '@/api/connect';
import { useApiQuery } from '@/api/useApi';
import { ApiError } from '@/api/client';
import { useAccountProfileContext } from '@/auth/AccountProfileContext';
import { buildOrganizationCategoryGroups } from '@/utils/organizationCategories';
import type { OrganizationType } from '@/api/endpoints';
import './EditProfile.css';

const URL_REGEX = /^[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)$/i;

const ATTENDANCE_OPTIONS = ['Weekly', 'Bi-Weekly', 'Once a month', 'I only watch at home'];
const ORG_SIZE_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'mega', label: 'Mega' },
];

const BIRTH_YEARS = (() => {
  const current = new Date().getFullYear();
  return Array.from({ length: 88 }, (_, i) => String(current - 13 - i));
})();

/** Build a ScriptureShare (needs a key) from the stored VerseResult-shaped favoriteVerse. */
function toShare(verse: MyProfile['favoriteVerse']): ScriptureShare | null {
  if (!verse) return null;
  return {
    ...verse,
    key: buildScriptureKey(verse.book, verse.chapter, verse.verse, verse.verseEnd),
  };
}

type CropTarget = 'avatar' | 'header';

export function EditProfile() {
  const navigate = useNavigate();
  const { refetch } = useAccountProfileContext();

  const profileQ = useApiQuery(() => endpoints.getMyProfileMapped());
  const interestsQ = useApiQuery<InterestTag[]>(() => endpoints.getInterestTags(), { fallback: [] });
  const professionsQ = useApiQuery<InterestTag[]>(() => endpoints.getProfessionTags(), { fallback: [] });
  const churchTypesQ = useApiQuery<ChurchType[]>(() => endpoints.getChurchTypes(), { fallback: [] });
  const orgTypesQ = useApiQuery<OrganizationType[]>(() => endpoints.getOrganizationTypes(), { fallback: [] });

  if (profileQ.loading && !profileQ.data) {
    return (
      <div className="edit-profile edit-profile--loading">
        <Loader2 className="edit-profile__spin" />
      </div>
    );
  }

  const profile = profileQ.data;
  if (!profile) {
    return (
      <div className="edit-profile edit-profile--loading">
        <p>Could not load your profile. Please try again.</p>
      </div>
    );
  }

  return (
    <EditProfileForm
      profile={profile}
      interests={interestsQ.data ?? []}
      professions={professionsQ.data ?? []}
      churchTypes={churchTypesQ.data ?? []}
      organizationTypes={orgTypesQ.data ?? []}
      onDone={() => {
        refetch();
        navigate('/profile');
      }}
      onCancel={() => navigate('/profile')}
    />
  );
}

function EditProfileForm({
  profile,
  interests,
  professions,
  churchTypes,
  organizationTypes,
  onDone,
  onCancel,
}: {
  profile: MyProfile;
  interests: InterestTag[];
  professions: InterestTag[];
  churchTypes: ChurchType[];
  organizationTypes: OrganizationType[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const isOrganization = profile.accountType === 'organization';
  const p = profile.profile;

  const [name, setName] = useState(isOrganization ? (p?.companyName ?? profile.name) : profile.name);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [website, setWebsite] = useState(profile.website ?? '');
  const [favoriteVerse, setFavoriteVerse] = useState<ScriptureShare | null>(toShare(profile.favoriteVerse));
  const [versePickerOpen, setVersePickerOpen] = useState(false);

  const [city, setCity] = useState(p?.location?.address ?? '');
  const [locationPublic, setLocationPublic] = useState(Boolean(p?.isLocationPublic));

  const [birthYear, setBirthYear] = useState(() => {
    const raw = p?.dateOfBirth ?? '';
    const match = raw.match(/\d{4}/);
    return match ? match[0] : '';
  });
  const [whatIDo, setWhatIDo] = useState(p?.whatIDo?._id ?? p?.whatIDo?.id ?? '');
  const [churchType, setChurchType] = useState(p?.churchType ?? '');
  const [churchSubType, setChurchSubType] = useState(p?.churchSubType ?? '');
  const [attendance, setAttendance] = useState(p?.oftenChurch ?? p?.churchAttendance ?? '');
  const [churchPublic, setChurchPublic] = useState(Boolean(p?.isChurchTypePublic));

  const orgGroups = useMemo(() => buildOrganizationCategoryGroups(organizationTypes), [organizationTypes]);
  const [orgCategory, setOrgCategory] = useState(p?.organizationCategory ?? '');
  const [orgTypeId, setOrgTypeId] = useState(p?.typeOfOrganization?._id ?? p?.typeOfOrganization?.id ?? '');
  const [contactName, setContactName] = useState(p?.contactName ?? '');
  const [contactEmail, setContactEmail] = useState(p?.contactEmail ?? '');
  const [contactPhone, setContactPhone] = useState(p?.contactPhoneNumber ?? '');
  const [orgSize, setOrgSize] = useState(p?.organizationSize ?? '');

  const initialInterestIds = useMemo(() => profile.interests.map((i) => i.id), [profile.interests]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(initialInterestIds);

  // Avatar / header image local state.
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar);
  const [headerPreview, setHeaderPreview] = useState('');
  const avatarFileRef = useRef<File | null>(null);
  const headerFileRef = useRef<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);
  const [cropSrc, setCropSrc] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const websiteInvalid = website.trim().length > 0 && !URL_REGEX.test(website.trim());

  const activeGroup = orgGroups.find((g) => g.value === orgCategory);

  function pickFile(target: CropTarget) {
    (target === 'avatar' ? avatarInputRef : headerInputRef).current?.click();
  }

  function onFileChange(target: CropTarget, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setCropSrc(URL.createObjectURL(file));
    setCropTarget(target);
  }

  function onCropConfirm(file: File, previewUrl: string) {
    if (cropTarget === 'avatar') {
      avatarFileRef.current = file;
      setAvatarPreview(previewUrl);
    } else if (cropTarget === 'header') {
      headerFileRef.current = file;
      setHeaderPreview(previewUrl);
    }
    setCropTarget(null);
    setCropSrc('');
  }

  function toggleInterest(id: string) {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSubmit() {
    if (websiteInvalid) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (username.trim()) body.username = username.trim();
      if (bio) body.bio = bio;
      if (website.trim()) body.website = website.trim();

      if (isOrganization) {
        if (name.trim()) body.companyName = name.trim();
        if (orgCategory) body.organizationCategory = orgCategory;
        if (orgTypeId) {
          body.typeOfOrganization = orgTypeId;
          const subtype = activeGroup?.subtypes.find((s) => s.organizationTypeId === orgTypeId);
          if (subtype) body.organizationSubType = subtype.label;
        }
        if (contactName.trim()) body.contactName = contactName.trim();
        if (contactEmail.trim()) body.contactEmail = contactEmail.trim();
        if (contactPhone.trim()) body.contactPhoneNumber = contactPhone.trim();
        if (orgSize) body.organizationSize = orgSize;
      } else {
        if (name.trim()) body.name = name.trim();
        if (birthYear) body.dateOfBirth = birthYear;
        if (whatIDo) body.whatIDo = whatIDo;
        if (churchType) body.churchType = churchType;
        body.churchSubType = churchSubType.trim();
        if (attendance) body.oftenChurch = attendance;
        // The API coerces these flags with `value === 'true'`, so send strings.
        body.isChurchTypePublic = String(churchPublic);
      }

      body.isLocationPublic = String(locationPublic);

      const normalizedCity = city.trim();
      if (normalizedCity) {
        const coordinates = await geocodeAddress(normalizedCity);
        body.location = {
          address: normalizedCity,
          longitude: coordinates?.[0] ?? 0,
          latitude: coordinates?.[1] ?? 0,
        };
      }

      if (favoriteVerse) {
        body.favoriteVerse = {
          book: favoriteVerse.book,
          chapter: favoriteVerse.chapter,
          verse: favoriteVerse.verse,
          verseEnd: favoriteVerse.verseEnd,
          translation: favoriteVerse.translation,
        };
      } else if (profile.favoriteVerse) {
        body.removeFavoriteVerse = true;
      }

      // Interests use their own endpoint, mirroring onboarding.
      const interestsChanged =
        selectedInterests.length !== initialInterestIds.length ||
        selectedInterests.some((id) => !initialInterestIds.includes(id));
      if (interestsChanged && selectedInterests.length > 0) {
        await endpoints.addInterests(selectedInterests);
      }

      // Send text + nested fields as JSON (validated nested objects).
      await endpoints.updateProfile(body);

      // Images go in a separate multipart request to keep nested-object
      // validation simple; markProfileCompleted keeps the body non-empty.
      if (avatarFileRef.current || headerFileRef.current) {
        const form = new FormData();
        form.append('markProfileCompleted', 'true');
        if (avatarFileRef.current) form.append('photo', avatarFileRef.current, avatarFileRef.current.name);
        if (headerFileRef.current) form.append('headerImage', headerFileRef.current, headerFileRef.current.name);
        await endpoints.updateProfile(form);
      }

      onDone();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Could not save your profile. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="edit-profile">
      <header className="edit-profile__bar">
        <button type="button" className="iconbtn" aria-label="Back" onClick={onCancel}>
          <ArrowLeft size={20} />
        </button>
        <h1>Edit profile</h1>
        <button type="button" className="btn btn--brand btn--sm" onClick={handleSubmit} disabled={submitting || websiteInvalid}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </header>

      {/* Header + avatar images */}
      <div className="edit-profile__cover" style={headerPreview ? { backgroundImage: `url(${headerPreview})` } : undefined}>
        <button type="button" className="edit-profile__cover-btn" onClick={() => pickFile('header')}>
          <Camera size={16} /> Edit cover
        </button>
        <div className="edit-profile__avatar">
          <Avatar src={avatarPreview} alt={name} size={96} ring />
          <button type="button" className="edit-profile__avatar-btn" aria-label="Edit photo" onClick={() => pickFile('avatar')}>
            <Camera size={16} />
          </button>
        </div>
      </div>

      <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={(e) => onFileChange('avatar', e)} />
      <input ref={headerInputRef} type="file" accept="image/*" hidden onChange={(e) => onFileChange('header', e)} />

      <div className="edit-profile__body">
        {error ? <p className="edit-profile__error">{error}</p> : null}

        <section className="edit-profile__section">
          <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" />
          <TextField
            label={isOrganization ? 'Organization name' : 'Name'}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label className="field">
            <span className="field__label">Bio</span>
            <textarea
              className="edit-profile__textarea"
              maxLength={150}
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell people a little about you"
            />
            <span className="edit-profile__counter">{bio.length}/150</span>
          </label>

          <div className="field">
            <span className="field__label">Favorite verse</span>
            {favoriteVerse ? (
              <div className="edit-profile__verse">
                <div>
                  <strong>{favoriteVerse.reference}</strong>
                  <span>{favoriteVerse.translation}</span>
                </div>
                <button type="button" className="btn btn--outline btn--sm" onClick={() => setVersePickerOpen((o) => !o)}>
                  Change
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn--outline btn--sm" onClick={() => setVersePickerOpen((o) => !o)}>
                Pick a verse
              </button>
            )}
            <ScripturePickerDrawer
              open={versePickerOpen}
              selected={favoriteVerse}
              onSelect={(share) => {
                setFavoriteVerse(share);
                setVersePickerOpen(false);
              }}
              onClear={() => setFavoriteVerse(null)}
            />
          </div>

          <TextField label="Location" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City, State" />
          <label className="edit-profile__toggle">
            <input type="checkbox" checked={locationPublic} onChange={(e) => setLocationPublic(e.target.checked)} />
            <span>Make my location public</span>
          </label>

          <TextField
            label="Website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            error={websiteInvalid ? 'Enter a valid URL' : undefined}
            placeholder="example.com"
          />
        </section>

        {!isOrganization ? (
          <section className="edit-profile__section">
            <h2>Faith & details</h2>
            <label className="field">
              <span className="field__label">Birth year</span>
              <select className="edit-profile__select" value={birthYear} onChange={(e) => setBirthYear(e.target.value)}>
                <option value="">Select year</option>
                {BIRTH_YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">What I do</span>
              <select className="edit-profile__select" value={whatIDo} onChange={(e) => setWhatIDo(e.target.value)}>
                <option value="">Select</option>
                {professions.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">Church type</span>
              <select className="edit-profile__select" value={churchType} onChange={(e) => setChurchType(e.target.value)}>
                <option value="">Select</option>
                {churchTypes.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </label>

            <TextField label="Denomination / sub type" value={churchSubType} onChange={(e) => setChurchSubType(e.target.value)} />

            <label className="field">
              <span className="field__label">How often I attend</span>
              <select className="edit-profile__select" value={attendance} onChange={(e) => setAttendance(e.target.value)}>
                <option value="">Select</option>
                {ATTENDANCE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </label>

            <label className="edit-profile__toggle">
              <input type="checkbox" checked={churchPublic} onChange={(e) => setChurchPublic(e.target.checked)} />
              <span>Make my church type public</span>
            </label>
          </section>
        ) : (
          <section className="edit-profile__section">
            <h2>Organization</h2>
            <label className="field">
              <span className="field__label">Category</span>
              <select
                className="edit-profile__select"
                value={orgCategory}
                onChange={(e) => {
                  setOrgCategory(e.target.value);
                  setOrgTypeId('');
                }}
              >
                <option value="">Select</option>
                {orgGroups.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </label>

            {activeGroup ? (
              <label className="field">
                <span className="field__label">Type</span>
                <select className="edit-profile__select" value={orgTypeId} onChange={(e) => setOrgTypeId(e.target.value)}>
                  <option value="">Select</option>
                  {activeGroup.subtypes.map((s) => (
                    <option key={s.organizationTypeId} value={s.organizationTypeId}>{s.label}</option>
                  ))}
                </select>
              </label>
            ) : null}

            <TextField label="Contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            <TextField label="Contact email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            <TextField label="Contact phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />

            <label className="field">
              <span className="field__label">Organization size</span>
              <select className="edit-profile__select" value={orgSize} onChange={(e) => setOrgSize(e.target.value)}>
                <option value="">Select</option>
                {ORG_SIZE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </section>
        )}

        <section className="edit-profile__section">
          <h2>Interests</h2>
          <div className="edit-profile__chips">
            {interests.map((tag) => {
              const active = selectedInterests.includes(tag._id);
              return active ? (
                <button
                  key={tag._id}
                  type="button"
                  className="edit-profile__chip is-selected"
                  aria-pressed="true"
                  onClick={() => toggleInterest(tag._id)}
                >
                  {tag.name}
                </button>
              ) : (
                <button
                  key={tag._id}
                  type="button"
                  className="edit-profile__chip"
                  aria-pressed="false"
                  onClick={() => toggleInterest(tag._id)}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {cropTarget ? (
        <ImageCropModal
          open
          imageSrc={cropSrc}
          aspect={cropTarget === 'avatar' ? 1 : 16 / 9}
          cropShape={cropTarget === 'avatar' ? 'round' : 'rect'}
          fileName={cropTarget === 'avatar' ? 'avatar.jpg' : 'header.jpg'}
          maxSize={cropTarget === 'avatar' ? 512 : 1280}
          onCancel={() => {
            setCropTarget(null);
            setCropSrc('');
          }}
          onConfirm={onCropConfirm}
        />
      ) : null}
    </div>
  );
}

export default EditProfile;

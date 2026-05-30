import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, type Location } from 'react-router-dom';
import { clerkEnabled, useAuth } from './auth/context';
import { RequireAuth } from './auth/RequireAuth';
import { AppShell } from './layout/AppShell';
import { Splash } from './components/Splash';

import { Intro } from './screens/Intro';
import { SignInScreen } from './screens/SignIn';
import { SignUpScreen } from './screens/SignUp';
import { SsoCallback } from './screens/SsoCallback';

const Home = lazy(() => import('./screens/Home').then((m) => ({ default: m.Home })));
const Explore = lazy(() => import('./screens/Explore').then((m) => ({ default: m.Explore })));
// Watch pulls in hls.js (~400KB) — load it only when its route is visited.
const Watch = lazy(() => import('./screens/Watch').then((m) => ({ default: m.Watch })));
// Connect can pull in map UI. Keep it out of the initial authenticated shell.
const Connect = lazy(() => import('./screens/Connect').then((m) => ({ default: m.Connect })));
const PrayerWall = lazy(() => import('./screens/PrayerWall').then((m) => ({ default: m.PrayerWall })));
const ConnectManage = lazy(() => import('./screens/connect/Manage').then((m) => ({ default: m.ConnectManage })));
const CreateEvent = lazy(() => import('./screens/connect/CreateEvent').then((m) => ({ default: m.CreateEvent })));
const PostJob = lazy(() => import('./screens/connect/PostJob').then((m) => ({ default: m.PostJob })));
const EventDetail = lazy(() => import('./screens/connect/EventDetail').then((m) => ({ default: m.EventDetail })));
const JobDetail = lazy(() => import('./screens/connect/JobDetail').then((m) => ({ default: m.JobDetail })));
const JobApply = lazy(() => import('./screens/connect/JobApply').then((m) => ({ default: m.JobApply })));
const JobApplications = lazy(() =>
  import('./screens/connect/JobApplications').then((m) => ({ default: m.JobApplications })),
);
const Messages = lazy(() => import('./screens/Messages').then((m) => ({ default: m.Messages })));
const Conversation = lazy(() =>
  import('./screens/Conversation').then((m) => ({ default: m.Conversation })),
);
const Notifications = lazy(() =>
  import('./screens/Notifications').then((m) => ({ default: m.Notifications })),
);
const Saved = lazy(() => import('./screens/Saved').then((m) => ({ default: m.Saved })));
const Profile = lazy(() => import('./screens/Profile').then((m) => ({ default: m.Profile })));
const Settings = lazy(() => import('./screens/Settings').then((m) => ({ default: m.Settings })));
const PostDetail = lazy(() => import('./screens/PostDetail').then((m) => ({ default: m.PostDetail })));
const CreatePost = lazy(() => import('./screens/CreatePost').then((m) => ({ default: m.CreatePost })));

/** Public landing — sends signed-in users straight to the feed. */
function Root() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <Splash label="One Body" />;
  if (isSignedIn) return <Navigate to="/home" replace />;
  return <Intro />;
}

/**
 * React Router's modal pattern. The "Post" button stamps the current location
 * onto `state.backgroundLocation` before navigating to `/post/new`. The main
 * `<Routes>` reads that background so the feed (or wherever the user came
 * from) stays mounted underneath, and a second `<Routes>` paints the modal
 * composer on top. For deep links straight to `/post/new`, we synthesize a
 * `/home` background so the composer never floats over a blank void.
 */
function isModalPath(pathname: string): boolean {
  return pathname === '/post/new';
}

function deferred(label: string, children: ReactNode) {
  return <Suspense fallback={<Splash label={label} />}>{children}</Suspense>;
}

export function App() {
  const location = useLocation();
  const state = (location.state as { backgroundLocation?: Location } | null) ?? null;
  const isModal = isModalPath(location.pathname);
  // When deep-linking straight to a modal route there's no backgroundLocation;
  // fall back to /home so the modal always has something to sit on top of.
  const backgroundLocation =
    state?.backgroundLocation ?? (isModal ? { ...location, pathname: '/home' } : undefined);

  return (
    <>
      <Routes location={backgroundLocation ?? location}>
        <Route path="/" element={<Root />} />
        <Route path="/sign-in/*" element={<SignInScreen />} />
        <Route path="/sign-up/*" element={<SignUpScreen />} />
        {clerkEnabled ? <Route path="/sso-callback" element={<SsoCallback />} /> : null}

        {/* Authenticated app shell */}
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/home" element={deferred('Home', <Home />)} />
          <Route path="/explore" element={deferred('Explore', <Explore />)} />
          <Route path="/prayer" element={deferred('Prayer', <PrayerWall />)} />
          <Route path="/watch" element={deferred('Watch', <Watch />)} />
          <Route path="/connect" element={deferred('Connect', <Connect />)} />
          <Route path="/connect/manage" element={deferred('Manage', <ConnectManage />)} />
          <Route path="/connect/manage/events/new" element={deferred('Create Event', <CreateEvent />)} />
          <Route path="/connect/manage/jobs/new" element={deferred('Post Job', <PostJob />)} />
          <Route path="/connect/events/:id" element={deferred('Event', <EventDetail />)} />
          <Route path="/connect/serve/:id" element={deferred('Opportunity', <JobDetail />)} />
          <Route path="/connect/serve/:id/apply" element={deferred('Apply', <JobApply />)} />
          <Route
            path="/connect/serve/:id/applications"
            element={deferred('Applications', <JobApplications />)}
          />
          <Route path="/messages" element={deferred('Messages', <Messages />)} />
          <Route path="/messages/:id" element={deferred('Conversation', <Conversation />)} />
          <Route path="/notifications" element={deferred('Notifications', <Notifications />)} />
          <Route path="/saved" element={deferred('Saved', <Saved />)} />
          <Route path="/profile" element={deferred('Profile', <Profile />)} />
          <Route path="/settings" element={deferred('Settings', <Settings />)} />
          {/* X-style post / comment detail (focused item + flat replies). */}
          <Route path="/post/:type/:id" element={deferred('Post', <PostDetail />)} />
          <Route path="/post/:type/:id/c/:commentId" element={deferred('Post', <PostDetail />)} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Modal layer — read by the real location, painted over whatever the
          main Routes rendered above. Composer dismisses via navigate(-1). */}
      {isModal ? (
        <Routes>
          <Route
            path="/post/new"
            element={
              deferred(
                'Create Post',
                <RequireAuth>
                  <CreatePost />
                </RequireAuth>,
              )
            }
          />
        </Routes>
      ) : null}
    </>
  );
}

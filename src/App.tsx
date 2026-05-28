import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { clerkEnabled, useAuth } from './auth/context';
import { RequireAuth } from './auth/RequireAuth';
import { AppShell } from './layout/AppShell';
import { Splash } from './components/Splash';

import { Intro } from './screens/Intro';
import { SignInScreen } from './screens/SignIn';
import { SignUpScreen } from './screens/SignUp';
import { SsoCallback } from './screens/SsoCallback';
import { Home } from './screens/Home';
import { Explore } from './screens/Explore';
import { Connect } from './screens/Connect';
import { EventDetail } from './screens/connect/EventDetail';
import { JobDetail } from './screens/connect/JobDetail';
import { JobApply } from './screens/connect/JobApply';
import { ConnectManage } from './screens/connect/Manage';
import { CreateEvent } from './screens/connect/CreateEvent';
import { PostJob } from './screens/connect/PostJob';
import { JobApplications } from './screens/connect/JobApplications';
import { Messages } from './screens/Messages';
import { Conversation } from './screens/Conversation';
import { Notifications } from './screens/Notifications';
import { Saved } from './screens/Saved';
import { Profile } from './screens/Profile';
import { CreatePost } from './screens/CreatePost';
import { PostDetail } from './screens/PostDetail';
import { Settings } from './screens/Settings';
import { PrayerWall } from './screens/PrayerWall';

// Watch pulls in hls.js (~400KB) — load it only when its route is visited.
const Watch = lazy(() => import('./screens/Watch').then((m) => ({ default: m.Watch })));

/** Public landing — sends signed-in users straight to the feed. */
function Root() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <Splash label="One Body" />;
  if (isSignedIn) return <Navigate to="/home" replace />;
  return <Intro />;
}

export function App() {
  return (
    <Routes>
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
        <Route path="/home" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/prayer" element={<PrayerWall />} />
        <Route
          path="/watch"
          element={
            <Suspense fallback={<Splash label="Watch" />}>
              <Watch />
            </Suspense>
          }
        />
        <Route path="/connect" element={<Connect />} />
        <Route path="/connect/manage" element={<ConnectManage />} />
        <Route path="/connect/manage/events/new" element={<CreateEvent />} />
        <Route path="/connect/manage/jobs/new" element={<PostJob />} />
        <Route path="/connect/events/:id" element={<EventDetail />} />
        <Route path="/connect/serve/:id" element={<JobDetail />} />
        <Route path="/connect/serve/:id/apply" element={<JobApply />} />
        <Route path="/connect/serve/:id/applications" element={<JobApplications />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/messages/:id" element={<Conversation />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        {/* X-style post / comment detail (focused item + flat replies). */}
        <Route path="/post/:type/:id" element={<PostDetail />} />
        <Route path="/post/:type/:id/c/:commentId" element={<PostDetail />} />
      </Route>

      {/* Full-screen composer (still gated) */}
      <Route
        path="/post/new"
        element={
          <RequireAuth>
            <CreatePost />
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

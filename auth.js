(function () {
  const config = window.AUTH_CONFIG || {};
  const dialog = $('accountDialog');
  let client = null, store = null, user = null, appliedId;
  let mode = 'signin', busy = false, available = false;
  const copiedGuestFor = new Set();
  let unavailableMessage = 'Account sign-in is not available yet. You can keep tracking on this device.';

  const hasData = value => value && (value.txns?.length || Object.values(value.start || {}).some(n => n > 0));
  const redirectTo = () => location.origin + location.pathname;
  const lockTracker = locked => {
    $('trackerContent').inert = locked;
    $('dataTools').inert = locked;
    $('trackerContent').setAttribute('aria-busy', String(locked));
  };
  function message(text = '', error = false) {
    $('authMessage').textContent = text;
    $('authMessage').dataset.error = String(error);
    $('authMessage').hidden = !text;
  }
  function controls() {
    $('authFields').disabled = busy || !available;
    for (const id of ['authGoogle', 'authMicrosoft', 'authForgot']) $(id).disabled = busy || !available;
    for (const id of ['authSignInTab', 'authSignUpTab']) $(id).disabled = busy;
    $('authGoogle').hidden = config.providers?.google === false;
    $('authMicrosoft').hidden = config.providers?.azure === false;
    $('btnSignOut').disabled = busy;
  }
  function setMode(next) {
    mode = next;
    const signup = mode === 'signup', reset = mode === 'reset', update = mode === 'update';
    $('authTitle').textContent = ({ signin: 'Welcome back', signup: 'Make it your meal plan', reset: 'Reset your password', update: 'Choose a new password' })[mode];
    $('authIntro').textContent = reset ? 'We’ll email you a link to choose a new password.'
      : update ? 'Save your new password to finish resetting your account.'
      : 'Save your meal plan and purchases across devices.';
    $('authTabs').hidden = update;
    $('authSignInTab').setAttribute('aria-pressed', String(mode === 'signin'));
    $('authSignUpTab').setAttribute('aria-pressed', String(signup));
    $('authEmailField').hidden = update;
    $('authEmail').required = !update;
    $('authPasswordField').hidden = reset;
    $('authPassword').required = !reset;
    $('authPassword').minLength = signup || update ? 8 : 1;
    $('authPassword').autocomplete = signup || update ? 'new-password' : 'current-password';
    $('authPasswordLabel').textContent = update ? 'New password' : 'Password';
    $('authPassword').value = '';
    $('authConfirm').value = '';
    $('authConfirm').required = signup || update;
    $('authConfirmField').hidden = !(signup || update);
    $('authPasswordHint').hidden = !(signup || update);
    $('authSubmit').textContent = ({ signin: 'Sign in', signup: 'Create account', reset: 'Send reset link', update: 'Save new password' })[mode];
    $('authForgot').hidden = mode !== 'signin';
    $('authSocial').hidden = reset || update || (config.providers?.google === false && config.providers?.azure === false);
    $('authGuest').textContent = user ? 'Back to my tracker' : 'Continue on this device';
    message(available ? '' : unavailableMessage, !available);
    controls();
  }
  function open(next = 'signin') {
    setMode(next);
    if (!dialog.open) dialog.showModal();
  }
  function status(kind, text) {
    $('accountStatus').textContent = text;
    $('accountStatus').dataset.status = kind;
    $('btnSyncRetry').hidden = kind !== 'error' || !user;
    $('btnLoadCloud').hidden = kind !== 'conflict';
    $('guestTransfer').hidden = !(user && store?.ready && !store.conflict && !copiedGuestFor.has(user.id) && hasData(load()));
    lockTracker(busy || (!!user && !store?.ready));
  }

  // The app saves only meal-plan state. Receipt API keys and passwords are excluded.
  window.trackerAccount = {
    get generation() { return store?.generation || 0; },
    save(value) {
      if (user) { store.save(value); return; }
      try {
        localStorage.setItem(STORE, JSON.stringify(value));
        status('guest', 'Guest mode · saved on this device');
      } catch { status('error', 'Could not save on this device. Export your data before closing this page.'); }
    },
  };

  async function sessionChanged(event, session) {
    if (event === 'PASSWORD_RECOVERY') open('update');
    const nextUser = session?.user || null;
    if (appliedId === (nextUser?.id || null)) return;
    appliedId = nextUser?.id || null;
    user = nextUser;
    $('accountName').textContent = user?.email || (user ? 'Your account' : 'Your meal plan, wherever you go');
    $('btnAccount').hidden = !!user;
    $('btnSignOut').hidden = !user;
    $('authForm').reset();
    if (user && mode !== 'update') dialog.close();
    if (!user && mode === 'update') setMode('signin');
    await store.connect(user?.id || null);
  }

  async function submit(event) {
    event.preventDefault();
    if (!available || busy) return;
    const email = $('authEmail').value.trim();
    const password = $('authPassword').value;
    const operation = mode;
    if ((mode === 'signup' || mode === 'update') && password !== $('authConfirm').value) {
      message('The passwords do not match.', true);
      $('authConfirm').focus();
      return;
    }
    busy = true; controls(); message('Please wait…');
    try {
      let result;
      if (operation === 'signin') result = await client.auth.signInWithPassword({ email, password });
      if (operation === 'signup') result = await client.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } });
      if (operation === 'reset') result = await client.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
      if (operation === 'update') result = await client.auth.updateUser({ password });
      if (result.error) throw result.error;
      $('authPassword').value = ''; $('authConfirm').value = '';
      if (operation === 'signup' && !result.data.session) message('Check your email for a confirmation link, then come back to sign in.');
      else if (operation === 'reset') message('If an account uses this email, you’ll receive a password reset link.');
      else if (operation === 'update') { dialog.close(); setMode('signin'); }
      else message('Signed in. Loading your meal history…');
    } catch (error) {
      message(error.message || 'Could not sign in. Please try again.', true);
    } finally { busy = false; controls(); }
  }

  async function social(provider) {
    if (!available || busy) return;
    busy = true; controls(); message('Opening sign-in…');
    try {
      const options = { redirectTo: redirectTo() };
      // Microsoft must return an email address for Supabase Auth.
      if (provider === 'azure') options.scopes = 'email';
      const { error } = await client.auth.signInWithOAuth({ provider, options });
      if (error) throw error;
    } catch (error) { message(error.message || 'Could not open sign-in. Try again.', true); }
    finally { busy = false; controls(); }
  }

  $('btnAccount').addEventListener('click', () => open());
  $('authClose').addEventListener('click', () => dialog.close());
  $('authGuest').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { $('authPassword').value = ''; $('authConfirm').value = ''; });
  $('authSignInTab').addEventListener('click', () => setMode('signin'));
  $('authSignUpTab').addEventListener('click', () => setMode('signup'));
  $('authForgot').addEventListener('click', () => setMode('reset'));
  $('authForm').addEventListener('submit', submit);
  $('authGoogle').addEventListener('click', () => social('google'));
  $('authMicrosoft').addEventListener('click', () => social('azure'));
  $('btnSignOut').addEventListener('click', async () => {
    if (busy) return;
    busy = true; controls();
    lockTracker(true);
    try {
      await store.flush();
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch {
      status(store.conflict ? 'conflict' : 'error', 'Could not sign out. Save or export your unsynced changes and retry.');
    } finally { busy = false; controls(); lockTracker(!!user && !store.ready); }
  });
  $('btnSyncRetry').addEventListener('click', async () => {
    if (!user) return;
    if (!store.ready) await store.connect(user.id);
    else { try { await store.flush(); } catch {} }
  });
  $('btnLoadCloud').addEventListener('click', async () => {
    if (!confirm('Replace the changes in this tab with the cloud version? Export first if you want to keep a copy.')) return;
    lockTracker(true);
    try { await store.loadCloud(); }
    catch { status('conflict', 'Could not load the cloud version. Your changes are still here; try again.'); }
    finally { lockTracker(false); }
  });
  $('btnCopyGuest').addEventListener('click', () => {
    if (!user || !store.ready || store.conflict) return;
    if (!confirm('Copy the meal plan saved on this device into this account? This replaces this account’s current plan and purchases.')) return;
    replaceTrackerState(load());
    copiedGuestFor.add(user.id);
    save();
    $('guestTransfer').hidden = true;
  });
  window.addEventListener('online', () => {
    if (user && !store.ready) store.connect(user.id);
    else store?.flush().catch(() => {});
  });
  window.addEventListener('beforeunload', event => {
    if (!store?.pending) return;
    event.preventDefault(); event.returnValue = '';
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') store?.flush().catch(() => {});
  });

  async function initialize() {
    controls();
    if (!config.supabaseUrl || !config.supabaseKey || !/^https?:$/.test(location.protocol)) return;
    lockTracker(true);
    $('accountStatus').textContent = 'Checking your account…';
    try {
      if (!window.supabase) await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js';
        const timeout = setTimeout(() => { script.remove(); reject(new Error('timeout')); }, 12000);
        script.onload = () => { clearTimeout(timeout); resolve(); };
        script.onerror = () => { clearTimeout(timeout); reject(new Error('network')); };
        document.head.append(script);
      });
      client = window.supabase.createClient(config.supabaseUrl, config.supabaseKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      store = new window.AccountStore({
        client,
        storage: sessionStorage,
        onState: value => replaceTrackerState(store.userId ? value : load()),
        onStatus: status,
      });
      available = true; controls();
      // Defer async database calls until after the auth callback releases its lock.
      client.auth.onAuthStateChange((event, session) => {
        setTimeout(() => { sessionChanged(event, session).catch(() => status('error', 'Could not load your account. Please retry.')); }, 0);
      });
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      await sessionChanged('INITIAL_SESSION', data.session);
      const params = new URLSearchParams(location.hash.slice(1));
      const query = new URLSearchParams(location.search);
      const callbackError = params.get('error_description') || query.get('error_description');
      if (callbackError) {
        open(); message(callbackError, true);
        history.replaceState(null, '', location.pathname);
      }
    } catch {
      available = false;
      unavailableMessage = 'Sign-in could not connect. Reload to try again. Your device data is still available.';
      controls(); lockTracker(false);
      status('error', unavailableMessage);
    }
  }
  initialize();
})();

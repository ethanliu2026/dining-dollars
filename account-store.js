// Account drafts are separate from guest data and survive a reload in this tab.
// A version check prevents one device from silently overwriting another device.
(function (root) {
  class AccountStore {
    constructor({ client, storage, onState, onStatus, delay = 500 }) {
      Object.assign(this, { client, storage, onState, onStatus, delay });
      this.userId = null;
      this.generation = 0;
      this.version = 0;
      this.pending = null;
      this.ready = false;
      this.conflict = false;
    }

    key() { return `ddt.account-draft.${this.userId}`; }
    persist() {
      try {
        if (this.pending) this.storage.setItem(this.key(), JSON.stringify(this.pending));
        else this.storage.removeItem(this.key());
      } catch {
        this.onStatus('error', 'Browser storage is full or unavailable. Keep this page open until your changes are saved.');
      }
    }

    async connect(userId) {
      const generation = ++this.generation;
      clearTimeout(this.timer);
      this.userId = userId;
      this.ready = false;
      this.pending = null;
      this.conflict = false;
      this.writing = null;
      this.version = 0;
      // Clear the previous account immediately, before waiting for the network.
      this.onState(null);
      if (!userId) { this.onStatus('guest', 'Guest mode · saved on this device'); return; }
      this.onStatus('loading', 'Loading your meal history…');
      try {
        const { data, error } = await this.client.from('meal_tracker_states')
          .select('state, version').eq('user_id', userId).maybeSingle();
        if (generation !== this.generation) return;
        if (error) throw error;
        this.version = data?.version || 0;
        try { this.pending = JSON.parse(this.storage.getItem(this.key()) || 'null'); }
        catch { this.pending = null; }
        // An acknowledged write may have reached the server just before a reload.
        if (this.pending && JSON.stringify(this.pending.state) === JSON.stringify(data?.state)) {
          this.pending = null;
          this.persist();
        }
        this.onState(this.pending?.state || data?.state || null);
        this.ready = true;
        if (this.pending && this.pending.version !== this.version) {
          this.conflict = true;
          this.onStatus('conflict', 'Your account changed on another device. Export your changes, then load the cloud version.');
        } else if (this.pending) {
          await this.flush();
        } else {
          this.onStatus('saved', 'All changes saved');
        }
      } catch (error) {
        if (generation !== this.generation) return;
        this.onStatus('error', this.ready
          ? 'Changes have not synced. Keep this tab open and retry.'
          : 'Could not load your account. Retry to access your meal history.');
      }
    }

    save(state) {
      if (!this.userId || !this.ready) return;
      this.pending = { version: this.version, state: JSON.parse(JSON.stringify(state)) };
      this.persist();
      clearTimeout(this.timer);
      if (this.conflict) return;
      this.onStatus('saving', 'Saving changes…');
      this.timer = setTimeout(() => { this.flush().catch(() => {}); }, this.delay);
    }

    async flush() {
      clearTimeout(this.timer);
      if (this.writing) { await this.writing; return this.flush(); }
      if (!this.pending || !this.userId || !this.ready) return;
      if (this.conflict) throw new Error('CONFLICT');
      const generation = this.generation;
      const userId = this.userId;
      const pending = this.pending;
      this.onStatus('saving', 'Saving changes…');
      const write = async () => {
        try {
          const table = this.client.from('meal_tracker_states');
          const query = this.version === 0
            ? table.insert({ user_id: userId, state: pending.state, version: 1 })
            : table.update({ state: pending.state, version: this.version + 1 })
              .eq('user_id', userId).eq('version', this.version);
          const { data, error } = await query.select('version').maybeSingle();
          if (generation !== this.generation) return;
          if (error?.code === '23505' || (!error && !data)) {
            this.conflict = true;
            throw new Error('CONFLICT');
          }
          if (error) throw error;
          this.version = data.version;
          if (this.pending === pending) this.pending = null;
          else this.pending.version = this.version;
          this.persist();
          this.onStatus(this.pending ? 'saving' : 'saved', this.pending ? 'Saving changes…' : 'All changes saved');
        } catch (error) {
          if (generation !== this.generation) return;
          this.onStatus(this.conflict ? 'conflict' : 'error', this.conflict
            ? 'Your account changed on another device. Export your changes, then load the cloud version.'
            : 'Changes have not synced. Keep this tab open and retry.');
          throw error;
        }
      };
      this.writing = write();
      try { await this.writing; }
      finally { if (generation === this.generation) this.writing = null; }
      if (generation === this.generation && this.pending) await this.flush();
    }

    async loadCloud() {
      if (!this.userId || this.writing) return;
      const generation = this.generation;
      const { data, error } = await this.client.from('meal_tracker_states')
        .select('state, version').eq('user_id', this.userId).maybeSingle();
      if (generation !== this.generation) return;
      if (error) throw error;
      this.pending = null;
      this.persist();
      this.version = data?.version || 0;
      this.conflict = false;
      this.onState(data?.state || null);
      this.ready = true;
      this.onStatus('saved', 'All changes saved');
    }
  }
  root.AccountStore = AccountStore;
})(typeof window === 'undefined' ? globalThis : window);

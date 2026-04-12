Original prompt: right off the get go with data deleted and new payment id, i played oneround and simply refreshed the page. it zero'd the balance and shows the start challenge button. again does nothing unless spam clicked and than pay modal opens. re-rentering payment id restarts the challenge with the beginning start balance. doa indepth search for the bug thats causing this. this payment -> entry -> save balance through window exits and site data delete -> entry/restart tokens are deleted when fail/pass is reached. balance must persist when page is closed and new is opened, refreshes, and etc. the whole site is glitching and buggy with the closing and refreshing. find the issue using a deep integration and fix it

- Confirmed primary failure: challenge recovery depended on the run store, but the run store only persisted to local storage when Supabase was disabled. If the Supabase probe/select path failed or returned stale data, refresh would lose the active run pointer and drop the user back to the start flow.
- Confirmed secondary failure: live balance sync was debounced and not flushed on `pagehide`/`beforeunload`, so a quick refresh after a round could leave the server-side resume balance behind the actual client balance.
- Fix applied in `app.js`:
- Added a durable local mirror for run records and now write to it even when Supabase is enabled.
- Seeded/merged run recovery from the local mirror so refresh and reopen can recover from the freshest client-side run snapshot first.
- Preserved resumed balance on boot by hydrating the challenge wallet from the resumed run's `liveBalance`.
- Added `keepalive` run-sync requests plus `pagehide` / `beforeunload` / hidden-tab flushes for last-chance balance sync.
- Verification:
- `npm run build` completed successfully after the patch.

# TabStash Manual Smoke Test

Run before tagging a release. ~5 minutes.

## Setup
1. Open `chrome://extensions` → enable Developer mode → Load unpacked → choose this repo.
2. Pin TabStash to the toolbar.

## Save flow
3. Open ~5 tabs, including one chrome:// URL and one pinned tab.
4. Click TabStash icon → Side Panel opens on Library (empty state).
5. Click "+ Save current tabs". Save view appears.
6. Verify: pinned tab is NOT in the list.
7. Type folder name "Smoke" → check "Close tabs after saving" → click Save.
8. Verify: side panel switches back to Library showing "Smoke · 5 tabs". Browser tabs are closed.

## Highlighted-tabs flow
9. Open ~4 tabs. Cmd/Ctrl-click two of them in the tabstrip to highlight them.
10. Click TabStash icon → switch to Save tab.
11. Verify: only the 2 highlighted tabs appear, both checked.

## Browse / open / copy
12. Click "Smoke" folder. Folder Detail appears.
13. Click one tab → it opens in background (focus stays on side panel).
14. Click "Copy" → toast shows `Copied N URLs`. Paste into a notepad → verify URLs, one per line.
15. Click "Open all" → choose "Current window" → all tabs open in background.

## Delete + undo
16. Hover over a tab → click `×`. Toast shows "Removed ... Undo".
17. Wait 6 seconds → tab is gone for good.
18. Hover another tab → click `×` → click "Undo" before timer expires → tab reappears.

## Folder rename / delete
19. Click `⋮` → click "Rename" → edit name in modal → press Enter (or click Rename). Library shows new name.
20. Click `⋮` → click "Delete folder" → confirm in modal. Library returns to empty (or earlier state).
21. Try to rename to a name that already exists → inline error appears in the modal, save is blocked.

## Persistence
22. Save a folder. Quit and re-open Chrome. Open side panel → folder still there.

## Dedupe
23. With folder X already containing https://a.com/, save it again from another window → toast notes "(1 already there)".

## Empty state
24. Delete all folders → Library shows "No folders yet. Save some tabs to get started."

If any step fails: file an issue or fix before tagging.

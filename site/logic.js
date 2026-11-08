export function parseMode(hash = '') {
  return /#\/mode\/b$/.test(hash) ? 'b' : 'a';
}

/** `a` is the whole workspace, `b` only the folders whose content could be published. */
export function visibleFolders(state, mode = 'a') {
  const folders = state?.folders ?? [];
  return mode === 'b' ? folders.filter((folder) => folder.public) : folders;
}

/** A closed folder has no entry list at all; that is not the same as an empty one. */
export function folderLine(folder) {
  if (folder?.entries == null) return 'existence only';
  return folder.entries.length ? folder.entries.join(' · ') : 'empty';
}

export function folderCount(folder) {
  return folder?.entries == null ? '—' : String(folder.entries.length);
}

/** `2026-10-29T11:45` becomes the display form `2026-10-29 11:45`. */
export function stamp(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(value ?? ''));
  return match ? `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}` : '—';
}

export function repoRows(state) {
  return (state?.repos ?? [])
    .map((repo) => ({
      name: repo.name,
      app: repo.appVersion ?? '—',
      standard: repo.standard ?? '—',
      deviations: repo.standard == null ? '—' : String(repo.deviations ?? 0),
      lastCommit: repo.lastCommit ?? '—',
      origin: repo.remote ? 'set' : 'none',
      restore: repo.localOnly ? 'local only' : repo.restored ? 'repos.txt' : 'not restored',
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function driftText(state) {
  if (!state) return 'No state file. The scanner has not run on this machine.';
  const count = state.drift?.length ?? 0;
  if (!count) return 'None. Every folder and every repository has a description.';
  return `${count} difference${count === 1 ? '' : 's'} between the descriptions and the disk`;
}


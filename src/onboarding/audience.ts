// Who this person is to the onboarding (D-315, docs/specs/onboarding.md §5.2): new, invited or known; their role in a
// workspace; what's new for them since their last release. Pure: everything is passed in, nothing reaches Firebase.
import type { Role, Workspace } from '../data/model'
import type { Audience } from './seenMerge'

export type Who = Audience | 'known'

// The first workspace a person opens with no seen-state: who made it (`ownerId` is only the creator, D-098) and
// whether it already has pieces on it.
export type FirstWorkspace = Pick<Workspace, 'ownerId'> & { pieceCount: number }

// No seen-state anywhere → new, whatever the account's age (Q-026: there was no record before, so they see it too).
// New in a workspace someone else made that already has pieces → invited (the variant texts). A doc → known: lessons
// by `seen`, what's new by `lastRelease`.
export function whoIs(input: { uid: string; hasDoc: boolean; firstWorkspace?: FirstWorkspace | null }): Who {
  if (input.hasDoc) return 'known'
  const w = input.firstWorkspace
  return w && w.ownerId !== input.uid && w.pieceCount > 0 ? 'invited' : 'new'
}

// The person's role here; per workspace, so a viewer here can be an owner elsewhere. The same as roleOf in
// src/data/workspaces.ts (which can't be imported here: that module brings in Firestore); keep the two alike.
export function roleHere(w: Pick<Workspace, 'roles' | 'memberIds'>, uid: string | undefined): Role | null {
  return uid && w.memberIds.includes(uid) ? (w.roles[uid] ?? null) : null
}

export const canEditHere = (w: Pick<Workspace, 'roles' | 'memberIds'>, uid: string | undefined) => {
  const r = roleHere(w, uid)
  return r === 'owner' || r === 'editor'
}

// Whether a lesson meant for `roles` shows to someone with `role` (no roles listed: everyone; not a member: no one).
export function fitsRole(roles: readonly Role[] | undefined, role: Role | null): boolean {
  if (!role) return false
  return !roles || roles.length === 0 || roles.includes(role)
}

// The least a release needs here (src/onboarding/releases.ts has the full type).
export type ReleaseLike = { id: string }

// Releases (newest first, §7) newer than `lastRelease`, newest first. An id not in the list ('' before the coach set
// one, or one from a newer deploy) gives nothing: we can't tell what's newer, and the next canvas-open sets it to the
// newest anyway.
export function releasesSince<R extends ReleaseLike>(lastRelease: string, releases: readonly R[]): R[] {
  const at = releases.findIndex((r) => r.id === lastRelease)
  return at < 0 ? [] : releases.slice(0, at)
}

export const newestRelease = (releases: readonly ReleaseLike[]): string => releases[0]?.id ?? ''

// What a canvas-open does about releases (onboarding.md §4.4, §5.2, §7), decided from the seen-state as it stands:
// - `begin`: no seen-state anywhere (new or invited, an old account too, Q-026): lastRelease = the newest at once, the
//   welcome instead of what's new;
// - `set`: known but no release recorded yet (or releases since with nothing in them): lastRelease = the newest;
// - `news`: releases since lastRelease with changes in them: their lessons armed (`id@v`, the lesson's version now, so
//   a release that bumped a lesson's `v` arms it again though an older version was seen; one already seen at that
//   version stays seen: cleanArmed drops it), and the modal unless tips are off (then only `?`'s dot says so; lastRelease
//   moves on at once);
// - `none`: nothing new.
export type ReleaseWithItems = ReleaseLike & { items: readonly { lessons: readonly string[] }[] }
export type NewsPlan<R> =
  | { kind: 'begin'; lastRelease: string }
  | { kind: 'set'; lastRelease: string }
  | { kind: 'none' }
  | { kind: 'news'; releases: R[]; arm: string[]; modal: boolean; lastRelease: string }

export function planNews<R extends ReleaseWithItems>(
  p: { hasDoc: boolean; lastRelease: string; tipsOff: boolean },
  releases: readonly R[],
  versionOf: (lesson: string) => number | undefined,
): NewsPlan<R> {
  const top = newestRelease(releases)
  if (!p.hasDoc) return { kind: 'begin', lastRelease: top }
  if (!p.lastRelease) return { kind: 'set', lastRelease: top }
  const since = releasesSince(p.lastRelease, releases)
  if (!since.length) return { kind: 'none' }
  if (!since.some((r) => r.items.length)) return { kind: 'set', lastRelease: top }
  const ids = [...new Set(since.flatMap((r) => r.items.flatMap((i) => i.lessons)))]
  const arm = ids.flatMap((id) => {
    const v = versionOf(id)
    return v ? [`${id}@${v}`] : []
  })
  return { kind: 'news', releases: since, arm, modal: !p.tipsOff, lastRelease: top }
}

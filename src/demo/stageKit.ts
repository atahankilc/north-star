// What the scenes' fixtures share about the stage (D-400: each fixture file, written a build step apart, had its own
// copy): a style put in for one scene, and the one curve things glide on.
import { easeInOut } from '../ui/foundation/motionTokens'
import { run, type Action } from './director'

// A style put in the page once, under `id` (the tree is made again each loop, the style stays; a second ask for the
// same id does nothing).
export const putStyle = (id: string, css: string, what: string): Action =>
  run(() => {
    if (document.getElementById(id)) return
    const st = document.createElement('style')
    st.id = id
    st.textContent = css
    document.head.appendChild(st)
  }, what)

// Where a scene's CSS holds: inside its stage only, or over the whole page while it's on the stage (its portals too:
// a wizard, a panel; another scene in the same frame doesn't match it).
export const onStage = (scene: string) => `[data-scene="${scene}"]`
export const onPage = (scene: string) => `html:has([data-scene="${scene}"])`

// CSS for this scene only, over the whole page: `&` in it is the page while this scene is on the stage.
export const pageStyle = (scene: string, css: string): Action => putStyle(`demo-page-${scene}`, css.replaceAll('&', onPage(scene)), 'scene css')

// The curve a camera, a view and a made-up cursor glide on: the app's `--ease-in-out`.
export const ease = easeInOut

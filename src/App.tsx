/**
 * Root OpenTUI component. The full library/shop/usage/craft surface will
 * land alongside the OpenTUI substrate; until then this renders a single
 * informational pane so the binary boots and a future screen tree can hang
 * off this component.
 */
export function App(): JSX.Element {
  return (
    <box flexDirection="column" padding={1}>
      <text>skill-cellar — OpenTUI shell</text>
      <text>
        Core engine ready (src/core/): conformance, fs-skills, registry,
        usage, sync. UI surface is under construction.
      </text>
    </box>
  )
}

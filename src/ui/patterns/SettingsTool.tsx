// The settings gear in the bottom-left corner, under your square (D-175): the HUD's ToolButton, cyan while settings are
// open like the threads tool above it, a cyan count of people waiting to join (D-062); it turns on hover.
import { ToolButton } from '../primitives/ToolButton'
import { GearIcon } from '../primitives/hudIcons'
import styles from './SettingsTool.module.css'

export function SettingsTool({ open, waiting = 0, onClick }: { open: boolean; waiting?: number; onClick: () => void }) {
  return (
    <ToolButton
      className={styles.gear}
      pressed={open}
      badge={waiting}
      badgeTone="cyan"
      onClick={onClick}
      aria-haspopup="dialog"
      label={`Settings${waiting > 0 ? `, ${waiting} waiting` : ''}`}
    >
      <GearIcon />
    </ToolButton>
  )
}

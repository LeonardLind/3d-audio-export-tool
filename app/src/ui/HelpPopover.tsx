import styles from './Ui.module.css';
export function HelpPopover({ onClose }: { onClose: () => void }) {
  return <aside className={`${styles.panel} ${styles.popover}`} aria-label="Help">
    <strong>Explore the sound</strong>
    <p>Turn X, Y and Z on or off to see the same dots from another angle. At least one axis stays on.</p>
    <p>Colour shows spectral centroid. Dot size shows strength. Numbers show peak frequency.</p>
    <p>Click two dots to compare their measured values. Use Fit to bring the cloud back into view.</p>
    <button type="button" onClick={onClose}>Close</button>
  </aside>;
}

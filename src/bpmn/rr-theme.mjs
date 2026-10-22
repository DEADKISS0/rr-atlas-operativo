export function readRrTheme() {
  const style = getComputedStyle(document.body);
  const read = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
  return {
    stroke: read('--rr-bpmn-base-stroke', '#fffff3'),
    fill: read('--rr-bpmn-base-fill', '#150612'),
    attention: read('--rr-bpmn-attention', '#ded116'),
    alarm: read('--rr-bpmn-alarm', '#be076d'),
    lane: read('--rr-bpmn-lane', '#973d8f'),
    muted: read('--rr-bpmn-muted', '#d2abc2'),
    text: read('--rr-bpmn-text', '#fffff3'),
    end: read('--rr-bpmn-end', '#fffff3'),
    ink: read('--rr-ink-fixed', '#070001'),
    paper: read('--rr-paper-fixed', '#fffff3'),
  };
}

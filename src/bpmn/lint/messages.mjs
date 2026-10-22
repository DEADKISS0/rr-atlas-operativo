export const RULE_TEXT = Object.freeze({
  'ad-hoc-sub-process': 'El subproceso ad hoc no entra en la notación RR.',
  'conditional-flows': 'Hay un flujo condicional mal usado.',
  'end-event-required': 'El proceso necesita un evento de fin.',
  'event-based-gateway': 'La compuerta por eventos está incompleta.',
  'event-sub-process-typed-start-event': 'El inicio del subproceso de evento necesita tipo.',
  'fake-join': 'Varias entradas llegan a un paso que no es compuerta.',
  'global': 'Hay un elemento global que conviene dejar dentro del proceso.',
  'label-required': 'Falta el nombre del elemento.',
  'link-event': 'El evento de enlace está incompleto.',
  'no-bpmndi': 'Falta la información de diagrama.',
  'no-complex-gateway': 'La compuerta compleja no se usa en RR.',
  'no-disconnected': 'Hay un elemento desconectado.',
  'no-duplicate-sequence-flows': 'Hay flujos de secuencia repetidos.',
  'no-gateway-join-fork': 'La compuerta abre y cierra a la vez.',
  'no-implicit-split': 'El paso se divide sin una compuerta.',
  'no-implicit-end': 'El flujo termina sin un evento de fin.',
  'no-implicit-start': 'El flujo empieza sin un evento de inicio.',
  'no-inclusive-gateway': 'La compuerta inclusiva queda como aviso en RR.',
  'no-overlapping-elements': 'Hay elementos encimados.',
  'single-blank-start-event': 'Solo puede haber un inicio en blanco.',
  'single-event-definition': 'El evento tiene más de una definición.',
  'start-event-required': 'El proceso necesita un evento de inicio.',
  'sub-process-blank-start-event': 'El subproceso necesita un inicio en blanco.',
  'superfluous-gateway': 'La compuerta no decide nada.',
  'superfluous-label': 'La etiqueta no aporta.',
  'superfluous-termination': 'El cierre de ese flujo sobra.',
});

export function issueLabel(issue) {
  if (issue.rule?.startsWith('rr/')) return issue.message;
  return RULE_TEXT[issue.rule] || 'Hallazgo de BPMN';
}

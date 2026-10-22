export const rrModdle = {
  name: 'RR',
  uri: 'http://rraliados.com/schema/bpmn/rr',
  prefix: 'rr',
  xml: { tagAlias: 'lowerCase' },
  types: [
    {
      name: 'Meta',
      superClass: ['Element'],
      meta: { allowedIn: ['bpmn:Process'] },
      properties: [
        { name: 'owner', isAttr: true, type: 'String' },
        { name: 'kpi', isAttr: true, type: 'String' },
        { name: 'lineaBase', isAttr: true, type: 'String' },
        { name: 'estado', isAttr: true, type: 'String' },
        { name: 'revisadoPor', isAttr: true, type: 'String' },
        { name: 'fechaCorte', isAttr: true, type: 'String' },
      ],
    },
    {
      name: 'Decorado',
      extends: ['bpmn:FlowNode'],
      properties: [
        { name: 'sim', isAttr: true, type: 'String' },
        { name: 'semantica', isAttr: true, type: 'String' },
      ],
    },
  ],
};

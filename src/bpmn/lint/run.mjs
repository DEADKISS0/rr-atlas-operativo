import { BpmnModdle } from 'bpmn-moddle';
import bpmnlint from 'bpmnlint';
import StaticResolver from 'bpmnlint/lib/resolver/static-resolver';
import recommended from 'bpmnlint/config/recommended';
import adHocSubProcess from 'bpmnlint/rules/ad-hoc-sub-process';
import conditionalFlows from 'bpmnlint/rules/conditional-flows';
import endEventRequired from 'bpmnlint/rules/end-event-required';
import eventBasedGateway from 'bpmnlint/rules/event-based-gateway';
import eventSubProcessTypedStartEvent from 'bpmnlint/rules/event-sub-process-typed-start-event';
import fakeJoin from 'bpmnlint/rules/fake-join';
import globalRule from 'bpmnlint/rules/global';
import labelRequired from 'bpmnlint/rules/label-required';
import linkEvent from 'bpmnlint/rules/link-event';
import noBpmndi from 'bpmnlint/rules/no-bpmndi';
import noComplexGateway from 'bpmnlint/rules/no-complex-gateway';
import noDisconnected from 'bpmnlint/rules/no-disconnected';
import noDuplicateSequenceFlows from 'bpmnlint/rules/no-duplicate-sequence-flows';
import noGatewayJoinFork from 'bpmnlint/rules/no-gateway-join-fork';
import noImplicitSplit from 'bpmnlint/rules/no-implicit-split';
import noImplicitEnd from 'bpmnlint/rules/no-implicit-end';
import noImplicitStart from 'bpmnlint/rules/no-implicit-start';
import noInclusiveGateway from 'bpmnlint/rules/no-inclusive-gateway';
import noOverlappingElements from 'bpmnlint/rules/no-overlapping-elements';
import singleBlankStartEvent from 'bpmnlint/rules/single-blank-start-event';
import singleEventDefinition from 'bpmnlint/rules/single-event-definition';
import startEventRequired from 'bpmnlint/rules/start-event-required';
import subProcessBlankStartEvent from 'bpmnlint/rules/sub-process-blank-start-event';
import superfluousGateway from 'bpmnlint/rules/superfluous-gateway';
import superfluousLabel from 'bpmnlint/rules/superfluous-label';
import superfluousTermination from 'bpmnlint/rules/superfluous-termination';
import { rrModdle } from '../rr-moddle.mjs';
import { rrRecommended, rrRules } from './plugin-rr/index.mjs';

const asRule = (mod) => mod?.default || mod;

const recommendedRules = {
  'ad-hoc-sub-process': adHocSubProcess,
  'conditional-flows': conditionalFlows,
  'end-event-required': endEventRequired,
  'event-based-gateway': eventBasedGateway,
  'event-sub-process-typed-start-event': eventSubProcessTypedStartEvent,
  'fake-join': fakeJoin,
  global: globalRule,
  'label-required': labelRequired,
  'link-event': linkEvent,
  'no-bpmndi': noBpmndi,
  'no-complex-gateway': noComplexGateway,
  'no-disconnected': noDisconnected,
  'no-duplicate-sequence-flows': noDuplicateSequenceFlows,
  'no-gateway-join-fork': noGatewayJoinFork,
  'no-implicit-split': noImplicitSplit,
  'no-implicit-end': noImplicitEnd,
  'no-implicit-start': noImplicitStart,
  'no-inclusive-gateway': noInclusiveGateway,
  'no-overlapping-elements': noOverlappingElements,
  'single-blank-start-event': singleBlankStartEvent,
  'single-event-definition': singleEventDefinition,
  'start-event-required': startEventRequired,
  'sub-process-blank-start-event': subProcessBlankStartEvent,
  'superfluous-gateway': superfluousGateway,
  'superfluous-label': superfluousLabel,
  'superfluous-termination': superfluousTermination,
};

const cache = {
  'config:bpmnlint/recommended': recommended.default || recommended,
  'config:bpmnlint-plugin-rr/recommended': rrRecommended,
};

for (const [name, rule] of Object.entries(recommendedRules)) {
  cache[`rule:bpmnlint/${name}`] = asRule(rule);
}
for (const [name, rule] of Object.entries(rrRules)) {
  cache[`rule:bpmnlint-plugin-rr/${name}`] = rule;
}

const Linter = bpmnlint.Linter || bpmnlint.default?.Linter;
const Resolver = StaticResolver.default || StaticResolver;

const resolver = new Resolver(cache);
const moddle = new BpmnModdle({ rr: rrModdle });

function createLinter() {
  return new Linter({
    resolver,
    config: {
      extends: ['bpmnlint:recommended', 'plugin:rr/recommended'],
    },
  });
}

export function isKnownDebt(fileName, issue, debt) {
  return (debt?.casos || []).some((item) => item.archivo === fileName && item.id === issue.id && (item.regla || debt.regla) === issue.rule);
}

export async function validateXml(xml, { fileName = '', debt = null } = {}) {
  let root = null;
  let moddleWarnings = [];
  try {
    const parsed = await moddle.fromXML(xml);
    root = parsed.rootElement;
    moddleWarnings = parsed.warnings || [];
  } catch (error) {
    return {
      ok: false,
      importError: error.message || 'El XML no es BPMN 2.0',
      moddleWarnings: [],
      issues: [],
      errors: [],
      warnings: [],
      debt: [],
    };
  }

  const raw = await createLinter().lint(root);
  const issues = [];
  for (const [rule, reports] of Object.entries(raw)) {
    for (const report of reports) {
      issues.push({
        rule,
        id: report.id || '',
        message: report.message || '',
        category: report.category || 'error',
      });
    }
  }

  const debtHits = [];
  const errors = [];
  const warnings = [];
  for (const issue of issues) {
    if (issue.category === 'error' && isKnownDebt(fileName, issue, debt)) {
      debtHits.push(issue);
      continue;
    }
    if (issue.category === 'warn') warnings.push(issue);
    else errors.push(issue);
  }

  return {
    ok: moddleWarnings.length === 0 && errors.length === 0,
    importError: '',
    moddleWarnings,
    issues,
    errors,
    warnings,
    debt: debtHits,
  };
}

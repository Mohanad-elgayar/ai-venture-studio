import { useMemo } from 'react';
import { useStore } from './store';
import {
  complianceRows, filterClashes, filterCompliance, filterDeliverables, filterIssues, filterModels, filterRisks, modelStates,
} from '../lib/metrics';

/** Memoised, globally-filtered view of the dataset used by every page. */
export function useData() {
  const { ds, filters, scope } = useStore();
  return useMemo(() => {
    const project = ds.projects.find((p) => p.id === filters.projectId) ?? ds.projects[0];
    const models = filterModels(ds.models, filters);
    const users = new Map(ds.users.map((u) => [u.id, u]));
    const companies = new Map(ds.companies.map((c) => [c.id, c]));
    return {
      project,
      clashes: filterClashes(ds.clashes, filters),
      models,
      modelStates: modelStates(models, ds.submissions, scope.asOf),
      deliverables: filterDeliverables(ds.deliverables, filters),
      issues: filterIssues(ds.issues, filters),
      risks: filterRisks(ds.risks, filters),
      complianceRows: complianceRows(filterCompliance(ds.compliance, filters), models, scope.asOf),
      userName: (id?: string) => (id ? users.get(id)?.name ?? id : '—'),
      companyName: (id?: string) => (id ? companies.get(id)?.name ?? id : '—'),
      companyShort: (id?: string) => (id ? companies.get(id)?.shortName ?? id : '—'),
      modelName: (id?: string) => (id ? ds.models.find((m) => m.id === id)?.name ?? id : '—'),
    };
  }, [ds, filters, scope]);
}

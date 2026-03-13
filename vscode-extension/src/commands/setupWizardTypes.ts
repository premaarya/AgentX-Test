import { EnvironmentReport } from '../utils/dependencyChecker';

export interface PreCheckResult {
  passed: boolean;
  report: EnvironmentReport;
}
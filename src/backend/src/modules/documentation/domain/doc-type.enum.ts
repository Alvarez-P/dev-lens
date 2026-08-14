/**
 * Documentation artifact types. Canonical values are the template ids used in
 * `templates/{type}/v{n}/template.yml`. Note: module documentation is
 * `module-docs` (NOT `module-documentation`).
 */
export enum DocType {
  README = 'readme',
  ARCHITECTURE_GUIDE = 'architecture-guide',
  API_REFERENCE = 'api-reference',
  MODULE_DOCS = 'module-docs',
  ONBOARDING_GUIDE = 'onboarding-guide',
}

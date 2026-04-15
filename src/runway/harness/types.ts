export type HarnessCommand = {
  kind: "npm";
  script: string;
};

export type ValidationSurface = {
  name: string;
  pathPrefixes: string[];
  commands: HarnessCommand[];
  behaviorScenarios?: string[];
  note?: string;
};

export type HarnessTarget = {
  label: string;
  repoPath: string;
  archetype: "library" | "service" | "worker" | "webapp";
  onboardingStatus: "active" | "draft";
  auditedRoots: string[];
  requiredDocs: string[];
  keyFolderGroups: Array<{
    label: string;
    paths: string[];
  }>;
  validationSurfaces: ValidationSurface[];
};

export type BehaviorScenario = {
  name: string;
  description: string;
  command: string[];
  artifactPath: string;
};

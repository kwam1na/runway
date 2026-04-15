export type HarnessCommand = {
  readonly kind: "npm";
  readonly script: string;
};

export type ValidationSurface = {
  readonly name: string;
  readonly pathPrefixes: readonly string[];
  readonly commands: readonly HarnessCommand[];
  readonly behaviorScenarios?: readonly string[];
  readonly note?: string;
};

export type HarnessTarget = {
  readonly label: string;
  readonly repoPath: string;
  readonly archetype: "library" | "service" | "worker" | "webapp";
  readonly onboardingStatus: "active" | "draft";
  readonly auditedRoots: readonly string[];
  readonly requiredDocs: readonly string[];
  readonly keyFolderGroups: readonly Readonly<{
    label: string;
    paths: readonly string[];
  }>[];
  readonly validationSurfaces: readonly ValidationSurface[];
};

export type BehaviorScenario = {
  readonly name: string;
  readonly description: string;
  readonly command: readonly string[];
  readonly artifactPath: string;
};

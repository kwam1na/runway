import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { harnessTargets } from "./app-registry.js";

async function writeText(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, "utf8");
}

export async function generateHarnessArtifacts(): Promise<string[]> {
  const outputs = [
    "graphify-out/index.md",
    "docs/agent/entry-index.md",
    "docs/agent/test-index.md",
    "docs/agent/key-folder-index.md",
    "docs/agent/validation-guide.md",
    "docs/agent/validation-map.json",
  ];

  await writeText(
    "graphify-out/index.md",
    "# Generated Graph Index\n\nThis file is generated. Regenerate it instead of editing by hand.\n",
  );
  await writeText(
    "docs/agent/entry-index.md",
    "# Generated Entry Index\n\nThis file is generated. Regenerate it instead of editing by hand.\n",
  );
  await writeText(
    "docs/agent/test-index.md",
    "# Generated Test Index\n\nThis file is generated. Regenerate it instead of editing by hand.\n",
  );
  await writeText(
    "docs/agent/key-folder-index.md",
    "# Generated Key Folder Index\n\nThis file is generated. Regenerate it instead of editing by hand.\n",
  );
  await writeText(
    "docs/agent/validation-guide.md",
    "# Generated Validation Guide\n\nThis file is generated. Regenerate it instead of editing by hand.\n",
  );
  await writeText(
    "docs/agent/validation-map.json",
    JSON.stringify(
      {
        workspace: "runway",
        packageDir: "src/runway",
        surfaces: harnessTargets.flatMap((target) => target.validationSurfaces),
      },
      null,
      2,
    ),
  );

  return outputs;
}

import { writeFile } from "node:fs/promises";
import { canonicalSkillPackageBytes, readSkillDirectory, summarizeSkillPackage, validateSkillPackage } from "../src/index.ts";

const [skillDirectory, outputPath] = process.argv.slice(2);
if (!skillDirectory || !outputPath) throw new Error("Usage: package-dir.ts <skill-directory> <output-file>");

const skill = await readSkillDirectory(skillDirectory);
const validation = validateSkillPackage(skill.entries, skill.directoryName);
if (!validation.valid) throw new Error(`Invalid Agent Skill: ${JSON.stringify(validation.issues)}`);
const packageBytes = canonicalSkillPackageBytes(skill.entries);
await writeFile(outputPath, packageBytes);
process.stdout.write(`${JSON.stringify({ directoryName: skill.directoryName, ...summarizeSkillPackage(skill.entries) })}\n`);

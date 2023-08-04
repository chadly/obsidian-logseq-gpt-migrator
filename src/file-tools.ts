import { z } from "zod";
import { DynamicStructuredTool, DynamicTool, Tool } from "langchain/tools";
import fs from "fs";
import path from "path";

const PATH = "/mnt/c/Users/Chad Lee/Documents/zettelkasten";
const DESTINATION_PATH = path.join(__dirname, "output");

export const tools = [
	new DynamicTool({
		name: "Source File Lister",
		description:
			"call this to get the list of source file names that need to be processed.",
		func: async () =>
			new Promise<string>((resolve, reject) => {
				fs.readdir(PATH, (err, files) => {
					if (err) {
						reject(err);
					} else {
						resolve(files.join("\n"));
					}
				});
			}),
	}),

	new DynamicStructuredTool({
		name: "Source File Reader",
		description: "Reads a file given a filename and returns its contents.",
		schema: z.object({
			filename: z.string().describe("The filename of the file to read"),
		}),
		func: async ({ filename }) =>
			new Promise<string>((resolve, reject) => {
				fs.readFile(path.join(PATH, filename), "utf8", (err, contents) => {
					if (err) {
						reject(err);
					} else {
						resolve(contents);
					}
				});
			}),
		returnDirect: false,
	}),

	new DynamicStructuredTool({
		name: "Destination File Writer",
		description:
			"Writes (or appends) transformed contents to a new .md file in the destination folder.",
		schema: z.object({
			filename: z
				.string()
				.describe("The filename (in date format) of the file to write"),
			contents: z.string().describe("The contents of the file"),
		}),
		func: async ({ filename, contents }) =>
			new Promise<string>((resolve, reject) => {
				//write contents to filename located in PATH (append or create new)
				fs.writeFile(
					path.join(DESTINATION_PATH, filename),
					contents,
					{ flag: "a+" },
					(err) => {
						if (err) {
							reject(err);
						} else {
							resolve("done");
						}
					}
				);
			}),
		returnDirect: false,
	}),
];

import "dotenv/config";

import path from "path";
import fs from "fs";

import { z } from "zod";

import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";
import { LLMChain } from "langchain/chains";
import {
	StructuredOutputParser,
	OutputFixingParser,
} from "langchain/output_parsers";

const DESTINATION_PATH = path.join(__dirname, "..", "output");
const PATH = "/mnt/c/Users/Chad Lee/Documents/zettelkasten";

const parser = StructuredOutputParser.fromZodSchema(
	z.object({
		filename: z
			.string()
			.describe("The new filename should be the date of the plantedAt field"),
		contents: z.string().describe("The transformed contents of the file"),
	})
);

const formatInstructions = parser.getFormatInstructions();

const prompt = new PromptTemplate({
	inputVariables: ["fileContents"],
	partialVariables: { formatInstructions },
	template: `
I would like you to reformat a markdown file according to the following specifications:

The frontmatter of the file should have a plantedAt date field. I'd like you to strip all
frontmatter from the file, and reformat the contents by replacing each paragraph with
an indented bulleted list.

For example, if a file named "Hello World.md" looks like this:

---
tags: [seedling]
plantedAt: 2023-02-22
lastTendedAt: 2023-05-31
---

There are three key concepts to master when creating an effective YouTube thumbnail.

## Attention

Understand *what* will grab your viewers' attention visually.

## Relevance

The images should be *relevant* to your viewers' *interests* in relation to your video.

## Intrigue

Create curiosity using your image that makes a viewer want to click to satisfy that curiosity.


The new filename would be 2023-02-22.md with the following contents:

- ## Hello World
	- There are three key concepts to master when creating an effective YouTube thumbnail.
	- ### Attention
		- Understand *what* will grab your viewers' attention visually.
	- ### Relevance
		- The images should be *relevant* to your viewers' *interests* in relation to your video.
	- ### Intrigue
		- Create curiosity using your image that makes a viewer want to click to satisfy that curiosity.

Notice the top level item should always be an h2 with the filename. Each subheading should be
adjusted to be hierarchal lower than h2 accordingly. Also notice how each subblock is indented
to be a child of the parent block.

{formatInstructions}

ONLY INCLUDE RAW, PARSABLE JSON IN YOUR RESPONSE. DO NOT INCLUDE ANYTHING ELSE.

Here is the file I'd like you to transform:

{fileContents}
	`,
});

// return a generator that yields the next file to process
// by looking in PATH for all files with a .md extension and
// returning the filename and the contents of the file
async function* readFiles() {
	const files = await fs.promises.readdir(PATH);
	for (const file of files) {
		if (file.endsWith(".md")) {
			const contents = await fs.promises.readFile(
				path.join(PATH, file),
				"utf8"
			);
			yield { file, contents };
		}
	}
}

const llm = new OpenAI({
	modelName: "gpt-4",
	temperature: 0,
});

const chain = new LLMChain({
	llm,
	prompt,
	outputParser: OutputFixingParser.fromLLM(llm, parser),
});

const run = async () => {
	// for each file, prompt the agent to transform the file
	// and write the transformed file to DESTINATION_PATH
	for await (const { file, contents } of readFiles()) {
		try {
			console.log(`Processing file ${file}`);

			const { text: result } = await chain.call({ fileContents: contents });

			console.log(`Saving to ${result.filename}`);
			console.log();

			const filename = path.join(DESTINATION_PATH, result.filename);
			await fs.promises.writeFile(filename, result.contents, { flag: "a" });
		} catch (e) {
			console.error(`Error parsing file ${file}: ${e}`);
		}
	}
};

run();

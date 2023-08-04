import "dotenv/config";

import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { OpenAI } from "langchain/llms/openai";

import { tools } from "./file-tools";

const input = `
There is a file folder full of markdown files. The frontmatter of the files have a
plantedAt date field. For every file, I'd like you to create a new markdown file as
the date of the plantedAt field, and copy the transformed contents of the file into
the new file.

To transform the contents, replace each paragraph with a indented bulleted list.

For example, if a file named "Hello World.md" looks like this:

---
tags: [seedling]
plantedAt: 2023-02-22
lastTendedAt: 2023-02-22
---

There are three key concepts to master when creating an effective YouTube thumbnail.

## Attention

Understand *what* will grab your viewers' attention visually.

## Relevance

The images should be *relevant* to your viewers' *interests* in relation to your video.

## Intrigue

Create curiosity using your image that makes a viewer want to click to satisfy that curiosity.


You should create a new file named 2023-02-22.md and the contents should look like this:

- ## Hello World
	- There are three key concepts to master when creating an effective YouTube thumbnail.
	- ### Attention
		- Understand *what* will grab your viewers' attention visually.
	- ### Relevance
		- The images should be *relevant* to your viewers' *interests* in relation to your video.
	- ### Intrigue
		- Create curiosity using your image that makes a viewer want to click to satisfy that curiosity.

Notice the top level item is always an h2. Each subheading should be adjusted accordingly.

How many files did you process in total?
`;

const run = async () => {
	const model = new OpenAI({
		modelName: "gpt-4",
		temperature: 0,
	});

	const executor = await initializeAgentExecutorWithOptions(tools, model, {
		agentType: "structured-chat-zero-shot-react-description",
		verbose: true,
	});

	console.log("Loaded agent.");

	const result = await executor.call({ input });
	console.log(`Got output ${result.output}`);
};

run();

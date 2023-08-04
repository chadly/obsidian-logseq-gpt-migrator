import {
	LLMSingleActionAgent,
	AgentActionOutputParser,
	AgentExecutor,
} from "langchain/agents";
import { LLMChain } from "langchain/chains";
import { OpenAI } from "langchain/llms/openai";
import {
	BasePromptTemplate,
	BaseStringPromptTemplate,
	SerializedBasePromptTemplate,
	renderTemplate,
} from "langchain/prompts";
import {
	InputValues,
	PartialValues,
	AgentStep,
	AgentAction,
	AgentFinish,
} from "langchain/schema";
import { Tool } from "langchain/tools";

import { tools  } from "./file-tools";

const PREFIX = `
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
`;
const formatInstructions = (
	toolNames: string
) => `Use the following format in your response:

  Thought: you should always think about what to do
  Action: the action to take, should be one of [${toolNames}]
  Action Input: the input to the action
  Observation: the result of the action
  ... (this Thought/Action/Action Input/Observation can repeat N times)
  Thought: I now have completed the task
  Final Result: the results of the task - how many files were processed, any anomalies, etc.`;
const SUFFIX = `Begin!
  Thought:{agent_scratchpad}`;

class CustomPromptTemplate extends BaseStringPromptTemplate {
	tools: Tool[];

	constructor(args: { tools: Tool[]; inputVariables: string[] }) {
		super({ inputVariables: args.inputVariables });
		this.tools = args.tools;
	}

	_getPromptType(): string {
		return "do_task";
	}

	format(input: InputValues): Promise<string> {
		/** Construct the final template */
		const toolStrings = this.tools
			.map((tool) => `${tool.name}: ${tool.description}`)
			.join("\n");
		const toolNames = this.tools.map((tool) => tool.name).join("\n");
		const instructions = formatInstructions(toolNames);
		const template = [PREFIX, toolStrings, instructions, SUFFIX].join("\n\n");
		/** Construct the agent_scratchpad */
		const intermediateSteps = input.intermediate_steps as AgentStep[];
		const agentScratchpad = intermediateSteps.reduce(
			(thoughts, { action, observation }) =>
				thoughts +
				[action.log, `\nObservation: ${observation}`, "Thought:"].join("\n"),
			""
		);
		const newInput = { agent_scratchpad: agentScratchpad, ...input };
		/** Format the template. */
		return Promise.resolve(renderTemplate(template, "f-string", newInput));
	}

	partial(_values: PartialValues): Promise<BasePromptTemplate> {
		throw new Error("Not implemented");
	}

	serialize(): SerializedBasePromptTemplate {
		throw new Error("Not implemented");
	}
}

class CustomOutputParser extends AgentActionOutputParser {
	lc_namespace = ["langchain", "agents", "custom_llm_agent"];

	async parse(text: string): Promise<AgentAction | AgentFinish> {
		if (text.includes("Final Result:")) {
			const parts = text.split("Final Result:");
			const input = parts[parts.length - 1].trim();
			const finalAnswers = { output: input };
			return { log: text, returnValues: finalAnswers };
		}

		const match = /Action: (.*)\nAction Input: (.*)/s.exec(text);
		if (!match) {
			throw new Error(`Could not parse LLM output: ${text}`);
		}

		return {
			tool: match[1].trim(),
			toolInput: match[2].trim().replace(/^"+|"+$/g, ""),
			log: text,
		};
	}

	getFormatInstructions(): string {
		throw new Error("Not implemented");
	}
}

export const run = async () => {
	const model = new OpenAI({ temperature: 0 });

	const llmChain = new LLMChain({
		prompt: new CustomPromptTemplate({
			tools: tools as Tool[],
			inputVariables: ["agent_scratchpad"],
		}),
		llm: model,
	});

	const agent = new LLMSingleActionAgent({
		llmChain,
		outputParser: new CustomOutputParser(),
		stop: ["Final Result"],
	});
	const executor = new AgentExecutor({
		agent,
		tools,
		verbose: true,
	});
	console.log("Loaded agent.");

	const result = await executor.call({});
	console.log(`Got output ${result.output}`);
};

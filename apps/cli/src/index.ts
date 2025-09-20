import { Command } from "commander";
import inquirer from "inquirer";

import client from "@jphw/client";

const program = new Command();

program
  .name("jphw")
  .description("Do Japanese homework")
  .version("0.0.0")
  .argument("[url]", "URL of the form")
  .action(async (url: string) => {
    if (!url) {
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "url",
          message: "Please enter the URL of the form:",
        },
      ]);
      url = answers.url;
    }
    client();
  });

program.parse();

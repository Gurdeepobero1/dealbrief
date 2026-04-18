#!/usr/bin/env node
import { Command } from "commander";
import { prepBrief } from "@dealbrief/core";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnv } from "./env.js";

loadEnv();

const program = new Command();

program
  .name("dealbrief")
  .description("Turn any calendar invite into a meeting brief. Public-footprint only.")
  .version("0.1.0");

program
  .command("prep")
  .description("Generate a brief for a single prospect")
  .option("-l, --linkedin <url>", "LinkedIn profile URL")
  .option("-e, --email <email>", "Work email")
  .option("-d, --domain <domain>", "Company domain (improves news signal)")
  .option("-o, --output <file>", "Write markdown to file instead of stdout")
  .option("--json", "Output raw Brief JSON instead of markdown")
  .option("--product <description>", "What you sell (improves opener quality)")
  .option("--icp <description>", "Your ideal customer profile")
  .action(async (opts) => {
    if (!opts.linkedin && !opts.email) {
      console.error("❌ Provide --linkedin or --email");
      process.exit(1);
    }

    const startedAt = Date.now();
    console.error("⏳ Fetching signals...");

    try {
      const result = await prepBrief({
        linkedinUrl: opts.linkedin,
        workEmail: opts.email,
        companyDomain: opts.domain,
        sellerContext: opts.product
          ? {
              productDescription: opts.product,
              idealCustomerProfile: opts.icp ?? "",
              valueProps: [],
            }
          : undefined,
      });

      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.error(`✅ Brief generated in ${elapsed}s`);
      console.error(
        `   Trust: ${result.validation.stats.citedClaims}/${result.validation.stats.totalClaims} claims cited · avg confidence ${result.validation.stats.avgConfidence.toFixed(2)}`
      );

      const output = opts.json
        ? JSON.stringify(result.brief, null, 2)
        : result.markdown;

      if (opts.output) {
        await writeFile(resolve(opts.output), output, "utf8");
        console.error(`💾 Written to ${opts.output}`);
      } else {
        console.log(output);
      }
    } catch (e) {
      console.error("❌ Error:", (e as Error).message);
      process.exit(1);
    }
  });

program
  .command("doctor")
  .description("Check that required API keys are configured")
  .action(() => {
    const required = ["GROQ_API_KEY", "PROXYCURL_API_KEY", "EXA_API_KEY"];
    const optional = ["OPENROUTER_API_KEY", "GITHUB_TOKEN", "LISTEN_NOTES_API_KEY"];

    console.log("\nDealBrief environment check\n");
    let allRequired = true;
    for (const k of required) {
      const has = !!process.env[k];
      console.log(`  ${has ? "✅" : "❌"} ${k}${has ? "" : " (required)"}`);
      if (!has) allRequired = false;
    }
    console.log("");
    for (const k of optional) {
      const has = !!process.env[k];
      console.log(`  ${has ? "✅" : "⚪"} ${k}${has ? "" : " (optional)"}`);
    }
    console.log("");
    if (!allRequired) {
      console.log("❌ Missing required keys. Copy .env.example to .env and fill in.");
      process.exit(1);
    }
    console.log("✅ All required keys present.");
  });

program.parseAsync().catch(e => {
  console.error(e);
  process.exit(1);
});

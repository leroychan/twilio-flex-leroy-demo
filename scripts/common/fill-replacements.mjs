import { promises as fs } from "fs";
import shell from "shelljs";

import { varNameMapping } from "./constants.mjs";
import * as fetchCli from "./fetch-cli.mjs";

// Initialize env file if necessary, then parse its contents
const readEnv = async (envFile, exampleFile) => {
  if (!shell.test("-e", exampleFile) && !shell.test("-e", envFile)) {
    // nothing exists!
    return null;
  } else if (!shell.test("-e", envFile)) {
    // create env file based on example
    shell.cp(exampleFile, envFile);

    // verify creation succeeded
    if (!shell.test("-e", envFile)) {
      return null;
    }
  }

  // read and parse the env file
  const initialEnv = await fs.readFile(envFile, "utf8");
  let result = {};
  for (const match of initialEnv.matchAll(/<YOUR_(.*)>/g)) {
    result[match[1]] = match[0];
  }
  return result;
};

// Fills placeholder variables from process.env if present
const fillKnownEnvVars = (envVars) => {
  for (const key in envVars) {
    // If this isn't a placeholder value, ignore it
    if (envVars[key] !== `<YOUR_${key}>`) {
      continue;
    }

    if (process.env[key]) {
      // Hey, we were handed this var on a golden platter! Use it.
      envVars[key] = process.env[key];
    }
  }

  return envVars;
};

// For vars still unknown, fetches needed vars from the API and fills in as appropriate
const fillUnknownEnvVars = (envVars, environment) => {
  for (const key in envVars) {
    if (envVars[key] !== `<YOUR_${key}>` || !varNameMapping[key]) {
      // If this isn't a placeholder value, ignore it.
      // This variable isn't in the constant, so we can't do anything else with it.
      continue;
    }

    if (fetchCli.getFetchedVars()[key]) {
      // This value was cached previously
      envVars[key] = fetchCli.getFetchedVars()[key];
      continue;
    }

    if (!environment && varNameMapping[key].localValue) {
      // Running locally, use the local value if specified
      envVars[key] = varNameMapping[key].localValue;
      continue;
    }

    // we haven't yet fetched the value; do that based on type
    switch (varNameMapping[key].type) {
      case "serverless-domain":
        fetchCli.fetchServerlessDomains();
        break;
      case "tr-workspace":
        fetchCli.fetchTrWorkspaces();
        break;
      case "tr-workflow":
        // Workflows require the TR workspace SID; fetch them if that has not yet happened
        if (!fetchCli.getFetchedVars().TWILIO_FLEX_WORKSPACE_SID) {
          fetchCli.fetchTrWorkspaces();
        }
        let workspaceSid = fetchCli.getFetchedVars().TWILIO_FLEX_WORKSPACE_SID;
        fetchCli.fetchTrWorkflows(workspaceSid);
        break;
      case "sync-service":
        fetchCli.fetchSyncServices();
        break;
      case "chat-service":
        fetchCli.fetchChatServices();
        break;
      case "conversations-address":
        fetchCli.fetchConversationsAddresses();
        break;
      default:
        console.warn(
          `Unknown placeholder variable type: ${varNameMapping[key].type}`
        );
        break;
    }

    // Get the newly fetched value from cache
    if (fetchCli.getFetchedVars()[key]) {
      envVars[key] = fetchCli.getFetchedVars()[key];
    }
  }

  return envVars;
};

const fillAccountVars = (envVars, account) => {
  for (const key in envVars) {
    if (envVars[key] !== `<YOUR_${key}>`) {
      // If this isn't a placeholder value, ignore it.
      continue;
    }

    if (key == "ACCOUNT_SID" && account.accountSid) {
      envVars[key] = account.accountSid;
    } else if (key == "AUTH_TOKEN" && account.authToken) {
      envVars[key] = account.authToken;
    }
  }

  return envVars;
};

const saveReplacements = async (data, path) => {
  try {
    for (const key in data) {
      shell.sed("-i", new RegExp(`<YOUR_${key}>`, "g"), data[key], path);
    }
  } catch (error) {
    console.error(`Error saving file ${path}`, error);
  }
};

export default async (path, examplePath, account, environment) => {
  console.log(`Setting up ${path}...`);

  // Initialize the env vars
  let envVars = await readEnv(path, examplePath);

  if (!envVars) {
    console.error(`Unable to create the file ${path}.`);
    return null;
  }

  try {
    // Fill known env vars from process.env
    envVars = fillKnownEnvVars(envVars);

    // Fill known account vars
    envVars = fillAccountVars(envVars, account);
  } catch (error) {
    console.error("Error fetching variables", error);
    return null;
  }

  // Fetch unknown env vars from the API
  envVars = fillUnknownEnvVars(envVars, environment);

  // Save!
  await saveReplacements(envVars, path);

  return envVars;
};

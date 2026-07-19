#!/usr/bin/env node

const token = process.env.SONAR_TOKEN?.trim();
const pullRequest = process.env.SONAR_PULL_REQUEST?.trim();
const branch = process.env.SONAR_BRANCH?.trim() || "main";
const projectKey = "AnaLysyk_Quality_Control";
const organization = "analysyk";
const host = "https://sonarcloud.io";

if (!token) {
  console.error("SONAR_TOKEN não está definido.");
  process.exit(1);
}

const authorization = `Basic ${Buffer.from(`${token}:`).toString("base64")}`;
const scope = pullRequest ? { pullRequest
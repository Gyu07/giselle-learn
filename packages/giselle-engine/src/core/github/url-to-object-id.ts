import {
	type GitHubAuthConfig,
	IssueNodeIdQuery,
	graphql,
} from "@giselle-sdk/github-tool";
import type { GiselleEngineContext } from "../types";
import { NotFoundError, UnsupportedError } from "./error";
import { parseGitHubUrl } from "./utils";

export async function urlToObjectID(args: {
	url: string;
	context: GiselleEngineContext;
}) {
	const githubUrlInfo = parseGitHubUrl(args.url);
	if (githubUrlInfo === null) {
		throw new Error("Invalid GitHub URL");
	}
	const githubConfig = args.context.integrationConfigs?.github;
	if (githubConfig === undefined) {
		throw new Error("GitHub integration not configured");
	}

	let config: GitHubAuthConfig | undefined = undefined;

	switch (githubConfig.auth.strategy) {
		case "app-installation": {
			const installationId =
				await githubConfig.auth.resolver.installationIdForRepo("dummy");
			config = {
				strategy: "app-installation",
				appId: githubConfig.auth.appId,
				privateKey: githubConfig.auth.privateKey,
				installationId,
			};
			break;
		}
		case "personal-access-token":
			config = githubConfig.auth;
			break;
		default: {
			const _exhaustiveCheck: never = githubConfig.auth;
			throw new UnsupportedError(
				`Unsupported auth strategy: ${_exhaustiveCheck}`,
			);
		}
	}

	const client = await graphql(config);
	switch (githubUrlInfo.type) {
		case "issue": {
			const { data, error } = await client.query(IssueNodeIdQuery, {
				owner: githubUrlInfo.owner,
				name: githubUrlInfo.repo,
				issueNumber: githubUrlInfo.issueNumber,
			});
			if (data?.repository?.issue == null) {
				throw new NotFoundError(
					`Issue not found: ${githubUrlInfo.owner}/${githubUrlInfo.repo}#${githubUrlInfo.issueNumber}`,
				);
			}
			return data.repository.issue.id;
		}
		case "issueComment":
		case "pullRequest":
		case "pullRequestReviewComment":
		case "discussion":
		case "discussionComment":
		case "commit":
		case "release":
		case "tree":
			throw new UnsupportedError(
				`Unsupported GitHub URL type: ${githubUrlInfo.type}`,
			);
		default: {
			const _exhaustiveCheck: never = githubUrlInfo;
			throw new Error(`Unsupported GitHub URL type: ${_exhaustiveCheck}`);
		}
	}
}

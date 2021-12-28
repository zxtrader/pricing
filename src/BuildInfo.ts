import ensureFactory, { Ensure } from "@zxteam/ensure";
import { InvalidOperationError } from "@zxteam/errors";

export abstract class BuildInfo {
	public readonly description: string;
	public readonly company: string;
	public readonly copyright: string;
	// public readonly product: string;
	public readonly version: string;
	public readonly contributors: ReadonlyArray<string>;
	public readonly repositoryUrl: URL;
	public readonly repositoryReference: string;
	public readonly repositoryCommit: string;
	public readonly buildConfiguration: string;
	public readonly buildLogUrl: URL;
	public readonly buildDate: Date;

	public constructor(buildInfoLike: BuildInfo) {
		if (this.constructor === BuildInfo) {
			throw new InvalidOperationError(`Cannot create an instance of abstract class: ${this.constructor.name}`);
		}

		this.description = buildInfoLike.description;
		this.company = buildInfoLike.company;
		this.copyright = buildInfoLike.copyright;
		// this.product = buildInfoLike.product;
		this.version = buildInfoLike.version;
		this.contributors = buildInfoLike.contributors;
		this.repositoryUrl = buildInfoLike.repositoryUrl;
		this.repositoryReference = buildInfoLike.repositoryReference;
		this.repositoryCommit = buildInfoLike.repositoryCommit;
		this.buildConfiguration = buildInfoLike.buildConfiguration;
		this.buildLogUrl = buildInfoLike.buildLogUrl;
		this.buildDate = buildInfoLike.buildDate;
	}
}

export class BuildInfoImpl extends BuildInfo {
	public constructor() {
		super(BuildInfoImpl._fromPackageJson());
	}

	private static _fromPackageJson(): BuildInfo {
		const { author, version, description, contributors, license, product, build } = require("../package.json");

		const ensure: Ensure = ensureFactory();

		const buildRaw: any = ensure.object(build, "Incorrect 'build' field.");
		const authorRaw: any = ensure.object(author, "Incorrect 'author' field.");

		const buildInfo: BuildInfo = {
			description: ensure.string(description, "Incorrect 'description' field."),
			company: ensure.string(authorRaw.name, "Incorrect 'author.name' field."),
			copyright: ensure.string(license, "Incorrect 'license' field."),
			// product: ensure.string(product, "Incorrect 'product' field."),
			version: ensure.string(version, "Incorrect 'version' field."),
			contributors: ensure.array(contributors, "Incorrect 'contributors' field.").map(contributor => ensure.string(contributor, "Bad contributor value.")),
			repositoryUrl: new URL(ensure.string(buildRaw.repositoryUrl, "Incorrect 'repositoryUrl' field.")),
			repositoryReference: ensure.string(buildRaw.repositoryReference, "Incorrect 'repositoryReference' field."),
			repositoryCommit: ensure.string(buildRaw.repositoryCommit, "Incorrect 'repositoryCommit' field."),
			buildConfiguration: ensure.string(buildRaw.buildConfiguration, "Incorrect 'buildConfiguration' field."),
			buildLogUrl: new URL(ensure.string(buildRaw.buildLogUrl, "Incorrect 'buildLogUrl' field.")),
			buildDate: new Date(ensure.string(buildRaw.buildDate, "Incorrect 'buildDate' field."))
		};

		return Object.freeze(buildInfo);
	}
}


export class DevelBuildInfo extends BuildInfo {
	public constructor() {
		super(DevelBuildInfo._fromPackageJson());
	}

	private static _fromPackageJson(): BuildInfo {
		const { version, description, author, contributors, license, product, build } = require("../package.json");

		const ensure: Ensure = ensureFactory();

		const repositoryUrl: URL = build !== undefined && "repositoryUrl" in build
			? new URL(ensure.string(build.repositoryUrl, "Incorrect 'repositoryUrl' field."))
			: new URL("http://localhost/repo");

		const repositoryReference: string = build !== undefined && "repositoryReference" in build
			? ensure.string(build.repositoryReference, "Incorrect 'repositoryReference' field.")
			: "workcopy";

		const repositoryCommit: string = build !== undefined && "repositoryCommit" in build
			? ensure.string(build.repositoryCommit, "Incorrect 'repositoryCommit' field.")
			: "00000000";

		const buildConfiguration: string = build !== undefined && "buildConfiguration" in build
			? ensure.string(build.buildConfiguration, "Incorrect 'buildConfiguration' field.")
			: "local";

		const buildLogUrl: URL = build !== undefined && "buildLogUrl" in build
			? new URL(ensure.string(build.buildLogUrl, "Incorrect 'buildLogUrl' field."))
			: new URL("http://localhost/ci");

		const buildDate: Date = build !== undefined && "buildDate" in build
			? new Date(ensure.string(build.buildDate, "Incorrect 'buildDate' field."))
			: new Date();
			
			const authorRaw: any = ensure.object(author, "Incorrect 'author' field.");

		const buildInfo: BuildInfo = {
			description: ensure.string(description, "Incorrect 'description' field."),
			copyright: ensure.string(license, "Incorrect 'license' field."),
			company: ensure.string(authorRaw.name, "Incorrect 'author.name' field."),
			// product: ensure.string(product, "Incorrect 'product' field."),
			version: ensure.string(version, "Incorrect 'version' field."),
			contributors: ensure.array(contributors, "Incorrect 'contributors' field.").map(contributor => ensure.string(contributor, "Bad contributor value.")),
			repositoryUrl,
			repositoryReference,
			repositoryCommit,
			buildConfiguration,
			buildLogUrl,
			buildDate
		};

		return Object.freeze(buildInfo);
	}
}

